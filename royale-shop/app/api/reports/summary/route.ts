import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

type Period = "today" | "week" | "month"

function getDateRange(period: Period): { gte: Date; lte: Date } {
  const now = new Date()
  const lte = now

  if (period === "today") {
    const gte = new Date(now)
    gte.setHours(0, 0, 0, 0)
    return { gte, lte }
  }

  if (period === "week") {
    const gte = new Date(now)
    gte.setDate(gte.getDate() - 7)
    gte.setHours(0, 0, 0, 0)
    return { gte, lte }
  }

  // month
  const gte = new Date(now)
  gte.setDate(gte.getDate() - 30)
  gte.setHours(0, 0, 0, 0)
  return { gte, lte }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getSession(req)
    const { searchParams } = req.nextUrl
    const period = (searchParams.get("period") ?? "today") as Period
    const branchId = searchParams.get("branchId") // null = all branches

    const dateRange = getDateRange(period)

    const baseWhere = {
      tenantId,
      status: "COMPLETED" as const,
      createdAt: dateRange,
      ...(branchId ? { branchId } : {}),
    }

    const [agg, byBranch, byMethod, topItems] = await Promise.all([
      db.sale.aggregate({
        where: baseWhere,
        _count: true,
        _sum: { total: true, discount: true },
      }),

      db.sale.groupBy({
        by: ["branchId"],
        where: baseWhere,
        _count: true,
        _sum: { total: true },
        orderBy: { _sum: { total: "desc" } },
      }),

      db.sale.groupBy({
        by: ["paymentMethod"],
        where: baseWhere,
        _count: true,
        _sum: { total: true },
      }),

      db.saleItem.groupBy({
        by: ["name"],
        where: {
          sale: baseWhere,
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { subtotal: "desc" } },
        take: 5,
      }),
    ])

    // Enrich byBranch with branch names
    const branchIds = byBranch.map((b) => b.branchId)
    const branches = branchIds.length
      ? await db.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : []
    const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]))

    return NextResponse.json({
      period,
      branchId: branchId ?? "all",
      summary: {
        count: agg._count,
        total: Number(agg._sum.total ?? 0),
        discount: Number(agg._sum.discount ?? 0),
      },
      byBranch: byBranch.map((b) => ({
        branchId: b.branchId,
        branchName: branchMap[b.branchId] ?? b.branchId,
        count: b._count,
        total: Number(b._sum.total ?? 0),
      })),
      byMethod: byMethod.map((m) => ({
        method: m.paymentMethod,
        count: m._count,
        total: Number(m._sum.total ?? 0),
      })),
      topItems: topItems.map((t) => ({
        name: t.name,
        qty: t._sum.quantity ?? 0,
        total: Number(t._sum.subtotal ?? 0),
      })),
    })
  } catch (error) {
    console.error("[GET /api/reports/summary]", error)
    return NextResponse.json({ error: "Error al obtener reporte" }, { status: 500 })
  }
}
