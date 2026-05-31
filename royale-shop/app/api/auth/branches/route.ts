import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// GET /api/auth/branches — listado PÚBLICO de sucursales para el selector de login.
// No requiere sesión (aún no hay usuario). Devuelve todas las sucursales activas de
// todos los tenants — un solo deployment sirve múltiples negocios.
// branchId es cuid global único → determina el tenant al hacer login.
export async function GET() {
  try {
    const branches = await db.branch.findMany({
      where: { active: true },
      select: { id: true, name: true, tenant: { select: { name: true } } },
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
    })
    return NextResponse.json(
      branches.map((b) => ({ id: b.id, name: b.name, tenantName: b.tenant.name }))
    )
  } catch (error) {
    console.error("[GET /api/auth/branches]", error)
    return NextResponse.json({ error: "Error al obtener sucursales" }, { status: 500 })
  }
}
