import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { tenantId, branchId } = getSession(req)
    const { searchParams } = req.nextUrl
    const status = searchParams.get("status")
    const direction = searchParams.get("direction") // "out" | "in" | null (both)

    const transfers = await db.transfer.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as "PENDING" | "CONFIRMED" | "CANCELLED" } : {}),
        ...(direction === "out"
          ? { fromBranchId: branchId }
          : direction === "in"
          ? { toBranchId: branchId }
          : {}),
      },
      include: {
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
        createdBy: { select: { name: true } },
        confirmedBy: { select: { name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json(transfers)
  } catch (error) {
    console.error("[GET /api/transfers]", error)
    return NextResponse.json({ error: "Error al obtener traspasos" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, branchId, userId } = getSession(req)
    const body = await req.json()
    const { toBranchId, notes, items } = body

    if (!toBranchId) {
      return NextResponse.json({ error: "toBranchId requerido" }, { status: 400 })
    }
    if (toBranchId === branchId) {
      return NextResponse.json({ error: "La sucursal de origen y destino deben ser diferentes" }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos un producto" }, { status: 400 })
    }

    // Validate all products exist and have enough stock
    const productIds: string[] = items.map((i: { productId: string }) => i.productId)
    const stocks = await db.branchStock.findMany({
      where: { tenantId, branchId, productId: { in: productIds } },
    })
    const stockMap = Object.fromEntries(stocks.map((s) => [s.productId, s.stock]))

    for (const item of items) {
      const available = stockMap[item.productId] ?? 0
      if (item.quantity > available) {
        return NextResponse.json(
          { error: `Stock insuficiente para el producto ${item.productId}. Disponible: ${available}` },
          { status: 409 }
        )
      }
    }

    // Create transfer and reserve stock (deduct from origin immediately on PENDING)
    const transfer = await db.$transaction(async (tx) => {
      const t = await tx.transfer.create({
        data: {
          tenantId,
          fromBranchId: branchId,
          toBranchId,
          createdById: userId,
          notes: notes ?? null,
          status: "PENDING",
          items: {
            create: items.map((i: { productId: string; quantity: number }) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        include: {
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      })

      // Reserve stock: deduct from origin branch immediately
      for (const item of items) {
        const bs = await tx.branchStock.findUnique({
          where: { tenantId_branchId_productId: { tenantId, branchId, productId: item.productId } },
          select: { stock: true },
        })
        await tx.branchStock.upsert({
          where: { tenantId_branchId_productId: { tenantId, branchId, productId: item.productId } },
          update: { stock: Math.max(0, (bs?.stock ?? 0) - item.quantity) },
          create: { tenantId, branchId, productId: item.productId, stock: 0 },
        })
      }

      return t
    })

    return NextResponse.json(transfer, { status: 201 })
  } catch (error) {
    console.error("[POST /api/transfers]", error)
    return NextResponse.json({ error: "Error al crear traspaso" }, { status: 500 })
  }
}
