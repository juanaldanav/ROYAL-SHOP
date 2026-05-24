import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// Limpia TODOS los datos de prueba — deja tenant, sucursales y usuarios intactos.
// Requiere ?secret=RESET_SECRET en la URL.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret")
  const expected = process.env.RESET_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    await db.$transaction([
      db.transferItem.deleteMany(),
      db.transfer.deleteMany(),
      db.saleItem.deleteMany(),
      db.sale.deleteMany(),
      db.cashCut.deleteMany(),
      db.branchStock.deleteMany(),
      db.product.deleteMany(),
      db.service.deleteMany(),
      db.category.deleteMany(),
    ])

    return NextResponse.json({
      ok: true,
      message: "Base de datos limpiada. Tenant, sucursales y usuarios conservados.",
    })
  } catch (error) {
    console.error("[POST /api/admin/reset]", error)
    return NextResponse.json({ error: "Error al limpiar la base de datos" }, { status: 500 })
  }
}
