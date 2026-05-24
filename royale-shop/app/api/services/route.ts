import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { tenantId } = getSession(req)
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")

  const services = await db.service.findMany({
    where: {
      tenantId,
      active: true,
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(services)
}

export async function POST(req: NextRequest) {
  const { tenantId } = getSession(req)
  const body = await req.json()
  const { name, price, description, duration, categoryId } = body

  if (!name || !price) {
    return NextResponse.json({ error: "name y price son requeridos" }, { status: 400 })
  }

  const service = await db.service.create({
    data: {
      tenantId,
      name,
      price,
      description: description || null,
      duration: duration || null,
      categoryId: categoryId || null,
    },
    include: { category: true },
  })

  return NextResponse.json(service, { status: 201 })
}
