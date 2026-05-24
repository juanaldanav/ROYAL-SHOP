"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMXN, formatDate, formatDateTime } from "@/lib/format"

type SaleItem = {
  id: string
  name: string
  price: string
  quantity: number
  subtotal: string
}

type Sale = {
  id: string
  folio: string
  createdAt: string
  customerName: string | null
  customerPhone: string | null
  total: string
  change: string
  paymentMethod: "CASH" | "CARD" | "TRANSFER"
  status: "COMPLETED" | "REFUNDED" | "CANCELLED"
  items: SaleItem[]
  user: { name: string } | null
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completada",
  REFUNDED: "Devuelta",
  CANCELLED: "Cancelada",
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  COMPLETED: "default",
  REFUNDED: "secondary",
  CANCELLED: "destructive",
}

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [detail, setDetail] = useState<Sale | null>(null)

  async function fetchSales() {
    try {
      const res = await apiFetch("/api/sales?limit=50")
      if (!res.ok) throw new Error("Error del servidor")
      const data: Sale[] = await res.json()
      setSales(data)
    } catch {
      toast.error("No se pudieron cargar las ventas")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSales()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchSales()
    toast.success("Lista actualizada")
  }

  const filtered = sales.filter((sale) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (sale.folio ?? "").toLowerCase().includes(q) ||
      (sale.customerPhone ?? "").includes(q) ||
      (sale.customerName ?? "").toLowerCase().includes(q)

    const saleDate = new Date(sale.createdAt)
    const matchFrom = !dateFrom || saleDate >= new Date(dateFrom)
    const matchTo = !dateTo || saleDate <= new Date(dateTo + "T23:59:59")

    return matchSearch && matchFrom && matchTo
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${filtered.length} resultado(s)`}
          </p>
        </div>
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
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor="search" className="text-xs text-muted-foreground mb-1 block">
              Buscar (folio / teléfono / cliente)
            </Label>
            <Input
              id="search"
              placeholder="VTA-... o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div>
            <Label htmlFor="dateFrom" className="text-xs text-muted-foreground mb-1 block">
              Desde
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-xs text-muted-foreground mb-1 block">
              Hasta
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          {(search || dateFrom || dateTo) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                className="min-h-[44px]"
                onClick={() => {
                  setSearch("")
                  setDateFrom("")
                  setDateTo("")
                }}
              >
                Limpiar
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Folio</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cliente</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Método</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Cajero</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-20 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 mx-auto" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    {sales.length === 0
                      ? "Sin ventas registradas todavía."
                      : "Sin resultados para los filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => (
                  <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {sale.folio ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {sale.customerName ?? sale.customerPhone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatMXN(parseFloat(sale.total))}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <Badge variant="outline">
                        {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_VARIANT[sale.status] ?? "secondary"}>
                        {STATUS_LABEL[sale.status] ?? sale.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {sale.user?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] px-3"
                        onClick={() => setDetail(sale)}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sale Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Venta</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Folio</p>
                  <p className="font-mono font-medium">{detail.folio ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p>{formatDateTime(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p>
                    {detail.customerName ?? detail.customerPhone ?? "—"}
                    {detail.customerName && detail.customerPhone && (
                      <span className="text-muted-foreground ml-1">
                        ({detail.customerPhone})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cajero</p>
                  <p>{detail.user?.name ?? "—"}</p>
                </div>
              </div>

              <Separator />

              {/* Items table */}
              <div>
                <p className="text-sm font-medium mb-2">Artículos</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-medium">Nombre</th>
                        <th className="text-right px-3 py-2 font-medium">Precio</th>
                        <th className="text-right px-3 py-2 font-medium">Cant.</th>
                        <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatMXN(parseFloat(item.price))}
                          </td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatMXN(parseFloat(item.subtotal))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="font-mono">{formatMXN(parseFloat(detail.total))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Método de pago</span>
                  <span>{METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod}</span>
                </div>
                {detail.paymentMethod === "CASH" && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Cambio entregado</span>
                    <span className="font-mono">{formatMXN(parseFloat(detail.change))}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
