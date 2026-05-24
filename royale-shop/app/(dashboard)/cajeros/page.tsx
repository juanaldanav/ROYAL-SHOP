"use client"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"

type Branch = { id: string; name: string }
type CashierUser = {
  id: string
  name: string
  email: string
  role: "OWNER" | "MANAGER" | "CASHIER"
  active: boolean
  branchId: string | null
  branch: { name: string } | null
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dueño",
  MANAGER: "Gerente",
  CASHIER: "Cajero",
}

const EMPTY = { name: "", email: "", pin: "", role: "CASHIER", branchId: "" }

export default function CajerosPage() {
  const [users, setUsers] = useState<CashierUser[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dialog, setDialog] = useState<"create" | CashierUser | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    try {
      const [usersRes, branchesRes] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/branches"),
      ])
      if (!usersRes.ok || !branchesRes.ok) throw new Error()
      setUsers(await usersRes.json())
      setBranches(await branchesRes.json())
    } catch {
      toast.error("No se pudieron cargar los datos")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  function openCreate() {
    setForm(EMPTY)
    setDialog("create")
  }

  function openEdit(u: CashierUser) {
    setForm({
      name: u.name,
      email: u.email,
      pin: "",
      role: u.role,
      branchId: u.branchId ?? "",
    })
    setDialog(u)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nombre y email son requeridos")
      return
    }
    if (form.pin && !/^\d{4}$/.test(form.pin)) {
      toast.error("El PIN debe ser 4 dígitos numéricos")
      return
    }
    setSaving(true)
    try {
      const isEdit = dialog !== "create" && dialog !== null
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        branchId: form.branchId || null,
      }
      if (form.pin) payload.pin = form.pin

      const res = await apiFetch(
        isEdit ? `/api/users/${(dialog as CashierUser).id}` : "/api/users",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al guardar")
        return
      }
      toast.success(isEdit ? "Usuario actualizado" : "Usuario creado")
      setDialog(null)
      fetchAll()
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(u: CashierUser) {
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      })
      fetchAll()
    } catch {
      toast.error("Error al actualizar usuario")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Cajeros</h1>
          <p className="text-sm text-muted-foreground">Usuarios y accesos por sucursal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
            onClick={() => { setRefreshing(true); fetchAll() }} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button className="min-h-[44px]" onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> Nuevo Cajero
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Sucursal</th>
                <th className="text-center px-4 py-3 font-medium">Rol</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Sin usuarios registrados. Crea el primero.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {u.branch?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={u.active ? "default" : "secondary"}>
                        {u.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => openEdit(u)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => handleToggle(u)}>
                          {u.active ? "Desactivar" : "Activar"}
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
              {dialog === "create" ? "Nuevo Cajero" : "Editar Cajero"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input className="min-h-[44px]" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre completo" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input className="min-h-[44px]" value={form.email} type="email"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>PIN (4 dígitos){dialog !== "create" && " — dejar vacío para no cambiar"}</Label>
              <Input className="min-h-[44px]" value={form.pin} type="password"
                inputMode="numeric" maxLength={4}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                placeholder="••••" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASHIER">Cajero</SelectItem>
                  <SelectItem value="MANAGER">Gerente</SelectItem>
                  <SelectItem value="OWNER">Dueño</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v === "none" ? "" : v }))}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Sin sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sucursal</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
