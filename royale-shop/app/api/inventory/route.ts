import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId, branchId } = getSession(req)
    const { searchParams } = req.nextUrl
    const onlyLowStock = searchParams.get("lowStock") === "true"
    const overrideBranch = searchParams.get("branchId") ?? branchId

    const products = await db.product.findMany({
      where: { tenantId, active: true },
      include: {
        category: { select: { id: true, name: true } },
        branchStocks: {
          where: { branchId: overrideBranch },
          select: { stock: true, minStock: true },
        },
      },
      orderBy: { name: "asc" },
    })

    const enriched = products.map((p) => {
      const bs = p.branchStocks[0]
      const stock = bs?.stock ?? 0
      const minStock = bs?.minStock ?? 0
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        active: p.active,
        category: p.category,
        stock,
        minStock,
        lowStock: stock <= minStock,
      }
    })

    return NextResponse.json({
      products: onlyLowStock ? enriched.filter((p) => p.lowStock) : enriched,
    })
  } catch (error) {
    console.error("[GET /api/inventory]", error)
    return NextResponse.json({ error: "Error al obtener inventario" }, { status: 500 })
  }
}
