import { db } from "@/lib/db"
import { assertOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getSession(req)
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, phone: true, logoUrl: true },
    })
    if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    return NextResponse.json(tenant)
  } catch (error) {
    console.error("[GET /api/tenant]", error)
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const denied = await assertOwner(req)
    if (denied) return denied
    const { tenantId } = getSession(req)
    const { name, phone, logoUrl } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre del negocio es requerido" }, { status: 400 })
    }

    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
      },
      select: { id: true, name: true, slug: true, phone: true, logoUrl: true },
    })

    return NextResponse.json(tenant)
  } catch (error) {
    console.error("[PATCH /api/tenant]", error)
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 })
  }
}
