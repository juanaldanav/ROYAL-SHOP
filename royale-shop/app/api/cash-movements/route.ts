import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

// POST /api/cash-movements — registra una SALIDA de efectivo (EXPENSE) en el
// corte activo. Monto > 0 y razón (description) obligatoria. El cajero solo
// puede registrar sobre el corte abierto de su propia sucursal.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, branchId, userId } = getSession(req)
    const body = await req.json()
    const { cashCutId, amount, description } = body

    const amountNum = Number(amount)
    if (!cashCutId) {
      return NextResponse.json({ error: "cashCutId es requerido" }, { status: 400 })
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
    }
    if (!description || !String(description).trim()) {
      return NextResponse.json({ error: "La razón de la salida es obligatoria" }, { status: 400 })
    }

    const cut = await db.cashCut.findFirst({ where: { id: cashCutId, tenantId } })
    if (!cut) {
      return NextResponse.json({ error: "Corte de caja no encontrado" }, { status: 404 })
    }
    if (cut.branchId !== branchId) {
      return NextResponse.json({ error: "No autorizado para este corte" }, { status: 403 })
    }
    if (cut.status !== "OPEN") {
      return NextResponse.json({ error: "El corte de caja ya está cerrado" }, { status: 409 })
    }

    const movement = await db.cashMovement.create({
      data: {
        tenantId,
        branchId,
        cashCutId,
        type: "EXPENSE",
        amount: amountNum,
        description: String(description).trim(),
        authorizedById: userId,
      },
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error("[POST /api/cash-movements]", error)
    return NextResponse.json({ error: "Error al registrar la salida de efectivo" }, { status: 500 })
  }
}
