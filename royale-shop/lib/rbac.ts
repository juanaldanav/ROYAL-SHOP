import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

type Role = "OWNER" | "MANAGER" | "CASHIER"

/** Consulta el rol real del usuario en DB. Retorna null si no existe o tenant no coincide. */
export async function getUserRole(req: NextRequest): Promise<Role | null> {
  const { tenantId, userId } = getSession(req)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true },
  })
  if (!user || user.tenantId !== tenantId) return null
  return user.role as Role
}

/**
 * Verifica en DB que el usuario tiene rol OWNER o MANAGER.
 * Retorna null si está permitido, NextResponse(403) si no.
 * Usar al inicio de POST/PATCH/DELETE en rutas de admin.
 */
export async function assertManagerOrOwner(req: NextRequest): Promise<NextResponse | null> {
  const { tenantId, userId } = getSession(req)

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true },
  })

  if (!user || user.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const role = user.role as Role
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
  }

  return null
}

/** Verifica que el usuario sea OWNER. Solo para rutas de configuración del tenant. */
export async function assertOwner(req: NextRequest): Promise<NextResponse | null> {
  const { tenantId, userId } = getSession(req)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true },
  })
  if (!user || user.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño puede realizar esta acción" }, { status: 403 })
  }
  return null
}
