"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ShoppingCart, Receipt, RefreshCw, Store, TrendingUp } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMXN, formatDateTime } from "@/lib/format"
import { useSession } from "@/contexts/session-context"

type SaleItem = { id: string; name: string; quantity: number; price: string }
type Payment = { id: string; method: "CASH" | "CARD" | "TRANSFER"; amount: string }
type Sale = {
  id: string
  folio: string
  createdAt: string
  total: string
  cashAmount: string
  cardAmount: string
  transferAmount: string
  paymentMethod: string
  items: SaleItem[]
  payments?: Payment[]
  branch?: { name: string }
}
type MethodBreakdown = { total: number; count: number; pct: number }
type BranchStat = { id: string; name: string; total: number; count: number; avgTicket: number }
type Stats = {
  today: { count: number; total: number; refunds: number; netTotal: number; profit: number; avgTicket: number }
  yesterday: { count: number; total: number; avgTicket: number }
  week: { count: number; total: number; profit: number }
  month: { count: number; total: number; profit: number }
  paymentMethods: { CASH: MethodBreakdown; CARD: MethodBreakdown; TRANSFER: MethodBreakdown }
  branchStats: BranchStat[]
  recentSales: Sale[]
}
type Branch = { id: string; name: string }

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  MIXED: "Pago Mixto",
}
const METHOD_SHORT: Record<string, string> = { CASH: "Ef", CARD: "Tj", TRANSFER: "Tf" }
const METHOD_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  CASH: "default",
  CARD: "secondary",
  TRANSFER: "outline",
  MIXED: "outline",
}

function getPaymentLines(sale: Sale): { method: string; amount: number }[] {
  if (sale.payments && sale.payments.length > 0) {
    return sale.payments.map((p) => ({ method: p.method, amount: parseFloat(p.amount) }))
  }
  const lines: { method: string; amount: number }[] = []
  if (parseFloat(sale.cashAmount) > 0) lines.push({ method: "CASH", amount: parseFloat(sale.cashAmount) })
  if (parseFloat(sale.cardAmount) > 0) lines.push({ method: "CARD", amount: parseFloat(sale.cardAmount) })
  if (parseFloat(sale.transferAmount) > 0) lines.push({ method: "TRANSFER", amount: parseFloat(sale.transferAmount) })
  return lines
}

function trendLabel(current: number, previous: number, isMoney = false): string {
  const diff = current - previous
  const sign = diff >= 0 ? "↑" : "↓"
  if (isMoney) {
    const pct = previous === 0 ? (current > 0 ? 100 : 0) : Math.abs(Math.round(((current - previous) / previous) * 100))
    return `${sign} ${pct}% vs ayer`
  }
  return `${sign} ${Math.abs(diff)} vs ayer`
}

