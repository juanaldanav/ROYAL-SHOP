"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Gem, Delete } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession, type SessionUser } from "@/contexts/session-context"

type Branch = { id: string; name: string }

export default function LoginPage() {
  const router = useRouter()
  const { user, loaded, login } = useSession()

  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)

  // Already logged in → go to dashboard
  useEffect(() => {
    if (loaded && user) router.replace("/dashboard")
  }, [loaded, user, router])

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data: Branch[]) => {
        setBranches(data)
        if (data.length === 1) setBranchId(data[0].id)
      })
      .catch(() => toast.error("No se pudieron cargar las sucursales"))
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

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-2">
          <Gem className="size-8 text-primary" />
        </div>
        <CardTitle className="text-xl">Royale Shop</CardTitle>
        <p className="text-sm text-muted-foreground">Ingresa tu PIN para continuar</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Branch selector */}
        <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue>
              {(v: string | null) => v ? (branches.find(b => b.id === v)?.name ?? v) : "Selecciona sucursal"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* PIN dots */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`size-4 rounded-full border-2 transition-colors ${
                i < pin.length
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/40"
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {keys.slice(0, 9).map((k) => (
            <Button
              key={k}
              variant="outline"
              className="h-14 text-xl font-semibold"
              onClick={() => pressKey(k)}
              disabled={loading}
            >
              {k}
            </Button>
          ))}
          {/* Bottom row: empty, 0, backspace */}
          <div />
          <Button
            variant="outline"
            className="h-14 text-xl font-semibold"
            onClick={() => pressKey("0")}
            disabled={loading}
          >
            0
          </Button>
          <Button
            variant="ghost"
            className="h-14"
            onClick={backspace}
            disabled={loading}
          >
            <Delete className="size-5" />
          </Button>
        </div>

        <Button
          className="w-full min-h-[44px]"
          onClick={handleSubmit}
          disabled={loading || pin.length !== 4 || !branchId}
        >
          {loading ? "Verificando..." : "Entrar"}
        </Button>
      </CardContent>
    </Card>
  )
}
