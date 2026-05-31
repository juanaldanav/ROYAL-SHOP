"use client"

export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Upload, RefreshCw, Package, Minus, Plus, Check, X } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useSession } from "@/contexts/session-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMXN } from "@/lib/format"

type Category = { id: string; name: string } | null

type Product = {
  id: string
  name: string
  sku: string | null
  price: string
  stock: number
  minStock: number
  active: boolean
  category: Category
}

type InventoryResponse = { products: Product[] }
type ImportResult = { created: number; updated: number; errors?: string[] }
type StockLevel = "ok" | "warn" | "critical"

function getStockLevel(stock: number, minStock: number): StockLevel {
  if (stock <= minStock) return "critical"
  if (stock <= minStock * 2) return "warn"
  return "ok"
}

// Inline stock editor cell
function StockCell({
  product,
  onUpdate,
}: {
  product: Product
  onUpdate: (id: string, stock: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(product.stock))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const level = getStockLevel(product.stock, product.minStock)

  function startEdit() {
    setValue(String(product.stock))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function saveEdit() {
    const n = parseInt(value, 10)
    if (isNaN(n) || n < 0) { toast.error("Valor inválido"); cancelEdit(); return }
    if (n === product.stock) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await apiFetch(`/api/inventory/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: n }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onUpdate(product.id, updated.stock)
      toast.success(`Stock actualizado: ${updated.stock}`)
    } catch {
      toast.error("Error al actualizar stock")
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function cancelEdit() {
    setValue(String(product.stock))
    setEditing(false)
  }

  async function adjust(delta: number) {
    const newStock = Math.max(0, product.stock + delta)
    setSaving(true)
    try {
      const res = await apiFetch(`/api/inventory/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onUpdate(product.id, updated.stock)
    } catch {
      toast.error("Error al ajustar stock")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Input
          ref={inputRef}
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit()
            if (e.key === "Escape") cancelEdit()
          }}
          className="h-8 w-20 text-right px-2 text-sm"
          inputMode="numeric"
          disabled={saving}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={saveEdit}
          disabled={saving}
          aria-label="Confirmar"
        >
          <Check className="size-3.5 text-green-600" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={cancelEdit}
          disabled={saving}
          aria-label="Cancelar"
        >
          <X className="size-3.5 text-destructive" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1 group">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => adjust(-1)}
        disabled={saving || product.stock <= 0}
        aria-label="Restar 1"
      >
        <Minus className="size-3" />
      </Button>
      <button
        onClick={startEdit}
        className={`w-10 text-right text-sm font-medium tabular-nums cursor-pointer hover:underline ${
          level === "critical"
            ? "text-destructive"
            : level === "warn"
            ? "text-orange-500 dark:text-orange-400"
            : "text-green-600 dark:text-green-400"
        }`}
        aria-label="Editar stock"
      >
        {product.stock}
      </button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => adjust(1)}
        disabled={saving}
        aria-label="Sumar 1"
      >
        <Plus className="size-3" />
      </Button>
    </div>
  )
}

export default function InventarioPage() {
  const { user } = useSession()
  const isOwner = user?.role === "OWNER"
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<"all" | "low">("all")
  const [search, setSearch] = useState("")

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchInventory() {
    try {
      const res = await apiFetch("/api/inventory")
      if (!res.ok) throw new Error()
      const data: InventoryResponse | Product[] = await res.json()
      const list = Array.isArray(data) ? data : (data as InventoryResponse).products ?? []
      setProducts(list)
    } catch {
      toast.error("No se pudo cargar el inventario")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchInventory() }, [])

  function handleStockUpdate(id: string, newStock: number) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: newStock } : p))
    )
  }

  async function handleImport() {
    if (!csvFile) { toast.error("Selecciona un archivo CSV primero"); return }
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      const res = await apiFetch("/api/inventory/import", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Error al importar"); return }
      setImportResult(data)
      toast.success(`Importación: ${data.created} creados, ${data.updated} actualizados`)
      setCsvFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      fetchInventory()
    } catch {
      toast.error("Error al importar el archivo")
    } finally {
      setImporting(false)
    }
  }

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length

  const filtered = products
    .filter((p) => (filter === "low" ? p.stock <= p.minStock : true))
    .filter((p) => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${products.length} productos`}
            {!loading && lowStockCount > 0 && (
              <span className="text-destructive ml-2">· {lowStockCount} con stock bajo</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => { setRefreshing(true); fetchInventory() }}
          disabled={refreshing}
          aria-label="Actualizar"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* CSV Import — solo OWNER */}
      {isOwner && <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Importar desde CSV</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Columnas:{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">
            name, sku, barcode, price, cost, stock, minStock, categoryName
          </code>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="csvFile" className="text-xs">Archivo CSV</Label>
            <Input
              id="csvFile"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="min-h-[44px] cursor-pointer"
              onChange={(e) => { setCsvFile(e.target.files?.[0] ?? null); setImportResult(null) }}
            />
          </div>
          <Button
            className="min-h-[44px] shrink-0"
            onClick={handleImport}
            disabled={!csvFile || importing}
          >
            {importing ? (
              <><RefreshCw className="size-4 mr-2 animate-spin" />Importando...</>
            ) : (
              <><Upload className="size-4 mr-2" />Importar CSV</>
            )}
          </Button>
        </div>
        {importResult && (
          <div className="mt-3 rounded-lg border p-3 text-sm">
            <p className="font-medium mb-1">
              {importResult.created} creados · {importResult.updated} actualizados
            </p>
            {importResult.errors && importResult.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <li key={i} className="text-xs text-destructive">· {e}</li>
                ))}
                {importResult.errors.length > 5 && (
                  <li className="text-xs text-muted-foreground">
                    · ...y {importResult.errors.length - 5} más
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </Card>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "low")}>
          <TabsList>
            <TabsTrigger value="all">
              Todos
              {!loading && (
                <span className="ml-1.5 text-xs text-muted-foreground">({products.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="low">
              Stock Bajo
              {!loading && lowStockCount > 0 && (
                <span className="ml-1.5 text-xs text-destructive">({lowStockCount})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-64 min-h-[40px]"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-medium">Precio</th>
                <th className="text-right px-4 py-3 font-medium">
                  Stock
                  <span className="text-muted-foreground text-[10px] font-normal ml-1 hidden sm:inline">
                    (clic para editar)
                  </span>
                </th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Mínimo</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="size-8" />
                      <p>
                        {filter === "low"
                          ? "Todos los productos tienen stock suficiente."
                          : search
                          ? "Sin resultados para la búsqueda."
                          : "Sin productos en inventario."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const level = getStockLevel(p.stock, p.minStock)
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">
                        {p.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMXN(parseFloat(p.price))}
                      </td>
                      <td className="px-4 py-3">
                        <StockCell product={p} onUpdate={handleStockUpdate} />
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                        {p.minStock}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {level === "critical" ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            Crítico
                          </Badge>
                        ) : level === "warn" ? (
                          <Badge variant="outline" className="border-orange-400 text-orange-500 dark:text-orange-400">
                            Bajo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
