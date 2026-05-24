import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

function calcProfit(items: { price: unknown; cost: unknown; quantity: number }[]): number {
  return items.reduce(
    (s, i) => s + (Number(i.price) - Number(i.cost ?? 0)) * i.quantity,
    0
  )
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId, branchId: sessionBranchId } = getSession(req)
    const { searchParams } = req.nextUrl
    const allBranches = searchParams.get("allBranches") === "true"
    const overrideBranchId = searchParams.get("branchId")
    // Use explicit branchId param if given, else session branchId (unless allBranches)
    const branchId = overrideBranchId ?? sessionBranchId

    const now = new Date()

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(now)
    startOfWeek.setDate(startOfWeek.getDate() - 7)
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now)
    startOfMonth.setDate(startOfMonth.getDate() - 30)
    startOfMonth.setHours(0, 0, 0, 0)

    const baseWhere = {
      tenantId,
      status: "COMPLETED" as const,
      // Owner/manager can pass allBranches=true to see consolidated stats
      ...(!allBranches ? { branchId } : {}),
    }

    const itemSelect = { price: true, cost: true, quantity: true } as const

    const [
      todayAgg,
      weekAgg,
      monthAgg,
      recentSales,
      todayItems,
      weekItems,
      monthItems,
    ] = await Promise.all([
      db.sale.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfToday, lte: now } },
        _count: true,
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfWeek, lte: now } },
        _count: true,
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfMonth, lte: now } },
        _count: true,
        _sum: { total: true },
      }),
      db.sale.findMany({
        where: baseWhere,
        include: {
          user: { select: { name: true } },
          branch: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.saleItem.findMany({
        where: { sale: { ...baseWhere, createdAt: { gte: startOfToday, lte: now } } },
        select: itemSelect,
      }),
      db.saleItem.findMany({
        where: { sale: { ...baseWhere, createdAt: { gte: startOfWeek, lte: now } } },
        select: itemSelect,
      }),
      db.saleItem.findMany({
        where: { sale: { ...baseWhere, createdAt: { gte: startOfMonth, lte: now } } },
        select: itemSelect,
      }),
    ])

    return NextResponse.json({
      today: {
        count: todayAgg._count,
        total: Number(todayAgg._sum.total ?? 0),
        profit: calcProfit(todayItems),
      },
      week: {
        count: weekAgg._count,
        total: Number(weekAgg._sum.total ?? 0),
        profit: calcProfit(weekItems),
      },
      month: {
        count: monthAgg._count,
        total: Number(monthAgg._sum.total ?? 0),
        profit: calcProfit(monthItems),
      },
      recentSales,
    })
  } catch (error) {
    console.error("[GET /api/dashboard/stats]", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}
