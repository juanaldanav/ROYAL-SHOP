import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"
import { PaymentMethod } from "@/app/generated/prisma/client"
import { generateFolio } from "@/lib/format"

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getSession(req)
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const branchId = searchParams.get("branchId")
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

    const change = paymentMethod === "CASH" ? Number(amountPaid) - total : 0

    const sale = await db.$transaction(async (tx) => {
      const folio = generateFolio()

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
          amountPaid: Number(amountPaid),
          change,
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

      // Decrement BranchStock per product
      for (const item of items) {
        if (item.productId) {
          const bs = await tx.branchStock.findUnique({
            where: { tenantId_branchId_productId: { tenantId, branchId, productId: item.productId } },
            select: { stock: true },
          })
          const currentStock = bs?.stock ?? 0
          await tx.branchStock.upsert({
            where: { tenantId_branchId_productId: { tenantId, branchId, productId: item.productId } },
            update: { stock: Math.max(0, currentStock - item.quantity) },
            create: { tenantId, branchId, productId: item.productId, stock: 0 },
          })
        }
      }

      return newSale
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error("[POST /api/sales]", error)
    return NextResponse.json({ error: "Error al crear la venta" }, { status: 500 })
  }
}
