"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, RefreshCw, Tag } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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

type Category = {
  id: string
  name: string
  type: "PRODUCT" | "SERVICE"
  sortOrder: number
  active: boolean
}

const EMPTY = { name: "", type: "PRODUCT" }

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dialog, setDialog] = useState<"create" | Category | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function fetchCategories() {
    try {
      // Fetch all (including inactive) for management view
      const res = await apiFetch("/api/categories?includeInactive=true")
      if (!res.ok) throw new Error()
      setCategories(await res.json())
    } catch {
      toast.error("No se pudieron cargar las categorías")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  function openCreate() {
    setForm(EMPTY)
    setDialog("create")
  }

  function openEdit(c: Category) {
    setForm({ name: c.name, type: c.type })
    setDialog(c)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return }
    setSaving(true)
    try {
      const isEdit = dialog !== "create" && dialog !== null
      const res = await apiFetch(
        isEdit ? `/api/categories/${(dialog as Category).id}` : "/api/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), type: form.type }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al guardar")
        return
      }
      toast.success(isEdit ? "Categoría actualizada" : "Categoría creada")
      setDialog(null)
      fetchCategories()
    } catch {
      toast.error("Error al guardar categoría")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(c: Category) {
    try {
      const res = await apiFetch(`/api/categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      })
      if (!res.ok) throw new Error()
      fetchCategories()
    } catch {
      toast.error("Error al actualizar categoría")
    }
  }

  const activeCategories = categories.filter((c) => c.active)
  const inactiveCategories = categories.filter((c) => !c.active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${activeCategories.length} activas`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => { setRefreshing(true); fetchCategories() }}
            disabled={refreshing}
            aria-label="Actualizar"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button className="min-h-[44px]" onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> Nueva Categoría
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Tag className="size-8 opacity-30" />
                      <p>Sin categorías. Crea la primera.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                [...activeCategories, ...inactiveCategories].map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b last:border-0 hover:bg-muted/30 ${
                      !c.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.type === "PRODUCT" ? "default" : "secondary"}>
                        {c.type === "PRODUCT" ? "Producto" : "Servicio"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={c.active ? "default" : "outline"}>
                        {c.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => handleToggle(c)}
                        >
                          {c.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? "Nueva Categoría" : "Editar Categoría"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                className="min-h-[44px]"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Arracadas, Piercings"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">Producto</SelectItem>
                  <SelectItem value="SERVICE">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
