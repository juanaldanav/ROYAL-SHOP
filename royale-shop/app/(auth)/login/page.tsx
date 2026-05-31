"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Delete } from "lucide-react"
import { useSession, type SessionUser } from "@/contexts/session-context"
import { RoyaleLogo } from "@/components/ui/royale-logo"

type Branch = { id: string; name: string; tenantName?: string }

export default function LoginPage() {
  const router = useRouter()
  const { user, loaded, login } = useSession()

  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (loaded && user) router.replace("/dashboard")
  }, [loaded, user, router])

  useEffect(() => {
    fetch("/api/auth/branches")
      .then((r) => r.json())
      .then((data: Branch[]) => {
        setBranches(data)
        if (data.length === 1) setBranchId(data[0].id)
      })
      .catch(() => toast.error("No se pudieron cargar las sucursales"))
  }, [])

  // Mostrar nombre del negocio en el chip solo cuando hay más de un tenant
  const multiTenant = new Set(branches.map((b) => b.tenantName)).size > 1

  // Physical keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return
      if (/^\d$/.test(e.key)) {
        setPin((p) => (p.length < 4 ? p + e.key : p))
      } else if (e.key === "Backspace") {
        setPin((p) => p.slice(0, -1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function pressKey(k: string) {
    if (pin.length < 4) setPin((p) => p + k)
  }

  function backspace() {
    setPin((p) => p.slice(0, -1))
  }

  async function handleSubmit() {
    if (!branchId) {
      toast.error("Selecciona una sucursal")
      return
    }
    if (pin.length !== 4) {
      toast.error("Ingresa un PIN de 4 dígitos")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, branchId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "PIN incorrecto")
        setPin("")
        return
      }
      const data: SessionUser = await res.json()
      login(data)
      router.replace("/dashboard")
    } catch {
      toast.error("Error al iniciar sesión")
      setPin("")
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && branchId) handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <div className="w-full max-w-[384px] bg-white rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex flex-col items-center pt-8 pb-4 px-6">
        <RoyaleLogo size={140} />
        <p className="text-sm text-muted-foreground -mt-1">Ingresa tu PIN para continuar</p>
      </div>

      <div className="px-6 pb-8 space-y-5">
        {/* Branch selector — chip buttons, no native select */}
        {branches.length > 0 && (
          <div className={`flex gap-2 ${branches.length > 2 ? "flex-wrap" : ""}`}>
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={loading}
                onClick={() => setBranchId(b.id)}
                className={`flex-1 min-w-[44%] min-h-[44px] px-2 rounded-xl border text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                  branchId === b.id
                    ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                    : "bg-white text-[#0A0A0A] border-[#E8E8E8] hover:bg-[#F7F7F7]"
                }`}
              >
                {multiTenant && b.tenantName && (
                  <span className="block text-[10px] font-medium opacity-60 leading-tight">{b.tenantName}</span>
                )}
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* PIN dots */}
        <div className="flex justify-center gap-4 py-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`size-4 rounded-full transition-all duration-150 ${
                i < pin.length
                  ? "bg-[#D4A820] scale-110"
                  : "border-2 border-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              disabled={loading}
              className="h-14 text-xl font-semibold rounded-xl border border-[#E8E8E8] bg-white hover:bg-[#F7F7F7] active:scale-95 transition-all disabled:opacity-40 tabular-nums"
            >
              {k}
            </button>
          ))}
          {/* Bottom row */}
          <div />
          <button
            onClick={() => pressKey("0")}
            disabled={loading}
            className="h-14 text-xl font-semibold rounded-xl border border-[#E8E8E8] bg-white hover:bg-[#F7F7F7] active:scale-95 transition-all disabled:opacity-40 tabular-nums"
          >
            0
          </button>
          <button
            onClick={backspace}
            disabled={loading}
            className="h-14 flex items-center justify-center rounded-xl hover:bg-[#F7F7F7] active:scale-95 transition-all disabled:opacity-40"
            aria-label="Borrar"
          >
            <Delete className="size-5 text-muted-foreground" />
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || pin.length !== 4 || !branchId}
          className="w-full min-h-[48px] bg-[#0A0A0A] text-white font-bold rounded-xl text-base disabled:opacity-40 transition-opacity active:scale-[0.98]"
        >
          {loading ? "Verificando…" : "Entrar"}
        </button>
      </div>
    </div>
  )
}
