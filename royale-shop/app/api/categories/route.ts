import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")

  const categories = await db.category.findMany({
    where: {
      tenantId: DEV_TENANT_ID,
      active: true,
      ...(type ? { type: type as "PRODUCT" | "SERVICE" } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, type } = body

  if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 })

  const category = await db.category.create({
    data: {
      tenantId: DEV_TENANT_ID,
      name,
      type: type ?? "PRODUCT",
    },
  })

  return NextResponse.json(category, { status: 201 })
}
