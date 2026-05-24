import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params
    const body = await req.json()
    const { name, address, phone, active } = body

    const existing = await db.branch.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }

    const updated = await db.branch.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/branches/[id]]", error)
    return NextResponse.json({ error: "Error al actualizar sucursal" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params

    const existing = await db.branch.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }

    await db.branch.update({ where: { id }, data: { active: false } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/branches/[id]]", error)
    return NextResponse.json({ error: "Error al eliminar sucursal" }, { status: 500 })
  }
}
