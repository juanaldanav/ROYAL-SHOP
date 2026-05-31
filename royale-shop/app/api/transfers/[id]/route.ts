import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { assertManagerOrOwner } from "@/lib/rbac"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getSession(req)
    const { id } = await params

    const transfer = await db.transfer.findFirst({
      where: { id, tenantId },
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
    })

    if (!transfer) {
      return NextResponse.json({ error: "Traspaso no encontrado" }, { status: 404 })
    }

    return NextResponse.json(transfer)
  } catch (error) {
    console.error("[GET /api/transfers/[id]]", error)
    return NextResponse.json({ error: "Error al obtener traspaso" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await assertManagerOrOwner(req)
  if (denied) return denied

  try {
    const { tenantId, userId } = getSession(req)
    const { id } = await params
    const body = await req.json()
    const { action } = body // "confirm" | "cancel"

    const transfer = await db.transfer.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })

    if (!transfer) {
      return NextResponse.json({ error: "Traspaso no encontrado" }, { status: 404 })
    }

    if (transfer.status !== "PENDING") {
      return NextResponse.json(
        { error: `El traspaso ya está ${transfer.status === "CONFIRMED" ? "confirmado" : "cancelado"}` },
        { status: 409 }
      )
    }

    if (action === "confirm") {
      const updated = await db.$transaction(async (tx) => {
        const t = await tx.transfer.update({
          where: { id },
          data: {
            status: "CONFIRMED",
            confirmedById: userId,
            confirmedAt: new Date(),
          },
          include: {
            fromBranch: { select: { name: true } },
            toBranch: { select: { name: true } },
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        })

        // Add stock to destination branch
        for (const item of transfer.items) {
          const bs = await tx.branchStock.findUnique({
            where: {
              tenantId_branchId_productId: {
                tenantId,
                branchId: transfer.toBranchId,
                productId: item.productId,
              },
            },
            select: { stock: true },
          })
          await tx.branchStock.upsert({
            where: {
              tenantId_branchId_productId: {
                tenantId,
                branchId: transfer.toBranchId,
                productId: item.productId,
              },
            },
            update: { stock: (bs?.stock ?? 0) + item.quantity },
            create: {
              tenantId,
              branchId: transfer.toBranchId,
              productId: item.productId,
              stock: item.quantity,
            },
          })
        }

        return t
      })

      return NextResponse.json(updated)
    }

    if (action === "cancel") {
      const updated = await db.$transaction(async (tx) => {
        const t = await tx.transfer.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: {
            fromBranch: { select: { name: true } },
            toBranch: { select: { name: true } },
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        })

        // Restore stock to origin branch
        for (const item of transfer.items) {
          const bs = await tx.branchStock.findUnique({
            where: {
              tenantId_branchId_productId: {
                tenantId,
                branchId: transfer.fromBranchId,
                productId: item.productId,
              },
            },
            select: { stock: true },
          })
          await tx.branchStock.upsert({
            where: {
              tenantId_branchId_productId: {
                tenantId,
                branchId: transfer.fromBranchId,
                productId: item.productId,
              },
            },
            update: { stock: (bs?.stock ?? 0) + item.quantity },
            create: {
              tenantId,
              branchId: transfer.fromBranchId,
              productId: item.productId,
              stock: item.quantity,
            },
          })
        }

        return t
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "action debe ser 'confirm' o 'cancel'" }, { status: 400 })
  } catch (error) {
    console.error("[PATCH /api/transfers/[id]]", error)
    return NextResponse.json({ error: "Error al actualizar traspaso" }, { status: 500 })
  }
}
