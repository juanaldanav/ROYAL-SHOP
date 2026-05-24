"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Category = { id: string; name: string; type: "PRODUCT" | "SERVICE"; sortOrder: number; active: boolean }

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", type: "PRODUCT" })
  const [saving, setSaving] = useState(false)

  async function fetchCategories() {
    const res = await fetch("/api/categories")
    setCategories(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { toast.error("Nombre requerido"); return }
    setSaving(true)
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      toast.success("Categoría creada")
      setOpen(false)
      setForm({ name: "", type: "PRODUCT" })
      fetchCategories()
    } catch { toast.error("Error al guardar") }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categorías</p>
        </div>
        <Button onClick={() => setOpen(true)} className="min-h-[44px]">
          <Plus className="size-4 mr-2" /> Nueva Categoría
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={2} className="text-center py-12 text-muted-foreground">Cargando...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={2} className="text-center py-12 text-muted-foreground">
                  <Tag className="size-8 mx-auto mb-2 opacity-30" />
                  Sin categorías. Crea la primera.
                </td></tr>
              ) : categories.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.type === "PRODUCT" ? "default" : "secondary"}>
                      {c.type === "PRODUCT" ? "Producto" : "Servicio"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva Categoría</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Arracadas, Piercings Nariz" className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">Producto</SelectItem>
                  <SelectItem value="SERVICE">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="min-h-[44px]">{saving ? "Guardando..." : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
