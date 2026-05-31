import { db } from "@/lib/db"
import { assertManagerOrOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

// GET /api/reports/inventory — reporte xlsx de inventario.
// Columnas: Producto, SKU, Categoría, Stock <sucursal>… , Mín. <sucursal>… ,
// Última venta, Costo, Precio. Filtrado por tenantId. Solo OWNER/MANAGER.
// Las columnas de sucursal son dinámicas (multitenant): una por cada Branch
// activo del tenant — para el tenant demo da Explanada + Sendero.
export async function GET(req: NextRequest) {
  const denied = await assertManagerOrOwner(req)
  if (denied) return denied

  const { tenantId } = getSession(req)

  try {
    const branches = await db.branch.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })

    const products = await db.product.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        cost: true,
        price: true,
        category: { select: { name: true } },
        branchStocks: { select: { branchId: true, stock: true, minStock: true } },
      },
    })

    // Última venta por producto: MAX(Sale.createdAt) sobre ventas COMPLETED.
    const ids = products.map((p) => p.id)
    const lastSale: Record<string, Date> = {}
    if (ids.length > 0) {
      const items = await db.saleItem.findMany({
        where: { productId: { in: ids }, sale: { tenantId, status: "COMPLETED" } },
        select: { productId: true, sale: { select: { createdAt: true } } },
        orderBy: { sale: { createdAt: "desc" } },
      })
      for (const it of items) {
        if (it.productId && !lastSale[it.productId]) {
          lastSale[it.productId] = it.sale.createdAt
        }
      }
    }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Inventario")
    ws.columns = [
      { header: "Producto", key: "name", width: 32 },
      { header: "SKU", key: "sku", width: 16 },
      { header: "Categoría", key: "cat", width: 18 },
      ...branches.map((b) => ({ header: `Stock ${b.name}`, key: `stock_${b.id}`, width: 14 })),
      ...branches.map((b) => ({ header: `Mín. ${b.name}`, key: `min_${b.id}`, width: 13 })),
      { header: "Última venta", key: "last", width: 20 },
      { header: "Costo", key: "cost", width: 12 },
      { header: "Precio", key: "price", width: 12 },
    ]
    ws.getRow(1).font = { bold: true }

    for (const p of products) {
      const row: Record<string, unknown> = {
        name: p.name,
        sku: p.sku ?? "",
        cat: p.category?.name ?? "",
        last: lastSale[p.id] ?? "",
        cost: p.cost != null ? Number(p.cost) : "",
        price: Number(p.price),
      }
      for (const b of branches) {
        const bs = p.branchStocks.find((s) => s.branchId === b.id)
        row[`stock_${b.id}`] = bs?.stock ?? 0
        row[`min_${b.id}`] = bs?.minStock ?? 0
      }
      ws.addRow(row)
    }

    const buffer = await wb.xlsx.writeBuffer()
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inventario_${today}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("[GET /api/reports/inventory]", error)
    return NextResponse.json({ error: "Error al generar el reporte" }, { status: 500 })
  }
}
