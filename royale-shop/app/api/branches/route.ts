import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getSession(req)

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
