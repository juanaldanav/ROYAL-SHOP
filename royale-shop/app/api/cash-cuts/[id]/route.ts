import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, branchId } = getSession(req)
    const { id } = await params

    const cashCut = await db.cashCut.findFirst({
      where: { id, tenantId, branchId },
      include: {
        user: { select: { name: true } },
        sales: {
          include: { items: true, payments: { select: { method: true, amount: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!cashCut) {
      return NextResponse.json({ error: "Corte de caja no encontrado" }, { status: 404 })
    }

    // Compute live method breakdown (useful for open cuts or detail view)
    const methodTotals: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 }
    let cashIn = 0
    let cashOut = 0
    let totalSales = 0

    for (const sale of cashCut.sales) {
      if (sale.status !== "COMPLETED") continue
      totalSales += Number(sale.total)
      if (sale.payments.length > 0) {
        for (const p of sale.payments) {
          if (p.method in methodTotals) methodTotals[p.method] += Number(p.amount)
        }
        const cashPmt = sale.payments.find((p) => p.method === "CASH")
        if (cashPmt) cashIn += Number(cashPmt.amount)
      } else if (sale.paymentMethod === "MIXED") {
        methodTotals.CASH     += Number(sale.cashAmount)
        methodTotals.CARD     += Number(sale.cardAmount)
        methodTotals.TRANSFER += Number(sale.transferAmount)
        cashIn += Number(sale.cashAmount)
      } else {
        if (sale.paymentMethod in methodTotals) methodTotals[sale.paymentMethod] += Number(sale.total)
        if (sale.paymentMethod === "CASH") cashIn += Number(sale.total)
      }
      if (sale.paymentMethod === "CASH" || sale.paymentMethod === "MIXED") {
        cashOut += Number(sale.change)
      }
    }

    // Devoluciones en efectivo registradas en este corte
    const refunds = await db.cashMovement.findMany({
      where: { cashCutId: cashCut.id, tenantId, type: "REFUND" },
      select: { amount: true },
    })
    const totalRefunds = refunds.reduce((sum, m) => sum + Number(m.amount), 0)

    const openingBalance = Number(cashCut.openingBalance)
    const expectedCashLive = openingBalance + cashIn - cashOut - totalRefunds

    return NextResponse.json({
      ...cashCut,
      methodTotals,
      cashIn,
      cashOut,
      totalSalesLive: totalSales,
      expectedCashLive,
    })
  } catch (error) {
    console.error("[GET /api/cash-cuts/[id]]", error)
    return NextResponse.json({ error: "Error al obtener el corte de caja" }, { status: 500 })
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
    const { countedCash, countedCard, notes } = body

    if (countedCash === undefined || countedCash === null) {
      return NextResponse.json({ error: "countedCash es requerido" }, { status: 400 })
    }
    if (countedCard === undefined || countedCard === null) {
      return NextResponse.json({ error: "countedCard es requerido" }, { status: 400 })
    }

    const { branchId } = getSession(req)
    const cashCut = await db.cashCut.findFirst({ where: { id, tenantId } })

    if (!cashCut) {
      return NextResponse.json({ error: "Corte de caja no encontrado" }, { status: 404 })
    }

    if (cashCut.branchId !== branchId) {
      return NextResponse.json({ error: "No autorizado para este corte de caja" }, { status: 403 })
    }

    if (cashCut.status === "CLOSED") {
      return NextResponse.json({ error: "El corte de caja ya está cerrado" }, { status: 409 })
    }

    const [sales, refundMovements] = await Promise.all([
      db.sale.findMany({
        where: { cashCutId: id, tenantId, status: "COMPLETED" },
        select: {
          id: true,
          total: true,
          paymentMethod: true,
          change: true,
          cashAmount: true,
          cardAmount: true,
          transferAmount: true,
          payments: { select: { method: true, amount: true } },
        },
      }),
      db.cashMovement.findMany({
        where: { cashCutId: id, tenantId, type: "REFUND" },
        select: { amount: true },
      }),
    ])

    const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0)

    // Per-method totals (dual-source: Payment records for new sales, inline for old)
    const methodTotals: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 }
    let cashIn = 0   // efectivo que entró a la caja
    let cashOut = 0  // cambio devuelto al cliente

    for (const sale of sales) {
      if (sale.payments.length > 0) {
        for (const p of sale.payments) {
          if (p.method in methodTotals) methodTotals[p.method] += Number(p.amount)
        }
        const cashPmt = sale.payments.find((p) => p.method === "CASH")
        if (cashPmt) cashIn += Number(cashPmt.amount)
      } else if (sale.paymentMethod === "MIXED") {
        methodTotals.CASH     += Number(sale.cashAmount)
        methodTotals.CARD     += Number(sale.cardAmount)
        methodTotals.TRANSFER += Number(sale.transferAmount)
        cashIn += Number(sale.cashAmount)
      } else {
        if (sale.paymentMethod in methodTotals) methodTotals[sale.paymentMethod] += Number(sale.total)
        if (sale.paymentMethod === "CASH") cashIn += Number(sale.total)
      }
      if (sale.paymentMethod === "CASH" || sale.paymentMethod === "MIXED") {
        cashOut += Number(sale.change)
      }
    }

    // Devoluciones en efectivo registradas en este corte (cancelaciones post-corte)
    const totalRefunds = refundMovements.reduce((sum, m) => sum + Number(m.amount), 0)

    const openingBalance = Number(cashCut.openingBalance)
    // Efectivo esperado = saldo inicial + efectivo recibido − cambio devuelto − devoluciones
    const expectedCash = openingBalance + cashIn - cashOut - totalRefunds
    const difference = Number(countedCash) - expectedCash
    // Tarjeta esperada = solo pagos CARD (TRANSFER no genera voucher físico de terminal bancaria)
    const expectedCard = methodTotals.CARD
    const cardDifference = Number(countedCard) - expectedCard

    const cuadreStatus = difference === 0 ? "EXACTO" : difference > 0 ? "SOBRANTE" : "FALTANTE"
    const cardCuadreStatus = cardDifference === 0 ? "EXACTO" : cardDifference > 0 ? "SOBRANTE" : "FALTANTE"

    const updated = await db.cashCut.update({
      where: { id },
      data: {
        closedAt: new Date(),
        totalSales,
        expectedCash,
        countedCash: Number(countedCash),
        difference,
        expectedCard,
        countedCard: Number(countedCard),
        cardDifference,
        cuadreStatus,
        cardCuadreStatus,
        status: "CLOSED",
        notes: notes ?? null,
      },
      include: { user: { select: { name: true } } },
    })

    const responseData = {
      ...updated,
      methodTotals,
      cashIn,
      cashOut,
      cuadreStatus,
      cardCuadreStatus,
      // Expose computed values as numbers for UI (Prisma Decimal serializes as string)
      expectedCard: Number(updated.expectedCard ?? expectedCard),
      cardDifference: Number(updated.cardDifference ?? cardDifference),
      difference: Number(updated.difference ?? difference),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("[PATCH /api/cash-cuts/[id]]", error)
    return NextResponse.json({ error: "Error al cerrar el corte de caja" }, { status: 500 })
  }
}
