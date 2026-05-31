import { db } from "@/lib/db"
import { assertManagerOrOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { tenantId } = getSession(req)
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")
  const includeInactive = searchParams.get("includeInactive") === "true"

  const categories = await db.category.findMany({
    where: {
      tenantId,
      ...(!includeInactive ? { active: true } : {}),
      ...(type ? { type: type as "PRODUCT" | "SERVICE" } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const denied = await assertManagerOrOwner(req)
  if (denied) return denied
  const { tenantId } = getSession(req)
  const body = await req.json()
  const { name, type } = body

  if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 })

  const category = await db.category.create({
    data: { tenantId, name, type: type ?? "PRODUCT" },
  })

  return NextResponse.json(category, { status: 201 })
}
