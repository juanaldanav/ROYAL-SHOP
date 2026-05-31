"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useOwnerGuard } from "@/lib/use-role-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { formatMXN } from "@/lib/format"

type Category = { id: string; name: string }
type Service = {
  id: string
  name: string
  price: string
  cost: string | null
  duration: number | null
  categoryId: string | null
  category: Category | null
  description: string | null
  active: boolean
}

const EMPTY_FORM = {
  name: "",
  price: "",
  description: "",
  duration: "",
  categoryId: "",
}

export default function ServiciosPage() {
  const { allowed } = useOwnerGuard()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function fetchServices() {
    const res = await apiFetch("/api/services")
    const data = await res.json()
    setServices(data)
    setLoading(false)
  }

  async function fetchCategories() {
    const res = await apiFetch("/api/categories?type=SERVICE")
    setCategories(await res.json())
  }

  useEffect(() => {
    fetchServices()
    fetchCategories()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name: s.name,
      price: String(s.price),
      description: s.description ?? "",
      duration: s.duration ? String(s.duration) : "",
      categoryId: s.categoryId ?? "",
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price) {
      toast.error("Nombre y precio son requeridos")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        description: form.description || null,
        duration: form.duration ? parseInt(form.duration) : null,
        categoryId: form.categoryId || null,
      }

      if (editing) {
        await apiFetch(`/api/services/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast.success("Servicio actualizado")
      } else {
        await apiFetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast.success("Servicio creado")
      }

      setOpen(false)
      fetchServices()
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: Service) {
    await apiFetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    })
    toast.success(s.active ? "Servicio desactivado" : "Servicio activado")
    fetchServices()
  }

  if (!allowed) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Servicios de Perforación</h1>
          <p className="text-sm text-muted-foreground">{services.length} servicios</p>
        </div>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="size-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Servicio</th>
                <th className="text-right px-4 py-3 font-medium">Precio</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                  Duración
                </th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                  Categoría
                </th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Sin servicios. Crea el primero.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground">{s.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatMXN(parseFloat(s.price))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {s.duration ? `${s.duration} min` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {s.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.active ? "default" : "secondary"}>
                        {s.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => toggleActive(s)}
                        >
                          {s.active ? (
                            <ToggleRight className="size-4" />
                          ) : (
                            <ToggleLeft className="size-4" />
                          )}
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

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Perforación Nariz"
                className="min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc-price">
                  Precio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="svc-price"
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
                <Label htmlFor="svc-duration">Duración (min)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min="0"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="30"
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: (v === "none" || !v) ? "" : v })}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue>
                    {(v: string | null) => !v || v === "none" ? "Sin categoría" : (categories.find(c => c.id === v)?.name ?? v)}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-desc">Descripción</Label>
              <Input
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción opcional"
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
