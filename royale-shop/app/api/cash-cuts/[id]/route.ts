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

    const cashCut = await db.cashCut.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { name: true } },
        sales: {
          include: { items: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!cashCut) {
      return NextResponse.json({ error: "Corte de caja no encontrado" }, { status: 404 })
    }

    return NextResponse.json(cashCut)
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
    const { countedCash, notes } = body

    if (countedCash === undefined || countedCash === null) {
      return NextResponse.json({ error: "countedCash es requerido" }, { status: 400 })
    }

    const cashCut = await db.cashCut.findFirst({ where: { id, tenantId } })

    if (!cashCut) {
      return NextResponse.json({ error: "Corte de caja no encontrado" }, { status: 404 })
    }

    if (cashCut.status === "CLOSED") {
      return NextResponse.json({ error: "El corte de caja ya está cerrado" }, { status: 409 })
    }

    const sales = await db.sale.findMany({
      where: { cashCutId: id, tenantId, status: "COMPLETED" },
      select: { total: true, paymentMethod: true },
    })

    const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0)
    const cashSalesTotal = sales
      .filter((s) => s.paymentMethod === "CASH")
      .reduce((sum, s) => sum + Number(s.total), 0)

    const openingBalance = Number(cashCut.openingBalance)
    const expectedCash = openingBalance + cashSalesTotal
    const difference = Number(countedCash) - expectedCash

    const updated = await db.cashCut.update({
      where: { id },
      data: {
        closedAt: new Date(),
        totalSales,
        expectedCash,
        countedCash: Number(countedCash),
        difference,
        status: "CLOSED",
        notes: notes ?? null,
      },
      include: { user: { select: { name: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/cash-cuts/[id]]", error)
    return NextResponse.json({ error: "Error al cerrar el corte de caja" }, { status: 500 })
  }
}
