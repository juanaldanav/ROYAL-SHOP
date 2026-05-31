import { db } from "@/lib/db"
import { getUserRole } from "@/lib/rbac"
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
    const role = await getUserRole(req)

    const { searchParams } = req.nextUrl
    // CASHIER solo puede ver su propia sucursal — ignorar allBranches y branchId override
    const isCashier = role === "CASHIER" || role === null
    const allBranches = !isCashier && searchParams.get("allBranches") === "true"
    const overrideBranchId = isCashier ? null : searchParams.get("branchId")
    const branchId = overrideBranchId ?? sessionBranchId

    const now = new Date()

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)

    const startOfWeek = new Date(now)
    startOfWeek.setDate(startOfWeek.getDate() - 7)
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now)
    startOfMonth.setDate(startOfMonth.getDate() - 30)
    startOfMonth.setHours(0, 0, 0, 0)

    const baseWhere = {
      tenantId,
      status: "COMPLETED" as const,
      ...(!allBranches ? { branchId } : {}),
    }

    const itemSelect = { price: true, cost: true, quantity: true } as const

    const [
      todayAgg,
      yesterdayAgg,
      weekAgg,
      monthAgg,
      recentSales,
      todayItems,
      weekItems,
      monthItems,
      todaySalesForPayments,
      todayRefundsAgg,
    ] = await Promise.all([
      db.sale.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfToday, lte: now } },
        _count: true,
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfYesterday, lt: startOfToday } },
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
          payments: true,
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
      // Ventas de hoy con payments + campos inline para calcular breakdown real
      db.sale.findMany({
        where: { ...baseWhere, createdAt: { gte: startOfToday, lte: now } },
        select: {
          total: true,
          paymentMethod: true,
          cashAmount: true,
          cardAmount: true,
          transferAmount: true,
          payments: { select: { method: true, amount: true } },
        },
      }),
      // Devoluciones en efectivo del día (cancelaciones post-corte)
      db.cashMovement.aggregate({
        where: {
          tenantId,
          ...(!allBranches ? { branchId } : {}),
          type: "REFUND",
          createdAt: { gte: startOfToday, lte: now },
        },
        _sum: { amount: true },
      }),
    ])

    // Breakdown por método: Payment records para ventas nuevas, inline fields para ventas viejas
    const todayTotal = Number(todayAgg._sum.total ?? 0)
    const pmTotals: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 }
    const pmCounts: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 }

    for (const sale of todaySalesForPayments) {
      if (sale.payments.length > 0) {
        // Venta nueva — usar Payment records (desglose exacto)
        for (const p of sale.payments) {
          const m = p.method as string
          if (m in pmTotals) {
            pmTotals[m] += Number(p.amount)
            pmCounts[m] += 1
          }
        }
      } else if (sale.paymentMethod === "MIXED") {
        // Venta vieja MIXED — fallback a campos inline
        pmTotals.CASH += Number(sale.cashAmount) || 0
        pmTotals.CARD += Number(sale.cardAmount) || 0
        pmTotals.TRANSFER += Number(sale.transferAmount) || 0
        if ((Number(sale.cashAmount) || 0) > 0) pmCounts.CASH += 1
        if ((Number(sale.cardAmount) || 0) > 0) pmCounts.CARD += 1
        if ((Number(sale.transferAmount) || 0) > 0) pmCounts.TRANSFER += 1
      } else {
        // Venta vieja de un solo método — usar total de la venta
        const m = sale.paymentMethod as string
        if (m in pmTotals) {
          pmTotals[m] += Number(sale.total)
          pmCounts[m] += 1
        }
      }
    }

    const paymentMethods: Record<string, { total: number; count: number; pct: number }> = {
      CASH:     { total: pmTotals.CASH,     count: pmCounts.CASH,     pct: todayTotal > 0 ? Math.round((pmTotals.CASH     / todayTotal) * 100) : 0 },
      CARD:     { total: pmTotals.CARD,     count: pmCounts.CARD,     pct: todayTotal > 0 ? Math.round((pmTotals.CARD     / todayTotal) * 100) : 0 },
      TRANSFER: { total: pmTotals.TRANSFER, count: pmCounts.TRANSFER, pct: todayTotal > 0 ? Math.round((pmTotals.TRANSFER / todayTotal) * 100) : 0 },
    }

    // Per-branch breakdown (only when allBranches=true)
    let branchStats: unknown[] = []
    if (allBranches) {
      const activeBranches = await db.branch.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true },
      })
      branchStats = await Promise.all(
        activeBranches.map(async (branch) => {
          const agg = await db.sale.aggregate({
            where: {
              tenantId,
              branchId: branch.id,
              status: "COMPLETED",
              createdAt: { gte: startOfToday, lte: now },
            },
            _count: true,
            _sum: { total: true },
          })
          const total = Number(agg._sum.total ?? 0)
          const count = agg._count
          return {
            id: branch.id,
            name: branch.name,
            total,
            count,
            avgTicket: count > 0 ? total / count : 0,
          }
        })
      )
    }

    const todayCount = todayAgg._count
    const yesterdayTotal = Number(yesterdayAgg._sum.total ?? 0)
    const yesterdayCount = yesterdayAgg._count
    const todayRefunds = Number(todayRefundsAgg._sum.amount ?? 0)

    return NextResponse.json({
      today: {
        count: todayCount,
        total: todayTotal,
        refunds: todayRefunds,
        netTotal: todayTotal - todayRefunds,
        profit: calcProfit(todayItems),
        avgTicket: todayCount > 0 ? todayTotal / todayCount : 0,
      },
      yesterday: {
        count: yesterdayCount,
        total: yesterdayTotal,
        avgTicket: yesterdayCount > 0 ? yesterdayTotal / yesterdayCount : 0,
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
      paymentMethods,
      branchStats,
      recentSales,
    })
  } catch (error) {
    console.error("[GET /api/dashboard/stats]", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}
