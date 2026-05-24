import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sale = await db.sale.findFirst({
      where: {
        id,
        tenantId: DEV_TENANT_ID,
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            service: { select: { name: true } },
          },
        },
        user: { select: { name: true } },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error("[GET /api/sales/[id]]", error)
    return NextResponse.json({ error: "Error al obtener la venta" }, { status: 500 })
  }
}
