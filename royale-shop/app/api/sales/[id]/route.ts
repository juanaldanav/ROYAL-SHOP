import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params

    const sale = await db.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            service: { select: { name: true } },
          },
        },
        payments: true,
        user: { select: { name: true } },
        branch: { select: { name: true } },
        cashCut: { select: { id: true, status: true } },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error("[GET /api/sales/[id]]", error)
    return NextResponse.json({ error: "Error al obtener la venta" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params
    const body = await req.json()
    const { action, authPin } = body

    if (action !== "cancel") {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
    }

    if (!authPin) {
      return NextResponse.json({ error: "Se requiere PIN de autorización" }, { status: 403 })
    }

    // Verificar PIN de MANAGER u OWNER activo en el tenant
    const authorizer = await db.user.findFirst({
      where: { tenantId, pin: String(authPin), role: { in: ["MANAGER", "OWNER"] }, active: true },
    })
    if (!authorizer) {
      return NextResponse.json({ error: "PIN de autorización inválido" }, { status: 403 })
    }

    // Cargar la venta con su corte, items y pagos
    const existing = await db.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        payments: { select: { method: true, amount: true } },
        cashCut: { select: { id: true, status: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }
    if (existing.status === "CANCELLED") {
      return NextResponse.json({ error: "La venta ya está cancelada" }, { status: 409 })
    }

    // Buscar corte ABIERTO en la sucursal donde se procesa la cancelación
    const openCut = await db.cashCut.findFirst({
      where: { tenantId, branchId: existing.branchId, status: "OPEN" },
    })
    if (!openCut) {
      return NextResponse.json(
        { error: "Debe abrir turno/corte de caja antes de procesar una cancelación" },
        { status: 400 }
      )
    }

    // Calcular porción en efectivo de la venta original (regla de terminal bancaria)
    // Solo el efectivo sale del cajón — tarjeta/transferencia se devuelve en terminal bancaria
    let cashPortion = 0
    if (existing.payments.length > 0) {
      const cashPmt = existing.payments.find((p) => p.method === "CASH")
      cashPortion = cashPmt ? Number(cashPmt.amount) : 0
    } else if (existing.paymentMethod === "MIXED") {
      cashPortion = Number(existing.cashAmount)
    } else if (existing.paymentMethod === "CASH") {
      cashPortion = Number(existing.total)
    }
    // CARD o TRANSFER → cashPortion = 0, no se crea CashMovement

    const originalCutClosed = existing.cashCut?.status === "CLOSED"

    const sale = await db.$transaction(async (tx) => {
      // 1. Marcar venta como CANCELADO (soft delete, conserva folio)
      const cancelled = await tx.sale.update({
        where: { id },
        data: { status: "CANCELLED" },
      })

      // 2. Restaurar stock de productos (servicios no tienen stock)
      for (const item of existing.items) {
        if (item.productId) {
          await tx.branchStock.update({
            where: {
              tenantId_branchId_productId: {
                tenantId,
                branchId: existing.branchId,
                productId: item.productId,
              },
            },
            data: { stock: { increment: item.quantity } },
          })
        }
      }

      // 3. Regla contable post-corte: si el corte original YA CERRÓ y hay efectivo,
      //    crear un Movimiento de Caja (REFUND) en el corte ACTUAL para que cuadre hoy
      if (originalCutClosed && cashPortion > 0) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            branchId: existing.branchId,
            cashCutId: openCut.id,
            type: "REFUND",
            amount: cashPortion,
            description: `Devolución por cancelación de venta ${existing.folio ?? id}`,
            relatedSaleId: id,
            authorizedById: authorizer.id,
          },
        })
      }

      return cancelled
    })

    return NextResponse.json(sale)
  } catch (error) {
    console.error("[PATCH /api/sales/[id]]", error)
    return NextResponse.json({ error: "Error al cancelar la venta" }, { status: 500 })
  }
}
