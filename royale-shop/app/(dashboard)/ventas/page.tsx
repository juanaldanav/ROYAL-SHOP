"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { RefreshCw, Printer, XCircle } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { formatMXN, formatDate, formatDateTime } from "@/lib/format"

type SaleItem = {
  id: string
  name: string
  price: string
  quantity: number
  subtotal: string
}

type Payment = {
  id: string
  method: "CASH" | "CARD" | "TRANSFER"
  amount: string
}

type Sale = {
  id: string
  folio: string
  createdAt: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  subtotal: string
  discount: string
  total: string
  change: string
  amountPaid: string
  cashAmount: string
  cardAmount: string
  transferAmount: string
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "MIXED"
  status: "COMPLETED" | "REFUNDED" | "CANCELLED"
  notes: string | null
  items: SaleItem[]
  payments?: Payment[]
  user: { name: string } | null
  branch?: { name: string } | null
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  MIXED: "Pago Mixto",
}

const METHOD_SHORT: Record<string, string> = {
  CASH: "Ef",
  CARD: "Tj",
  TRANSFER: "Tf",
}

/** Devuelve las líneas de pago. Usa payments[] si existen (ventas nuevas), fallback a inline para ventas anteriores. */
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

type TenantInfo = { name: string; phone: string | null; logoUrl: string | null }

function ticketLogoSrc(logoUrl: string | null | undefined): string {
  if (!logoUrl) return "/logo.jpg"
  if (logoUrl.startsWith("/uploads/")) return `/api${logoUrl}`
  return logoUrl
}

