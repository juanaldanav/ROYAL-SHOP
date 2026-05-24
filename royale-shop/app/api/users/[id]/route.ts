import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params
    const body = await req.json()
    const { name, email, pin, role, branchId, active } = body

    const existing = await db.user.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    if (pin && (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin)))) {
      return NextResponse.json({ error: "El PIN debe ser de 4 dígitos" }, { status: 400 })
    }

    const targetBranchId = branchId !== undefined ? branchId : existing.branchId
    if (pin && targetBranchId) {
      const conflict = await db.user.findFirst({
        where: { tenantId, branchId: targetBranchId, pin: String(pin), active: true, NOT: { id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Ya existe un cajero con ese PIN en esta sucursal" },
          { status: 409 }
        )
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(pin !== undefined ? { pin: String(pin) } : {}),
        ...(role !== undefined ? { role: role as UserRole } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      include: { branch: { select: { name: true } } },
    })

    return NextResponse.json({ ...updated, pin: undefined })
  } catch (error) {
    console.error("[PATCH /api/users/[id]]", error)
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params

    const existing = await db.user.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    await db.user.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/users/[id]]", error)
    return NextResponse.json({ error: "Error al desactivar usuario" }, { status: 500 })
  }
}
