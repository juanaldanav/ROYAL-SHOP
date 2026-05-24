"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { TrendingUp, ShoppingCart, Receipt, RefreshCw, Store } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
type Sale = {
  id: string
  folio: string
  createdAt: string
  total: string
  paymentMethod: "CASH" | "CARD" | "TRANSFER"
  items: SaleItem[]
  branch?: { name: string }
}
type Stats = {
  today: { count: number; total: number }
  week: { count: number; total: number }
  month: { count: number; total: number }
  recentSales: Sale[]
}
type Branch = { id: string; name: string }

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
}
const METHOD_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  CASH: "default",
  CARD: "secondary",
  TRANSFER: "outline",
}

export default function DashboardPage() {
  const { user } = useSession()
  const isOwnerOrManager = user?.role === "OWNER" || user?.role === "MANAGER"

  const [stats, setStats] = useState<Stats | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch branches once for owner/manager
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
      toast.error("No se pudieron cargar las estadísticas")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isOwnerOrManager, selectedBranch])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  async function handleRefresh() {
    await fetchStats(true)
    toast.success("Estadísticas actualizadas")
  }

  const branchLabel =
    selectedBranch === "all"
      ? "Todas las sucursales"
      : branches.find((b) => b.id === selectedBranch)?.name ?? "Sucursal"

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
          {/* Branch selector — only for OWNER/MANAGER */}
          {isOwnerOrManager && branches.length > 1 && (
            <Select value={selectedBranch} onValueChange={(v) => setSelectedBranch(v ?? "all")}>
              <SelectTrigger className="w-44 min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleRefresh}
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-5 w-32" />
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              icon={<TrendingUp className="size-5 text-primary" />}
              label="Hoy"
              count={stats?.today.count ?? 0}
              total={stats?.today.total ?? 0}
            />
            <MetricCard
              icon={<Receipt className="size-5 text-primary" />}
              label="Esta Semana"
              count={stats?.week.count ?? 0}
              total={stats?.week.total ?? 0}
            />
            <MetricCard
              icon={<TrendingUp className="size-5 text-primary" />}
              label="Este Mes"
              count={stats?.month.count ?? 0}
              total={stats?.month.total ?? 0}
            />
          </>
        )}
      </div>

      {/* Recent Sales */}
      <h2 className="text-lg font-semibold mb-3">Ventas Recientes</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
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
                  <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    {isOwnerOrManager && selectedBranch === "all" && (
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {sale.branch?.name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatMXN(parseFloat(sale.total))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={METHOD_VARIANT[sale.paymentMethod] ?? "outline"}>
                        {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                      </Badge>
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
      </Card>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  count,
  total,
}: {
  icon: React.ReactNode
  label: string
  count: number
  total: number
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3 text-muted-foreground text-sm font-medium">
        {icon}
        {label}
      </div>
      <p className="text-3xl font-bold mb-1">{count}</p>
      <p className="text-base text-muted-foreground font-mono">{formatMXN(total)}</p>
    </Card>
  )
}
