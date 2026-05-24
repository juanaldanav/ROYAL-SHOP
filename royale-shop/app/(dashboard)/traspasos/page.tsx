"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Plus, RefreshCw, Check, X, ArrowRight, Package } from "lucide-react"
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import { useSession } from "@/contexts/session-context"

type Branch = { id: string; name: string }
type Product = { id: string; name: string; sku: string | null; stock: number }

type TransferItem = {
  id: string
  quantity: number
  product: { id: string; name: string; sku: string | null }
}

type Transfer = {
  id: string
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
  notes: string | null
  createdAt: string
  confirmedAt: string | null
  fromBranch: { name: string }
  toBranch: { name: string }
  createdBy: { name: string }
  confirmedBy: { name: string } | null
  items: TransferItem[]
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  CANCELLED: "destructive",
}

type NewItem = { productId: string; quantity: number; productName: string; available: number }

export default function TraspasosPage() {
  const { user } = useSession()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  // New transfer dialog
  const [newOpen, setNewOpen] = useState(false)
  const [toBranchId, setToBranchId] = useState("")
  const [notes, setNotes] = useState("")
  const [newItems, setNewItems] = useState<NewItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedQty, setSelectedQty] = useState("1")
  const [submitting, setSubmitting] = useState(false)

  // Detail dialog
  const [detail, setDetail] = useState<Transfer | null>(null)

  async function fetchAll() {
    try {
      const [tRes, bRes] = await Promise.all([
        apiFetch("/api/transfers"),
        apiFetch("/api/branches"),
      ])
      const [tData, bData] = await Promise.all([tRes.json(), bRes.json()])
      setTransfers(Array.isArray(tData) ? tData : [])
      setBranches(Array.isArray(bData) ? bData : [])
    } catch {
      toast.error("Error al cargar traspasos")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function fetchProducts() {
    try {
      const res = await apiFetch("/api/inventory")
      const data = await res.json()
      const list: Product[] = (data.products ?? []).map((p: { id: string; name: string; sku: string | null; stock: number }) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock ?? 0,
      }))
      setProducts(list)
    } catch {
      toast.error("Error al cargar productos")
    }
  }

  useEffect(() => {
    fetchAll()
    fetchProducts()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchAll()
    toast.success("Actualizado")
  }

  function openNew() {
    setToBranchId("")
    setNotes("")
    setNewItems([])
    setSelectedProductId("")
    setSelectedQty("1")
    setNewOpen(true)
  }

  function addItem() {
    if (!selectedProductId) return
    const prod = products.find((p) => p.id === selectedProductId)
    if (!prod) return
    const qty = Math.max(1, parseInt(selectedQty) || 1)
    if (qty > prod.stock) {
      toast.error(`Stock insuficiente. Disponible: ${prod.stock}`)
      return
    }
    setNewItems((prev) => {
      const existing = prev.find((i) => i.productId === selectedProductId)
      if (existing) {
        return prev.map((i) =>
          i.productId === selectedProductId
            ? { ...i, quantity: Math.min(i.quantity + qty, i.available) }
            : i
        )
      }
      return [...prev, { productId: prod.id, quantity: qty, productName: prod.name, available: prod.stock }]
    })
    setSelectedProductId("")
    setSelectedQty("1")
  }

  function removeItem(productId: string) {
    setNewItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  async function submitTransfer() {
    if (!toBranchId || newItems.length === 0) return
    setSubmitting(true)
    try {
      const res = await apiFetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toBranchId,
          notes: notes || null,
          items: newItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? "Error al crear traspaso")
      }
      toast.success("Traspaso creado")
      setNewOpen(false)
      await fetchAll()
      await fetchProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAction(id: string, action: "confirm" | "cancel") {
    setActionId(id)
    try {
      const res = await apiFetch(`/api/transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? "Error")
      }
      toast.success(action === "confirm" ? "Traspaso confirmado" : "Traspaso cancelado")
      setDetail(null)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setActionId(null)
    }
  }

  // Branches the session user can transfer TO
  const otherBranches = branches.filter((b) => b.id !== user?.branchId)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Traspasos</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${transfers.length} traspaso(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            className="min-h-[44px] gap-1.5"
            onClick={openNew}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nuevo Traspaso</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* Transfer list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))
        ) : transfers.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            Sin traspasos registrados todavía.
          </Card>
        ) : (
          transfers.map((t) => (
            <Card
              key={t.id}
              className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setDetail(t)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Route */}
                  <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
                    <span className="truncate max-w-[120px]">{t.fromBranch.name}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[120px]">{t.toBranch.name}</span>
                  </div>

                  {/* Items summary */}
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {t.items.length === 0
                      ? "Sin productos"
                      : t.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
                  </p>

                  {/* Meta */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(t.createdAt)} · {t.createdBy.name}
                  </p>
                </div>

                <Badge variant={STATUS_VARIANT[t.status] ?? "outline"} className="shrink-0">
                  {STATUS_LABEL[t.status] ?? t.status}
                </Badge>
              </div>

              {t.status === "PENDING" && (
                <div className="flex gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className="flex-1 min-h-[40px] gap-1"
                    onClick={() => handleAction(t.id, "confirm")}
                    disabled={actionId === t.id}
                  >
                    <Check className="size-3.5" />
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-h-[40px] gap-1"
                    onClick={() => handleAction(t.id, "cancel")}
                    disabled={actionId === t.id}
                  >
                    <X className="size-3.5" />
                    Cancelar
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Traspaso</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Origen</p>
                  <p className="font-medium">{detail.fromBranch.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="font-medium">{detail.toBranch.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge variant={STATUS_VARIANT[detail.status] ?? "outline"}>
                    {STATUS_LABEL[detail.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p>{formatDate(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Creado por</p>
                  <p>{detail.createdBy.name}</p>
                </div>
                {detail.confirmedBy && (
                  <div>
                    <p className="text-xs text-muted-foreground">Confirmado por</p>
                    <p>{detail.confirmedBy.name}</p>
                  </div>
                )}
              </div>

              {detail.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm bg-muted/40 rounded-lg px-3 py-2">{detail.notes}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Productos</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-medium">Producto</th>
                        <th className="text-right px-3 py-2 font-medium">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <p>{item.product.name}</p>
                            {item.product.sku && (
                              <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {detail.status === "PENDING" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 min-h-[48px] gap-1.5"
                    onClick={() => handleAction(detail.id, "confirm")}
                    disabled={actionId === detail.id}
                  >
                    <Check className="size-4" />
                    Confirmar Recepción
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 min-h-[48px] gap-1.5"
                    onClick={() => handleAction(detail.id, "cancel")}
                    disabled={actionId === detail.id}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New transfer dialog */}
      <Dialog open={newOpen} onOpenChange={(o) => { if (!o) setNewOpen(false) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Traspaso</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Destination branch */}
            <div className="space-y-1.5">
              <Label>Sucursal destino</Label>
              <Select value={toBranchId} onValueChange={(v) => setToBranchId(v ?? "")}>
                <SelectTrigger className="w-full min-h-[44px]">
                  <SelectValue placeholder="Seleccionar sucursal..." />
                </SelectTrigger>
                <SelectContent>
                  {otherBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                  {otherBranches.length === 0 && (
                    <SelectItem value="_none" disabled>Sin otras sucursales</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Add product */}
            <div className="space-y-1.5">
              <Label>Agregar producto</Label>
              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={(v) => setSelectedProductId(v ?? "")}>
                  <SelectTrigger className="flex-1 min-h-[44px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter((p) => p.stock > 0).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.sku && <span className="text-muted-foreground ml-1 text-xs">({p.sku})</span>}
                        <span className="text-muted-foreground ml-1 text-xs">· {p.stock} disp.</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(e.target.value)}
                  className="w-16 min-h-[44px] text-center"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={addItem}
                  disabled={!selectedProductId}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            {/* Item list */}
            {newItems.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {newItems.map((item) => (
                      <tr key={item.productId} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.available} disponibles</p>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => removeItem(item.productId)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {newItems.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground text-sm border rounded-lg">
                <Package className="size-8 opacity-30" />
                <p>Agrega productos al traspaso</p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Motivo del traspaso..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submitTransfer}
              disabled={submitting || !toBranchId || newItems.length === 0}
              className="min-h-[44px]"
            >
              {submitting ? "Creando..." : "Crear Traspaso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