function TicketView({ sale, tenant }: { sale: Sale; tenant?: TenantInfo | null }) {
  const bizName = tenant?.name ?? "Royal Shop"
  return (
    <div className="font-mono text-sm" id="ticket-print-area">
      {/* Header */}
      <div className="text-center pb-3 space-y-1">
        <div className="flex justify-center mb-2">
          <Image src={ticketLogoSrc(tenant?.logoUrl)} alt={bizName} width={56} height={56} className="rounded-full object-cover" unoptimized />
        </div>
        <p className="font-bold text-base tracking-wide">{bizName.toUpperCase()}</p>
        <p className="text-xs text-muted-foreground">Joyería &amp; Perforaciones</p>
        {tenant?.phone && (
          <p className="text-xs text-muted-foreground">Tel: {tenant.phone}</p>
        )}
        {sale.branch && (
          <p className="text-xs text-muted-foreground">{sale.branch.name}</p>
        )}
      </div>

      <div className="border-t border-dashed my-2" />

      {/* Meta */}
      <div className="space-y-0.5 text-xs pb-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Folio</span>
          <span className="font-medium">{sale.folio ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fecha</span>
          <span>{formatDateTime(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cajero</span>
          <span>{sale.user?.name ?? "—"}</span>
        </div>
        {(sale.customerName || sale.customerPhone || sale.customerEmail) && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="text-right max-w-[60%] truncate">
              {sale.customerName ?? sale.customerPhone ?? sale.customerEmail}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed my-2" />

      {/* Items */}
      <div className="space-y-1 pb-2">
        {sale.items.map((item) => (
          <div key={item.id}>
            <p className="truncate">{item.name}</p>
            <div className="flex justify-between text-xs text-muted-foreground pl-2">
              <span>{item.quantity} × {formatMXN(parseFloat(item.price))}</span>
              <span className="font-medium text-foreground">{formatMXN(parseFloat(item.subtotal))}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed my-2" />

      {/* Totals */}
      <div className="space-y-0.5 text-xs pb-2">
        {parseFloat(sale.discount) > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMXN(parseFloat(sale.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span>- {formatMXN(parseFloat(sale.discount))}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatMXN(parseFloat(sale.total))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Método</span>
          <span>{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</span>
        </div>
        {sale.paymentMethod === "CASH" && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recibido</span>
              <span>{formatMXN(parseFloat(sale.amountPaid))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cambio</span>
              <span>{formatMXN(parseFloat(sale.change))}</span>
            </div>
          </>
        )}
        {sale.paymentMethod === "MIXED" && (
          <>
            {getPaymentLines(sale).map((p) => (
              <div key={p.method} className="flex justify-between">
                <span className="text-muted-foreground">· {METHOD_LABEL[p.method]}</span>
                <span>{formatMXN(p.amount)}</span>
              </div>
            ))}
            {parseFloat(sale.change) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cambio</span>
                <span>{formatMXN(parseFloat(sale.change))}</span>
              </div>
            )}
          </>
        )}
      </div>

      {sale.notes && (
        <>
          <div className="border-t border-dashed my-2" />
          <div className="text-xs">
            <p className="text-muted-foreground mb-0.5">Nota</p>
            <p className="whitespace-pre-wrap">{sale.notes}</p>
          </div>
        </>
      )}

      <div className="border-t border-dashed my-2" />
      <p className="text-center text-xs text-muted-foreground pb-1">
        ¡Gracias por su compra!
      </p>
    </div>
  )
}

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [detail, setDetail] = useState<Sale | null>(null)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [cancelPin, setCancelPin] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)

  useEffect(() => {
    apiFetch("/api/tenant")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setTenant({ name: data.name, phone: data.phone, logoUrl: data.logoUrl }) })
      .catch(() => {})
  }, [])

  async function fetchSales(from?: string, to?: string) {
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (from) params.set("startDate", from)
      if (to) params.set("endDate", to + "T23:59:59")
      const res = await apiFetch(`/api/sales?${params}`)
      if (!res.ok) throw new Error()
      setSales(await res.json())
    } catch {
      // error silencioso — el estado vacío es suficiente feedback
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSales(dateFrom || undefined, dateTo || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchSales(dateFrom || undefined, dateTo || undefined)
    toast.success("Lista actualizada")
  }

  function handlePrint() {
    window.print()
  }

  async function handleCancel() {
    if (!detail || !cancelPin) return
    setCancelling(true)
    try {
      const res = await apiFetch(`/api/sales/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", authPin: cancelPin }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Error al cancelar la venta")
        return
      }
      setSales((prev) => prev.map((s) => (s.id === body.id ? { ...s, status: "CANCELLED" } : s)))
      setDetail((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev))
      setPinDialogOpen(false)
      setCancelPin("")
      toast.success(`Venta ${detail.folio} cancelada`)
    } catch {
      toast.error("Error de conexión")
    } finally {
      setCancelling(false)
    }
  }

  // Date filtering is server-side; only text search is done client-side
  const filtered = sales.filter((sale) => {
    const q = search.toLowerCase()
    return (
      !q ||
      (sale.folio ?? "").toLowerCase().includes(q) ||
      (sale.customerPhone ?? "").includes(q) ||
      (sale.customerName ?? "").toLowerCase().includes(q)
    )
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

      {/* ── Móvil (<sm): lista de cards — sin scroll horizontal ── */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {sales.length === 0 ? "Sin ventas registradas todavía." : "Sin resultados para los filtros aplicados."}
          </Card>
        ) : (
          filtered.map((sale) => (
            <button key={sale.id} type="button" onClick={() => setDetail(sale)} className="block w-full text-left">
              <Card className="p-4 active:scale-[0.99] transition-transform">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs font-medium truncate">{sale.folio ?? "—"}</span>
                  <Badge variant={STATUS_VARIANT[sale.status] ?? "secondary"}>
                    {STATUS_LABEL[sale.status] ?? sale.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{formatDateTime(sale.createdAt)}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                      {sale.customerName ? ` · ${sale.customerName}` : ""}
                    </p>
                    <p className="text-lg font-semibold font-mono">{formatMXN(parseFloat(sale.total))}</p>
                  </div>
                  <span className="text-primary text-sm font-medium shrink-0">Ver →</span>
                </div>
              </Card>
            </button>
          ))
        )}
      </div>

      {/* ── sm+: tabla ── */}
      <Card className="hidden sm:block">
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
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge variant="outline">
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
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PIN Authorization Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => { if (!open) { setPinDialogOpen(false); setCancelPin("") } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Autorización requerida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Ingresa el PIN de <span className="font-medium text-foreground">Gerente u Owner</span> para cancelar la venta{" "}
              <span className="font-mono font-medium">{detail?.folio}</span>.
            </p>
            <div>
              <Label htmlFor="cancel-pin">PIN de autorización</Label>
              <Input
                id="cancel-pin"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={cancelPin}
                onChange={(e) => setCancelPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && cancelPin) handleCancel() }}
                className="mt-1 min-h-[48px] text-center text-xl tracking-widest"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 min-h-[48px]"
                onClick={() => { setPinDialogOpen(false); setCancelPin("") }}
                disabled={cancelling}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 min-h-[48px]"
                onClick={handleCancel}
                disabled={!cancelPin || cancelling}
              >
                {cancelling ? "Cancelando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venta · {detail?.folio ?? "—"}</DialogTitle>
          </DialogHeader>
          {detail && (
            <Tabs defaultValue="detalle">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="detalle" className="flex-1">Detalle</TabsTrigger>
                <TabsTrigger value="ticket" className="flex-1">Ticket</TabsTrigger>
              </TabsList>

              {/* ── Detalle ── */}
              <TabsContent value="detalle" className="space-y-4">
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
                      {detail.customerName ?? detail.customerPhone ?? detail.customerEmail ?? "—"}
                      {detail.customerName && detail.customerPhone && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({detail.customerPhone})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Cajero</p>
                    <p>{detail.user?.name ?? "—"}</p>
                  </div>
                  {detail.customerEmail && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Correo</p>
                      <p className="text-xs">{detail.customerEmail}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Artículos</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-2.5 py-1.5 font-medium">Nombre</th>
                          <th className="text-right px-2.5 py-1.5 font-medium">Precio</th>
                          <th className="text-right px-2.5 py-1.5 font-medium">Cant.</th>
                          <th className="text-right px-2.5 py-1.5 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="px-2.5 py-1.5">
                              <span className="block truncate max-w-[40vw] sm:max-w-[200px]">{item.name}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono whitespace-nowrap">
                              {formatMXN(parseFloat(item.price))}
                            </td>
                            <td className="px-2.5 py-1.5 text-right">{item.quantity}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono whitespace-nowrap">
                              {formatMXN(parseFloat(item.subtotal))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1 text-sm">
                  {parseFloat(detail.discount) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatMXN(parseFloat(detail.subtotal))}</span>
                    </div>
                  )}
                  {parseFloat(detail.discount) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Descuento</span>
                      <span className="font-mono">- {formatMXN(parseFloat(detail.discount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span className="font-mono">{formatMXN(parseFloat(detail.total))}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Método de pago</span>
                    <span>{METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod}</span>
                  </div>
                  {detail.paymentMethod === "MIXED" && (
                    <div className="pl-2 space-y-0.5 text-xs text-muted-foreground">
                      {getPaymentLines(detail).map((p) => (
                        <div key={p.method} className="flex justify-between">
                          <span>· {METHOD_LABEL[p.method]}</span>
                          <span className="font-mono">{formatMXN(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(detail.paymentMethod === "CASH" || detail.paymentMethod === "MIXED") && parseFloat(detail.change) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Cambio entregado</span>
                      <span className="font-mono">{formatMXN(parseFloat(detail.change))}</span>
                    </div>
                  )}
                </div>

                {detail.notes && (
                  <div className="rounded-lg bg-muted/40 p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Nota</p>
                    <p className="whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                )}

                {detail.status !== "CANCELLED" && (
                  <Button
                    variant="destructive"
                    className="w-full min-h-[48px] mt-2"
                    onClick={() => { setCancelPin(""); setPinDialogOpen(true) }}
                  >
                    <XCircle className="size-4 mr-2" />
                    Cancelar Ticket
                  </Button>
                )}
                {detail.status === "CANCELLED" && (
                  <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                    <XCircle className="size-4" />
                    Esta venta fue cancelada
                  </div>
                )}
              </TabsContent>

              {/* ── Ticket ── */}
              <TabsContent value="ticket">
                <div className="flex justify-end mb-3">
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                    <Printer className="size-3.5" />
                    Imprimir
                  </Button>
                </div>
                <div className="rounded-xl border bg-white p-5 max-w-xs mx-auto shadow-sm">
                  <TicketView sale={detail} tenant={tenant} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
