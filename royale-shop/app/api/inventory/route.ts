import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getSession(req)
    const { searchParams } = req.nextUrl
    const onlyLowStock = searchParams.get("lowStock") === "true"

    const products = await db.product.findMany({
      where: { tenantId, active: true },
      include: { category: true },
      orderBy: { name: "asc" },
    })

    const enriched = products.map((p) => ({
      ...p,
      lowStock: p.stock <= p.minStock,
    }))

    return NextResponse.json({
      products: onlyLowStock ? enriched.filter((p) => p.lowStock) : enriched,
    })
  } catch (error) {
    console.error("[GET /api/inventory]", error)
    return NextResponse.json({ error: "Error al obtener inventario" }, { status: 500 })
  }
}