export default function DashboardPage() {
  const { user } = useSession()
  const isOwnerOrManager = user?.role === "OWNER" || user?.role === "MANAGER"

  const [stats, setStats] = useState<Stats | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!isOwnerOrManager) return
    apiFetch("/api/branches")
      .then((r) => r.json())
      .then((data: Branch[]) => setBranches(data))
      .catch(() => {})
  }, [isOwnerOrManager])

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setFetchError(false)
    try {
      const params = new URLSearchParams()
      if (isOwnerOrManager && selectedBranch === "all") {
        params.set("allBranches", "true")
      } else if (isOwnerOrManager && selectedBranch !== "all") {
        params.set("branchId", selectedBranch)
      }
      const res = await apiFetch(`/api/dashboard/stats?${params}`)
      if (!res.ok) throw new Error()
      setStats(await res.json())
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isOwnerOrManager, selectedBranch])

  useEffect(() => { fetchStats() }, [fetchStats])

  const branchLabel = selectedBranch === "all"
    ? "Todas las sucursales"
    : branches.find((b) => b.id === selectedBranch)?.name ?? "Sucursal"

  const showBranchStats = isOwnerOrManager && selectedBranch === "all" && (stats?.branchStats.length ?? 0) > 1
  const totalAllBranches = stats?.branchStats.reduce((s, b) => s + b.total, 0) ?? 0
  const grandMethodTotal = stats
    ? (stats.paymentMethods.CASH.total + stats.paymentMethods.CARD.total + stats.paymentMethods.TRANSFER.total)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {isOwnerOrManager && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Store className="size-3.5" />
              {branchLabel}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isOwnerOrManager && branches.length > 1 && (
            <Select value={selectedBranch} onValueChange={(v) => setSelectedBranch(v ?? "all")}>
              <SelectTrigger className="w-44 min-h-[44px]">
                <SelectValue placeholder="Todas las sucursales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={async () => { await fetchStats(true); toast.success("Estadísticas actualizadas") }}
            disabled={refreshing}
            aria-label="Actualizar"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/pos">
            <Button className="min-h-[44px] px-5 text-base font-semibold">
              <ShoppingCart className="size-5 mr-2" />
              Ir al POS
            </Button>
          </Link>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 mb-4 text-sm text-muted-foreground border border-border">
          <span>No se pudo conectar al servidor</span>
          <button onClick={() => fetchStats()} className="text-xs font-medium underline underline-offset-2">Reintentar</button>
        </div>
      )}

      {/* KPI Cards — Hoy vs Ayer */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-3 sm:p-5">
              <Skeleton className="h-2.5 w-14 mb-2" />
              <Skeleton className="h-7 w-20 mb-1.5" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              label="Ventas Brutas"
              value={formatMXN(stats?.today.total ?? 0)}
              trend={trendLabel(stats?.today.total ?? 0, stats?.yesterday.total ?? 0, true)}
              detail={`vs ${formatMXN(stats?.yesterday.total ?? 0)} ayer`}
              up={(stats?.today.total ?? 0) >= (stats?.yesterday.total ?? 0)}
            />
            <KpiCard
              label="Devoluciones"
              value={formatMXN(stats?.today.refunds ?? 0)}
              trend={(stats?.today.refunds ?? 0) > 0 ? "↓ hoy" : "Sin devoluciones"}
              detail=""
              up={false}
              isRefund
            />
            <KpiCard
              label="Ventas Netas"
              value={formatMXN(stats?.today.netTotal ?? 0)}
              trend={trendLabel(stats?.today.netTotal ?? 0, stats?.yesterday.total ?? 0, true)}
              detail={`${stats?.today.count ?? 0} ticket${(stats?.today.count ?? 0) !== 1 ? "s" : ""}`}
              up={(stats?.today.netTotal ?? 0) >= (stats?.yesterday.total ?? 0)}
            />
          </>
        )}
      </div>

      {/* Semana / Mes */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6">
        {loading ? (
          [0, 1].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-3 sm:p-4">
              <Skeleton className="h-2.5 w-20 mb-2" />
              <Skeleton className="h-6 w-24 mb-1" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-white rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Receipt className="size-3 shrink-0" />Esta Semana
              </p>
              <p className="text-lg sm:text-2xl font-black tracking-tight tabular-nums">{formatMXN(stats?.week.total ?? 0)}</p>
              <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mt-0.5">Util. {formatMXN(stats?.week.profit ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">{stats?.week.count ?? 0} ventas</p>
            </div>
            <div className="bg-white rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <TrendingUp className="size-3 shrink-0" />Este Mes
              </p>
              <p className="text-lg sm:text-2xl font-black tracking-tight tabular-nums">{formatMXN(stats?.month.total ?? 0)}</p>
              <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mt-0.5">Util. {formatMXN(stats?.month.profit ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">{stats?.month.count ?? 0} ventas</p>
            </div>
          </>
        )}
      </div>

      {/* Métodos de pago */}
      {!loading && grandMethodTotal > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Métodos de pago hoy</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {(["CASH", "CARD", "TRANSFER"] as const).map((key) => {
              const data = stats?.paymentMethods[key] ?? { total: 0, count: 0, pct: 0 }
              return (
                <div key={key} className="bg-white rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {METHOD_LABEL[key]}
                  </p>
                  <p className="text-sm sm:text-xl font-black tracking-tight truncate tabular-nums">{formatMXN(data.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{data.count} ticket{data.count !== 1 ? "s" : ""}</p>
                  <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-foreground rounded-full" style={{ width: `${data.pct}%` }} />
                  </div>
                  <p className="text-xs font-bold text-[var(--rs-gold)] mt-1.5">{data.pct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Por sucursal */}
      {!loading && showBranchStats && (
        <div className="mb-6">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Por sucursal hoy</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            {stats!.branchStats.map((branch) => (
              <div key={branch.id} className="bg-white rounded-2xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-bold">{branch.name}</p>
                  <span className="text-xs font-bold text-[#1A7A2E] bg-[#F0FBF3] px-2.5 py-1 rounded-full">
                    Abierta
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight mb-3 tabular-nums">
                  {formatMXN(branch.total)}
                </p>
                <div className="flex gap-4 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Tickets</p>
                    <p className="text-base font-black mt-0.5">{branch.count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Ticket prom.</p>
                    <p className="text-base font-black mt-0.5 tabular-nums">{formatMXN(branch.avgTicket)}</p>
                  </div>
                </div>
                {totalAllBranches > 0 && (
                  <>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--rs-gold)] rounded-full"
                        style={{ width: `${Math.round((branch.total / totalAllBranches) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {Math.round((branch.total / totalAllBranches) * 100)}% del total del día
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ventas recientes */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Ventas recientes</p>
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                {isOwnerOrManager && selectedBranch === "all" && (
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Sucursal</th>
                )}
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Método</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Artículos</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3 flex justify-center"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : !stats || stats.recentSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Sin ventas registradas todavía.
                  </td>
                </tr>
              ) : (
                stats.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    {isOwnerOrManager && selectedBranch === "all" && (
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {sale.branch?.name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                      {formatMXN(parseFloat(sale.total))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge variant={METHOD_VARIANT[sale.paymentMethod] ?? "outline"}>
                          {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                        </Badge>
                        {sale.paymentMethod === "MIXED" && (
                          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {getPaymentLines(sale)
                              .map((p) => `${METHOD_SHORT[p.method] ?? p.method} ${formatMXN(p.amount)}`)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {sale.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  trend,
  detail,
  up,
  isRefund = false,
}: {
  label: string
  value: string
  trend: string
  detail: string
  up: boolean
  isRefund?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2.5 truncate">
        {label}
      </p>
      <p className={`text-lg sm:text-3xl font-black tracking-tight truncate tabular-nums ${isRefund && value !== "$0.00" ? "text-destructive" : "text-foreground"}`}>
        {isRefund && value !== "$0.00" ? `- ${value}` : value}
      </p>
      <div className="flex items-center gap-1 mt-1 sm:mt-1.5 min-w-0">
        <span className={`text-[10px] sm:text-xs font-bold shrink-0 ${isRefund ? "text-destructive" : up ? "text-[var(--rs-gold)]" : "text-destructive"}`}>
          {trend}
        </span>
        {detail && <span className="text-[10px] text-muted-foreground hidden sm:block truncate">{detail}</span>}
      </div>
    </div>
  )
}
