import { db } from "@/lib/db"
import { assertManagerOrOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await assertManagerOrOwner(req)
  if (denied) return denied
  const { id } = await params
  const { tenantId, branchId: sessionBranchId } = getSession(req)
  const body = await req.json()

  const {
    name,
    sku,
    barcode,
    price,
    cost,
    categoryId,
    description,
    imageUrl,
    active,
    stock,
    minStock,
    branchId,
  } = body

  // Build product update data — only allowed fields
  const productData: Record<string, unknown> = {}
  if (name !== undefined) productData.name = name
  if (sku !== undefined) productData.sku = sku
  if (barcode !== undefined) productData.barcode = barcode
  if (price !== undefined) productData.price = price
  if (cost !== undefined) productData.cost = cost
  if (categoryId !== undefined) productData.categoryId = categoryId
  if (description !== undefined) productData.description = description
  if (imageUrl !== undefined) productData.imageUrl = imageUrl
  if (active !== undefined) productData.active = active

  const product = await db.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id, tenantId },
      data: productData,
      include: {
        category: true,
        branchStocks: {
          include: {
            branch: { select: { id: true, name: true } },
          },
        },
      },
    })

    // Update branchStock if stock or minStock provided
    if (stock !== undefined || minStock !== undefined) {
      const targetBranchId = branchId || sessionBranchId
      await tx.branchStock.upsert({
        where: {
          tenantId_branchId_productId: {
            tenantId,
            branchId: targetBranchId,
            productId: id,
          },
        },
        update: {
          ...(stock !== undefined ? { stock: parseInt(stock) } : {}),
          ...(minStock !== undefined ? { minStock: parseInt(minStock) } : {}),
        },
        create: {
          tenantId,
          branchId: targetBranchId,
          productId: id,
          stock: stock !== undefined ? parseInt(stock) : 0,
          minStock: minStock !== undefined ? parseInt(minStock) : 0,
        },
      })
    }

    return p
  })

  return NextResponse.json(product)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await assertManagerOrOwner(req)
  if (denied) return denied
  const { id } = await params
  const { tenantId } = getSession(req)

  await db.product.update({
    where: { id, tenantId },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
