import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const product = await db.product.update({
    where: { id, tenantId: DEV_TENANT_ID },
    data: body,
    include: { category: true },
  })

  return NextResponse.json(product)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await db.product.update({
    where: { id, tenantId: DEV_TENANT_ID },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
