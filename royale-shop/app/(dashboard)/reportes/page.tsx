"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { formatMXN } from "@/lib/format"
import { apiFetch } from "@/lib/api-client"

type Branch = { id: string; name: string }

type Summary = {
  period: string
  branchId: string
  summary: { count: number; total: number; discount: number }
  byBranch: { branchId: string; branchName: string; count: number; total: number }[]
  byMethod: { method: string; count: number; total: number }[]
  topItems: { name: string; qty: number; total: number }[]
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  MIXED: "Mixto",
}

const PERIOD_LABEL: Record<string, string> = {
  today: "Hoy",
  week: "Últimos 7 días",
  month: "Últimos 30 días",
}

export default function ReportesPage() {
  const [period, setPeriod] = useState("today")
  const [branchId, setBranchId] = useState("all")
  const [branches, setBranches] = useState<Branch[]>([])
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchBranches() {
    try {
      const res = await apiFetch("/api/branches")
      if (res.ok) setBranches(await res.json())
    } catch {}
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (branchId !== "all") params.set("branchId", branchId)
      const res = await apiFetch(`/api/reports/summary?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error("Error al cargar el reporte")
    } finally {
      setLoading(false)
    }
  }, [period, branchId])

  useEffect(() => { fetchBranches() }, [])
  useEffect(() => { fetchReport() }, [fetchReport])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis de ventas en tiempo real</p>
        </div>
        <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
          onClick={fetchReport} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={period} onValueChange={(v) => setPeriod(v ?? "")}>
          <SelectTrigger className="w-48 min-h-[44px]">
            <SelectValue>
              {(v: string | null) => ({ today: "Hoy", week: "Últimos 7 días", month: "Últimos 30 días" }[v ?? ""] ?? "Período")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Últimos 7 días</SelectItem>
            <SelectItem value="month">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>

        <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
          <SelectTrigger className="w-48 min-h-[44px]">
            <SelectValue>
              {(v: string | null) => !v || v === "all" ? "Todas las sucursales" : (branches.find(b => b.id === v)?.name ?? v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-36" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  Total Ventas — {PERIOD_LABEL[data.period]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">{formatMXN(data.summary.total)}</p>
                <p className="text-xs text-muted-foreground">{data.summary.count} transacción(es)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">Promedio por Venta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  {data.summary.count > 0
                    ? formatMXN(data.summary.total / data.summary.count)
                    : formatMXN(0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">Descuentos Aplicados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-destructive">
                  {formatMXN(data.summary.discount)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* By branch */}
            {data.byBranch.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por Sucursal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byBranch.map((b) => (
                    <div key={b.branchId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{b.branchName}</span>
                        <span className="font-mono font-medium">{formatMXN(b.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{b.count} venta(s)</div>
                      <Separator className="mt-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* By payment method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.byMethod.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin ventas en este período</p>
                ) : (
                  data.byMethod.map((m) => (
                    <div key={m.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{METHOD_LABEL[m.method] ?? m.method}</span>
                        <span className="font-mono font-medium">{formatMXN(m.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{m.count} venta(s)</div>
                      <Separator className="mt-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top items */}
            {data.topItems.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="size-4" /> Top Productos / Servicios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Nombre</th>
                        <th className="text-right py-2 font-medium">Cant.</th>
                        <th className="text-right py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topItems.map((t, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{t.name}</td>
                          <td className="py-2 text-right">{t.qty}</td>
                          <td className="py-2 text-right font-mono">{formatMXN(t.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
