import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

// PATCH /api/inventory/[id] — adjust stock for a product
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params
    const body = await req.json()

    const product = await db.product.findFirst({ where: { id, tenantId } })
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const updates: { stock?: number; minStock?: number } = {}

    if (body.stock !== undefined) {
      updates.stock = Math.max(0, Number(body.stock))
    }
    if (body.delta !== undefined) {
      // Relative adjustment: +5 or -3
      updates.stock = Math.max(0, product.stock + Number(body.delta))
    }
    if (body.minStock !== undefined) {
      updates.minStock = Math.max(0, Number(body.minStock))
    }

    const updated = await db.product.update({
      where: { id },
      data: updates,
      select: { id: true, name: true, stock: true, minStock: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/inventory/[id]]", error)
    return NextResponse.json({ error: "Error al ajustar stock" }, { status: 500 })
  }
}
