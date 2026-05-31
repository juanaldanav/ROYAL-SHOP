import { db } from "@/lib/db"
import { assertOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getSession(req)
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, phone: true, email: true, logoUrl: true },
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
    const { name, phone, email, logoUrl } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre del negocio es requerido" }, { status: 400 })
    }
    const emailTrimmed = email?.trim() || null
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return NextResponse.json({ error: "Correo del negocio inválido" }, { status: 400 })
    }

    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: emailTrimmed,
        logoUrl: logoUrl?.trim() || null,
      },
      select: { id: true, name: true, slug: true, phone: true, email: true, logoUrl: true },
    })

    return NextResponse.json(tenant)
  } catch (error) {
    console.error("[PATCH /api/tenant]", error)
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 })
  }
}
