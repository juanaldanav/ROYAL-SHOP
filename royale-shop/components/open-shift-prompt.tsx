"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "@/contexts/session-context"
import { apiFetch } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "shiftPromptDismissed"

// Req 6 — Al iniciar sesión, si el CASHIER no tiene turno abierto, ofrece abrir
// caja. "Hacerlo después" se recuerda en sessionStorage (no reaparece en la
// sesión). No bloquea la navegación: es un diálogo descartable.
export function OpenShiftPrompt() {
  const { user, loaded } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!loaded || !user || user.role !== "CASHIER") return
    if (pathname === "/login" || pathname === "/cortes") return
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY)) return

    let cancelled = false
    apiFetch("/api/cash-cuts")
      .then((r) => (r.ok ? r.json() : []))
      .then((cuts) => {
        if (cancelled) return
        const hasOpen = Array.isArray(cuts) && cuts.some((c) => c.status === "OPEN")
        if (!hasOpen) setOpen(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loaded, user?.id, user?.role, pathname])

  function dismiss() {
    if (typeof window !== "undefined") sessionStorage.setItem(DISMISS_KEY, "1")
    setOpen(false)
  }

  function goOpenCaja() {
    dismiss()
    router.push("/cortes")
  }

  if (!user || user.role !== "CASHIER") return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          No tienes un turno abierto. Abre tu caja para registrar ventas, o hazlo más tarde.
        </p>
        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={dismiss}>
            Hacerlo después
          </Button>
          <Button className="min-h-[44px]" onClick={goOpenCaja}>
            Abrir caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
