import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId, branchId } = getSession(req)

    const cashCuts = await db.cashCut.findMany({
      where: { tenantId, branchId },
      include: {
        user: { select: { name: true } },
        _count: { select: { sales: true } },
      },
      orderBy: { openedAt: "desc" },
    })

    return NextResponse.json(cashCuts)
  } catch (error) {
    console.error("[GET /api/cash-cuts]", error)
    return NextResponse.json({ error: "Error al obtener cortes de caja" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, branchId, userId } = getSession(req)
    const body = await req.json()
    const { openingBalance } = body

    if (openingBalance === undefined || openingBalance === null) {
      return NextResponse.json({ error: "openingBalance es requerido" }, { status: 400 })
    }

    const existing = await db.cashCut.findFirst({
      where: { tenantId, branchId, status: "OPEN" },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un corte de caja abierto para esta sucursal", cashCutId: existing.id },
        { status: 409 }
      )
    }

    const cashCut = await db.cashCut.create({
      data: {
        tenantId,
        branchId,
        userId,
        openingBalance: Number(openingBalance),
        status: "OPEN",
      },
      include: { user: { select: { name: true } } },
    })

    return NextResponse.json(cashCut, { status: 201 })
  } catch (error) {
    console.error("[POST /api/cash-cuts]", error)
    return NextResponse.json({ error: "Error al crear el corte de caja" }, { status: 500 })
  }
}
