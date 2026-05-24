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
    const { name, type, sortOrder, active } = body

    const existing = await db.category.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })
    }

    const updated = await db.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/categories/[id]]", error)
    return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params

    const existing = await db.category.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })
    }

    // Soft delete — deactivate rather than destroy (products may reference it)
    await db.category.update({ where: { id }, data: { active: false } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/categories/[id]]", error)
    return NextResponse.json({ error: "Error al eliminar categoría" }, { status: 500 })
  }
}
