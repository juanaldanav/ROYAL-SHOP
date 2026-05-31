import { db } from "@/lib/db"
import { assertManagerOrOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await assertManagerOrOwner(req)
    if (denied) return denied
    const { tenantId } = getSession(req)
    const { id } = await params
    const body = await req.json()

    const service = await db.service.update({
      where: { id, tenantId },
      data: body,
      include: { category: true },
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error("[PATCH /api/services/[id]]", error)
    return NextResponse.json({ error: "Error al actualizar servicio" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await assertManagerOrOwner(req)
    if (denied) return denied
    const { tenantId } = getSession(req)
    const { id } = await params

    await db.service.update({
      where: { id, tenantId },
      data: { active: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/services/[id]]", error)
    return NextResponse.json({ error: "Error al eliminar servicio" }, { status: 500 })
  }
}
