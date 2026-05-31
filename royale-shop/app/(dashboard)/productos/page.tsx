"use client"

export const dynamic = "force-dynamic"

function resolveUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith("/uploads/")) return `/api${url}`
  return url
}

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Search,
  Package,
  Upload,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useSession } from "@/contexts/session-context"
import { useOwnerGuard } from "@/lib/use-role-guard"
import { formatMXN } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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

// ─── Types ───────────────────────────────────────────────────────────────────

type BranchStockEntry = {
  branchId: string
  branch: { id: string; name: string }
  stock: number
  minStock: number
}

type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: string
  cost: string | null
  imageUrl: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
  branchStocks: BranchStockEntry[]
  description: string | null
  active: boolean
}

type Branch = { id: string; name: string }
type Category = { id: string; name: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function marginPct(price: string, cost: string | null): number | null {
  const p = parseFloat(price)
  const c = cost ? parseFloat(cost) : null
  if (!c || c <= 0 || p <= 0) return null
  return ((p - c) / p) * 100
}

function MarginBadge({ price, cost }: { price: string; cost: string | null }) {
  const pct = marginPct(price, cost)
  if (pct === null) return <span className="text-muted-foreground">—</span>
  const pctStr = pct.toFixed(0) + "%"
  if (pct >= 40)
    return <Badge className="bg-[#0A0A0A] text-white border-transparent">{pctStr}</Badge>
  if (pct >= 20)
    return <Badge className="bg-[#E8E8E8] text-[#0A0A0A] border-transparent">{pctStr}</Badge>
  return <Badge className="bg-[#0A0A0A] text-[var(--rs-gold)] border-transparent">{pctStr}</Badge>
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  sku: "",
  barcode: "",
  price: "",
  cost: "",
  stock: "0",
  minStock: "0",
  categoryId: "",
  description: "",
  imageUrl: "",
  targetBranch: "all",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { allowed } = useOwnerGuard()
  const { user } = useSession()
  const isOwnerOrManager = user?.role === "OWNER" || user?.role === "MANAGER"

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<string>("") // branch ID to show stock for
  const [newCatName, setNewCatName] = useState("")
  const [addingCat, setAddingCat] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  async function fetchProducts() {
    const res = await apiFetch("/api/products")
    const data = await res.json()
    setProducts(data)
    setLoading(false)
  }

  async function fetchCategories() {
    const res = await apiFetch("/api/categories?type=PRODUCT")
    setCategories(await res.json())
  }

  async function fetchBranches() {
    const res = await apiFetch("/api/branches")
    const data: Branch[] = await res.json()
    setBranches(data)
    if (data.length > 0 && !stockFilter) setStockFilter(data[0].id)
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    if (isOwnerOrManager) fetchBranches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerOrManager])

  // ── Dialog helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    const firstStock = p.branchStocks[0]
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      price: String(p.price),
      cost: p.cost ? String(p.cost) : "",
      stock: firstStock ? String(firstStock.stock) : "0",
      minStock: firstStock ? String(firstStock.minStock) : "0",
      categoryId: p.categoryId ?? "",
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      targetBranch: firstStock?.branchId ?? "all",
    })
    setImagePreview(resolveUploadUrl(p.imageUrl))
    setOpen(true)
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await apiFetch("/api/products/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al subir imagen")
        return
      }
      const { url } = await res.json()
      setForm((f) => ({ ...f, imageUrl: url }))
      setImagePreview(url)
    } catch {
      toast.error("Error al subir imagen")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ── Category inline create ───────────────────────────────────────────────────

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    setAddingCat(true)
    try {
      const res = await apiFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), type: "PRODUCT" }),
      })
      if (!res.ok) {
        toast.error("No se pudo crear la categoría")
        return
      }
      const cat: Category = await res.json()
      setCategories((prev) => [...prev, cat])
      setForm((f) => ({ ...f, categoryId: cat.id }))
      setNewCatName("")
      toast.success("Categoría creada")
    } catch {
      toast.error("Error al crear categoría")
    } finally {
      setAddingCat(false)
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price) {
      toast.error("Nombre y precio son requeridos")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : null,
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 0,
        categoryId: form.categoryId || null,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        allBranches: form.targetBranch === "all",
        branchId: form.targetBranch !== "all" ? form.targetBranch : undefined,
      }

      if (editing) {
        await apiFetch(`/api/products/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast.success("Producto actualizado")
      } else {
        await apiFetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast.success("Producto creado")
      }

      setOpen(false)
      fetchProducts()
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────

  async function toggleActive(p: Product) {
    await apiFetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    })
    toast.success(p.active ? "Producto desactivado" : "Producto activado")
    fetchProducts()
  }

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // ── Stock helper ─────────────────────────────────────────────────────────────

  function getStock(p: Product): string {
    if (p.branchStocks.length === 0) return "—"
    const entry = stockFilter
      ? p.branchStocks.find((bs) => bs.branchId === stockFilter)
      : p.branchStocks[0]
    if (!entry) return "—"
    return String(entry.stock)
  }

  function getMinStock(p: Product): number {
    if (p.branchStocks.length === 0) return 0
    const entry = stockFilter
      ? p.branchStocks.find((bs) => bs.branchId === stockFilter)
      : p.branchStocks[0]
    return entry?.minStock ?? 0
  }

  if (!allowed) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">{products.length} en catálogo</p>
        </div>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="size-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Search + Branch filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9 min-h-[44px]"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isOwnerOrManager && branches.length > 1 && (
          <Select
            value={stockFilter || "all"}
            onValueChange={(v) => setStockFilter(!v || v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-48 min-h-[44px]">
              <SelectValue>
                {(v: string | null) =>
                  !v || v === "all"
                    ? "Todas las sucursales"
                    : (branches.find((b) => b.id === v)?.name ?? v)
                }
              </SelectValue>
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
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium w-12">Img</th>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">SKU / Código</th>
                <th className="text-right px-4 py-3 font-medium">Precio / Costo</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Margen</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Stock</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Categoría</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="size-10 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3 text-center hidden md:table-cell"><Skeleton className="h-5 w-12 mx-auto" /></td>
                    <td className="px-4 py-3 text-right hidden md:table-cell"><Skeleton className="h-4 w-8 ml-auto" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    Sin productos. Crea el primero.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const stockVal = getStock(p)
                  const minStockVal = getMinStock(p)
                  const stockNum = stockVal === "—" ? null : parseInt(stockVal)
                  const lowStock = stockNum !== null && stockNum <= minStockVal

                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      {/* Imagen */}
                      <td className="px-4 py-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveUploadUrl(p.imageUrl)!}
                            alt={p.name}
                            width={40}
                            height={40}
                            className="size-10 rounded object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded bg-muted flex items-center justify-center">
                            <Package className="size-5 text-muted-foreground" />
                          </div>
                        )}
                      </td>

                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                        )}
                      </td>

                      {/* SKU / Barcode */}
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        <div className="text-xs">
                          {p.sku ? <span>SKU: {p.sku}</span> : null}
                          {p.sku && p.barcode ? <br /> : null}
                          {p.barcode ? <span>{p.barcode}</span> : null}
                          {!p.sku && !p.barcode ? "—" : null}
                        </div>
                      </td>

                      {/* Precio / Costo */}
                      <td className="px-4 py-3 text-right">
                        <p className="font-mono font-medium">{formatMXN(parseFloat(p.price))}</p>
                        {p.cost && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatMXN(parseFloat(p.cost))}
                          </p>
                        )}
                      </td>

                      {/* Margen */}
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <MarginBadge price={p.price} cost={p.cost} />
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className={lowStock ? "text-destructive font-medium" : ""}>
                          {stockVal}
                        </span>
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {p.category?.name ?? "—"}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.active ? "default" : "secondary"}>
                          {p.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            onClick={() => toggleActive(p)}
                          >
                            {p.active ? (
                              <ToggleRight className="size-4" />
                            ) : (
                              <ToggleLeft className="size-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* 1. Imagen */}
            <div className="space-y-2">
              <Label>Imagen del producto</Label>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    width={80}
                    height={80}
                    className="size-20 rounded object-cover border"
                  />
                ) : (
                  <div className="size-20 rounded border bg-muted flex items-center justify-center">
                    <Package className="size-8 text-muted-foreground" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4 mr-2" />
                  {uploading ? "Subiendo..." : imagePreview ? "Cambiar" : "Subir imagen"}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* 2. Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Arracada plata 8mm"
                className="min-h-[44px]"
              />
            </div>

            {/* 3. Precio / Costo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">
                  Precio de venta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Precio de compra (costo)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  className="min-h-[44px]"
                />
              </div>
            </div>
            {/* Live margin preview */}
            {form.price && form.cost && parseFloat(form.cost) > 0 && parseFloat(form.price) > 0 && (
              <p className="text-xs text-muted-foreground -mt-2">
                Margen:{" "}
                <span className="font-medium">
                  {(((parseFloat(form.price) - parseFloat(form.cost)) / parseFloat(form.price)) * 100).toFixed(1)}%
                </span>
              </p>
            )}

            {/* 4. SKU / Barcode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Ej. ARR-001"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Ej. 7501234567890"
                  className="min-h-[44px]"
                />
              </div>
            </div>

            {/* 5. Stock / MinStock */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock inicial</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            {/* 6. Sucursal — solo OWNER/MANAGER */}
            {isOwnerOrManager && branches.length > 0 && (
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select
                  value={form.targetBranch}
                  onValueChange={(v) => setForm({ ...form, targetBranch: v ?? "all" })}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue>
                      {(v: string | null) =>
                        !v || v === "all"
                          ? "Todas las sucursales"
                          : (branches.find((b) => b.id === v)?.name ?? v)
                      }
                    </SelectValue>
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
              </div>
            )}

            {/* 7. Categoría + inline create */}
            <div className="space-y-2">
              <Label>Categoría</Label>
              <div className="flex gap-2">
                <Select
                  value={form.categoryId || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, categoryId: !v || v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger className="min-h-[44px] flex-1">
                    <SelectValue>
                      {(v: string | null) =>
                        !v || v === "none"
                          ? "Sin categoría"
                          : (categories.find((c) => c.id === v)?.name ?? v)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Inline add category */}
                <div className="flex gap-1">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nueva..."
                    className="min-h-[44px] w-28"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddCategory()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] px-3"
                    disabled={addingCat || !newCatName.trim()}
                    onClick={handleAddCategory}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 8. Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción breve del producto"
                className="min-h-[44px]"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="min-h-[44px]">
                {saving ? "Guardando..." : editing ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
