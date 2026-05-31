import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { getUserRole } from "@/lib/rbac"
import { NextRequest, NextResponse } from "next/server"
import { PaymentMethod } from "@/app/generated/prisma/client"
import { generateFolio } from "@/lib/format"
import { sendSaleTicketEmail } from "@/lib/mailer"

// Error de negocio: no hay stock suficiente (o no existe row) para vender.
// Se lanza dentro de la transacción → rollback → 409 al cliente.
class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Stock insuficiente para "${productName}" en esta sucursal`)
    this.name = "InsufficientStockError"
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId, branchId: sessionBranchId } = getSession(req)
    const role = await getUserRole(req)
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const queryBranchId = searchParams.get("branchId")
    // CASHIER can only see their own branch — no override allowed
    const branchId = role === "CASHIER" ? sessionBranchId : queryBranchId
    const limit = parseInt(searchParams.get("limit") ?? "50", 10)
    const offset = parseInt(searchParams.get("offset") ?? "0", 10)

    const sales = await db.sale.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      include: {
        items: true,
        payments: true,
        user: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error("[GET /api/sales]", error)
    return NextResponse.json({ error: "Error al obtener ventas" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, branchId, userId } = getSession(req)
    const body = await req.json()
    const {
      cashCutId,
      items,
      paymentMethod,
      amountPaid,
      discount = 0,
      customerName,
      customerPhone,
      customerEmail,
      // Pago mixto — solo cuando paymentMethod === "MIXED"
      cashAmount = 0,
      cardAmount = 0,
      transferAmount = 0,
    } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos un artículo" }, { status: 400 })
    }
    if (!cashCutId) {
      return NextResponse.json({ error: "cashCutId es requerido" }, { status: 400 })
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: "paymentMethod es requerido" }, { status: 400 })
    }

    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    )
    const discountAmount = Number(discount) || 0
    const total = subtotal - discountAmount

    if (paymentMethod === "CASH" && Number(amountPaid) < total) {
      return NextResponse.json({ error: "El monto pagado es insuficiente" }, { status: 400 })
    }

    if (paymentMethod === "MIXED") {
      const mixedTotal = Number(cashAmount) + Number(cardAmount) + Number(transferAmount)
      if (mixedTotal < total) {
        return NextResponse.json(
          { error: `Pago mixto insuficiente. Suma: $${mixedTotal.toFixed(2)}, Total: $${total.toFixed(2)}` },
          { status: 400 }
        )
      }
    }

    const change =
      paymentMethod === "CASH"
        ? Number(amountPaid) - total
        : paymentMethod === "MIXED"
        ? Math.max(0, Number(cashAmount) - Math.max(0, total - Number(cardAmount) - Number(transferAmount)))
        : 0

    const sale = await db.$transaction(async (tx) => {
      const folio = generateFolio()

      // Pre-fetch product costs inside transaction for snapshot
      const productCosts: Record<string, number | null> = {}
      for (const item of items) {
        if (item.productId) {
          const p = await tx.product.findUnique({
            where: { id: item.productId },
            select: { cost: true },
          })
          productCosts[item.productId] = p?.cost ? Number(p.cost) : null
        }
      }

      const newSale = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          userId,
          cashCutId,
          folio,
          subtotal,
          discount: discountAmount,
          tax: 0,
          total,
          paymentMethod: paymentMethod as PaymentMethod,
          amountPaid: paymentMethod === "MIXED"
            ? Number(cashAmount) + Number(cardAmount) + Number(transferAmount)
            : Number(amountPaid),
          change,
          cashAmount: paymentMethod === "MIXED" ? Number(cashAmount) : paymentMethod === "CASH" ? Number(amountPaid) : 0,
          cardAmount: paymentMethod === "MIXED" ? Number(cardAmount) : paymentMethod === "CARD" ? Number(amountPaid) : 0,
          transferAmount: paymentMethod === "MIXED" ? Number(transferAmount) : paymentMethod === "TRANSFER" ? Number(amountPaid) : 0,
          customerName: customerName ?? null,
          customerPhone: customerPhone ?? null,
          customerEmail: customerEmail ?? null,
          status: "COMPLETED",
          items: {
            create: items.map(
              (item: {
                productId?: string
                serviceId?: string
                name: string
                price: number
                quantity: number
              }) => ({
                productId: item.productId ?? null,
                serviceId: item.serviceId ?? null,
                name: item.name,
                price: item.price,
                cost: item.productId ? (productCosts[item.productId] ?? null) : null,
                quantity: item.quantity,
                subtotal: item.price * item.quantity,
              })
            ),
          },
        },
        include: {
          items: true,
          branch: { select: { name: true } },
          user: { select: { name: true } },
        },
      })

      // Descuenta BranchStock por producto — atómico, sin negativos.
      // updateMany con guarda stock>=qty: decremento atómico (sin race) y
      // si afecta 0 filas (sin stock o sin row) lanza error → rollback + 409.
      // Simétrico con el cancel (que hace increment de la misma qty).
      for (const item of items) {
        if (item.productId) {
          const { count } = await tx.branchStock.updateMany({
            where: {
              tenantId,
              branchId,
              productId: item.productId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          })
          if (count === 0) {
            throw new InsufficientStockError(item.name)
          }
        }
      }

      // Crear Payment records — desglose real por método (nunca MIXED)
      const paymentLines: { method: string; amount: number }[] =
        paymentMethod === "MIXED"
          ? [
              { method: "CASH",     amount: Number(cashAmount) },
              { method: "CARD",     amount: Number(cardAmount) },
              { method: "TRANSFER", amount: Number(transferAmount) },
            ].filter((p) => p.amount > 0)
          : [{ method: paymentMethod, amount: total }]

      for (const p of paymentLines) {
        await tx.payment.create({
          data: { saleId: newSale.id, method: p.method as PaymentMethod, amount: p.amount },
        })
      }

      return newSale
    })

    // Envío automático del ticket por correo (Req 5). No-op si SMTP o el correo
    // del negocio no están configurados, o si la venta no trae customerEmail.
    // Nunca rompe la venta (sendSaleTicketEmail no lanza).
    if (customerEmail) {
      await sendSaleTicketEmail(sale.id, tenantId)
    }

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("[POST /api/sales]", error)
    return NextResponse.json({ error: "Error al crear la venta" }, { status: 500 })
  }
}
