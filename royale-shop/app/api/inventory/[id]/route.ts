import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { assertManagerOrOwner } from "@/lib/rbac"
import { NextRequest, NextResponse } from "next/server"

// PATCH /api/inventory/[id] — adjust BranchStock for a product
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await assertManagerOrOwner(req)
  if (denied) return denied

  try {
    const { tenantId, branchId: sessionBranchId } = getSession(req)
    const { id: productId } = await params
    const body = await req.json()
    const targetBranchId = body.branchId ?? sessionBranchId

    const product = await db.product.findFirst({ where: { id: productId, tenantId } })
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const existing = await db.branchStock.findUnique({
      where: { tenantId_branchId_productId: { tenantId, branchId: targetBranchId, productId } },
    })

    const currentStock = existing?.stock ?? 0
    const currentMinStock = existing?.minStock ?? 0

    let newStock = currentStock
    if (body.stock !== undefined) newStock = Math.max(0, Number(body.stock))
    if (body.delta !== undefined) newStock = Math.max(0, currentStock + Number(body.delta))

    const newMinStock = body.minStock !== undefined
      ? Math.max(0, Number(body.minStock))
      : currentMinStock

    const updated = await db.branchStock.upsert({
      where: { tenantId_branchId_productId: { tenantId, branchId: targetBranchId, productId } },
      create: { tenantId, branchId: targetBranchId, productId, stock: newStock, minStock: newMinStock },
      update: { stock: newStock, minStock: newMinStock },
      select: { productId: true, stock: true, minStock: true, branchId: true },
    })

    return NextResponse.json({ id: productId, ...updated })
  } catch (error) {
    console.error("[PATCH /api/inventory/[id]]", error)
    return NextResponse.json({ error: "Error al ajustar stock" }, { status: 500 })
  }
}
