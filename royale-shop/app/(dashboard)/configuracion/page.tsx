"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Save, Upload, Building2, Phone, Link2, RefreshCw, MessageCircle, CheckCircle2, WifiOff, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { apiFetch } from "@/lib/api-client"
import { useOwnerGuard } from "@/lib/use-role-guard"

// URLs legacy `/uploads/...` se sirven en realidad bajo `/api/uploads/...`.
// Mismo criterio que el sidebar (tenantLogoSrc) para que el preview no dé 404.
function resolveLogoSrc(url: string): string {
  if (url.startsWith("/uploads/")) return `/api${url}`
  return url
}

type TenantConfig = {
  id: string
  name: string
  slug: string
  phone: string | null
  logoUrl: string | null
}

type WAStatus = {
  ready: boolean
  hasQR: boolean
  number: string | null
  error: string | null
  qrImage: string | null
}

export default function ConfiguracionPage() {
  const { allowed } = useOwnerGuard()
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", logoUrl: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── WhatsApp status ────────────────────────────────────────────────────────
  const [wa, setWa] = useState<WAStatus | null>(null)
  const [waLoading, setWaLoading] = useState(false)

  // Devuelve true si el servicio ya está conectado (para detener el polling).
  const fetchWAStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiFetch("/api/tickets/whatsapp?qr=1")
      const data: WAStatus | null = await res.json().catch(() => null)
      const next = data ?? { ready: false, hasQR: false, number: null, error: "Sin respuesta del servicio", qrImage: null }
      setWa(next)
      return next.ready
    } catch {
      setWa({ ready: false, hasQR: false, number: null, error: "Servicio no disponible", qrImage: null })
      return false
    }
  }, [])

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const stop = () => { if (id) { clearInterval(id); id = null } }
    // Poll cada 5s solo mientras no esté conectado; al conectar, detiene el timer.
    const tick = async () => {
      const ready = await fetchWAStatus()
      if (ready) stop()
    }
    fetchWAStatus().then((ready) => { if (!ready) id = setInterval(tick, 5000) })
    return stop
  }, [fetchWAStatus])

  async function handleWARefresh() {
    setWaLoading(true)
    await fetchWAStatus()
    setWaLoading(false)
  }

  async function fetchConfig() {
    try {
      const res = await apiFetch("/api/tenant")
      if (!res.ok) throw new Error()
      const data: TenantConfig = await res.json()
      setConfig(data)
      setForm({ name: data.name, phone: data.phone ?? "", logoUrl: data.logoUrl ?? "" })
    } catch {
      toast.error("No se pudo cargar la configuración")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await apiFetch("/api/tenant/logo", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al subir logo")
        return
      }
      const { url } = await res.json()
      setForm((f) => ({ ...f, logoUrl: url }))
      toast.success("Logo subido — guarda los cambios para aplicarlo")
    } catch {
      toast.error("Error al subir logo")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("El nombre del negocio es requerido")
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, logoUrl: form.logoUrl }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al guardar")
        return
      }
      const updated: TenantConfig = await res.json()
      setConfig(updated)
      toast.success("Configuración guardada")
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  if (!allowed) return null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Datos del negocio y apariencia</p>
        </div>
        <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
          onClick={() => { setLoading(true); fetchConfig() }} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <Card className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
      ) : (
        <>
        {/* ── WhatsApp status card ── */}
        <Card className="p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="size-4 text-[#25D366]" />
              WhatsApp — número remitente
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleWARefresh}
              disabled={waLoading}
            >
              <RefreshCw className={`size-4 ${waLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {wa === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Consultando servicio…
            </div>
          ) : wa.ready ? (
            <div className="flex items-center gap-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 px-4 py-3">
              <CheckCircle2 className="size-5 text-[#25D366] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#25D366]">Conectado</p>
                <p className="text-xs text-muted-foreground">+{wa.number}</p>
              </div>
            </div>
          ) : wa.qrImage ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                <WifiOff className="size-4 shrink-0" />
                No conectado — escanea el QR con WhatsApp
              </div>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wa.qrImage}
                  alt="QR WhatsApp"
                  className="rounded-xl border size-52 object-contain bg-white p-2"
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Generando QR… espera unos segundos y refresca.
            </div>
          )}

          {wa?.error && (
            <p className="mt-2 text-xs text-destructive">{wa.error}</p>
          )}
        </Card>

        <form onSubmit={handleSave}>
          <Card className="p-6 space-y-6">

            {/* ── Logo ── */}
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                Logo del negocio
              </h2>
              <div className="flex items-center gap-4">
                <div className="size-20 rounded-2xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                  {form.logoUrl ? (
                    <Image
                      src={resolveLogoSrc(form.logoUrl)}
                      alt="Logo"
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <Building2 className="size-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4 mr-2" />
                    {uploading ? "Subiendo..." : "Subir imagen"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG o WebP — máx. 5MB</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="size-3" /> O pega una URL de imagen
                </Label>
                <Input
                  className="min-h-[44px] text-sm"
                  placeholder="https://..."
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            {/* ── Nombre ── */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" />
                Nombre del negocio *
              </Label>
              <Input
                id="name"
                className="min-h-[44px]"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Royal Shop"
                required
              />
            </div>

            {/* ── Teléfono ── */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" />
                Teléfono de contacto
              </Label>
              <Input
                id="phone"
                className="min-h-[44px]"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+52 55 1234 5678"
              />
              <p className="text-xs text-muted-foreground">
                Aparece en tickets y comunicaciones a clientes.
              </p>
            </div>

            <Separator />

            {/* ── Slug (read-only) ── */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Identificador del tenant (slug)</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground font-mono select-all">
                {config?.slug ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">Solo lectura. Identifica tu negocio en el sistema.</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" className="min-h-[44px] px-6" disabled={saving}>
                <Save className="size-4 mr-2" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </Card>
        </form>
        </>
      )}
    </div>
  )
}
