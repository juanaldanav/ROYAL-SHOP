import { db } from "@/lib/db"
import { assertManagerOrOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId, userId } = getSession(req)
    const accessible = req.nextUrl.searchParams.get("accessible") === "true"

    if (accessible) {
      // Resolve caller's role to decide scope
      const caller = await db.user.findFirst({
        where: { id: userId, tenantId },
        select: { role: true },
      })
      // OWNER sees all active branches; MANAGER only sees their UserBranch entries
      if (caller?.role !== "OWNER") {
        const branches = await db.branch.findMany({
          where: { tenantId, active: true, userBranches: { some: { userId } } },
          orderBy: { name: "asc" },
        })
        return NextResponse.json(branches)
      }
    }

    const branches = await db.branch.findMany({
      where: { tenantId, active: true },
      include: { _count: { select: { users: true, sales: true } } },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(branches)
  } catch (error) {
    console.error("[GET /api/branches]", error)
    return NextResponse.json({ error: "Error al obtener sucursales" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await assertManagerOrOwner(req)
    if (denied) return denied
    const { tenantId } = getSession(req)
    const { name, address, phone } = await req.json()

    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 })
    }

    const branch = await db.branch.create({
      data: { tenantId, name, address: address ?? null, phone: phone ?? null },
    })

    return NextResponse.json(branch, { status: 201 })
  } catch (error) {
    console.error("[POST /api/branches]", error)
    return NextResponse.json({ error: "Error al crear sucursal" }, { status: 500 })
  }
}
