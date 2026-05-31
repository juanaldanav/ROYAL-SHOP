"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import { useOwnerGuard } from "@/lib/use-role-guard"

type Branch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  active: boolean
  _count: { users: number; sales: number }
}

const EMPTY = { name: "", address: "", phone: "" }

export default function SucursalesPage() {
  const { allowed } = useOwnerGuard()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dialog, setDialog] = useState<"create" | Branch | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function fetchBranches() {
    try {
      const res = await apiFetch("/api/branches")
      if (!res.ok) throw new Error()
      setBranches(await res.json())
    } catch {
      toast.error("No se pudieron cargar las sucursales")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchBranches() }, [])

  function openCreate() {
    setForm(EMPTY)
    setDialog("create")
  }

  function openEdit(b: Branch) {
    setForm({ name: b.name, address: b.address ?? "", phone: b.phone ?? "" })
    setDialog(b)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return }
    setSaving(true)
    try {
      const isEdit = dialog !== "create" && dialog !== null
      const res = await apiFetch(
        isEdit ? `/api/branches/${(dialog as Branch).id}` : "/api/branches",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            address: form.address.trim() || null,
            phone: form.phone.trim() || null,
          }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al guardar")
        return
      }
      toast.success(isEdit ? "Sucursal actualizada" : "Sucursal creada")
      setDialog(null)
      fetchBranches()
    } catch {
      toast.error("Error al guardar sucursal")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(b: Branch) {
    try {
      await apiFetch(`/api/branches/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !b.active }),
      })
      fetchBranches()
    } catch {
      toast.error("Error al actualizar sucursal")
    }
  }

  if (!allowed) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Sucursales</h1>
          <p className="text-sm text-muted-foreground">Gestión de puntos de venta</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
            onClick={() => { setRefreshing(true); fetchBranches() }} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button className="min-h-[44px]" onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> Nueva Sucursal
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))
        ) : branches.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Sin sucursales. Crea la primera para empezar.
          </Card>
        ) : (
          branches.map((b) => (
            <Card key={b.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold truncate">{b.name}</span>
                  <Badge variant={b.active ? "default" : "secondary"}>
                    {b.active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {b.address ?? "Sin dirección"} · {b._count.users} cajero(s) · {b._count.sales} venta(s)
                </p>
                {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => openEdit(b)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => handleToggle(b)}>
                  {b.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? "Nueva Sucursal" : "Editar Sucursal"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input className="min-h-[44px]" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Sucursal Centro" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input className="min-h-[44px]" value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Calle, número, colonia" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input className="min-h-[44px]" value={form.phone} type="tel"
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="52668..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} className="min-h-[44px]">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
