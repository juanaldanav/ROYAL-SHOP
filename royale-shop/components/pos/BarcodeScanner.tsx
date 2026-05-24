"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, CameraOff } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
}

type ScannerState = "idle" | "initializing" | "scanning" | "error"

export function BarcodeScanner({ open, onClose, onScan }: Props) {
  const scannerRef = useRef<InstanceType<Awaited<typeof import("html5-qrcode")>["Html5Qrcode"]> | null>(null)
  const [state, setState] = useState<ScannerState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [manualCode, setManualCode] = useState("")
  const didStartRef = useRef(false)

  // Start scanner when dialog opens
  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function startScanner() {
      setState("initializing")
      setErrorMsg("")
      didStartRef.current = false

      try {
        const { Html5Qrcode } = await import("html5-qrcode")

        if (cancelled) return

        const scanner = new Html5Qrcode("qr-reader")
        scannerRef.current = scanner
        didStartRef.current = true

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText)
            stopScanner().then(() => onClose())
          },
          // Frame-level errors are noisy — ignore silently
          () => {}
        )

        if (!cancelled) {
          setState("scanning")
        }
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        const isDenied =
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("denied") ||
          msg.toLowerCase().includes("notallowed")
        setErrorMsg(
          isDenied
            ? "Habilita la cámara en tu navegador"
            : "No se pudo iniciar la cámara. Usa el campo manual."
        )
        setState("error")
      }
    }

    startScanner()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function stopScanner() {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      if (didStartRef.current) {
        await scanner.stop()
        scanner.clear()
      }
    } catch {
      // Already stopped — ignore
    }
    scannerRef.current = null
    didStartRef.current = false
  }

  function handleClose() {
    stopScanner().then(() => {
      setState("idle")
      setManualCode("")
      onClose()
    })
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    onScan(code)
    stopScanner().then(() => {
      setState("idle")
      setManualCode("")
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent showCloseButton={false} className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Escanear código</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Camera viewport */}
          <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-square">
            {/* html5-qrcode mounts its video into this div */}
            <div id="qr-reader" className="w-full h-full" />

            {/* Initializing spinner overlay */}
            {state === "initializing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
                <Loader2 className="size-8 animate-spin text-white" />
                <span className="text-white text-sm">Iniciando cámara…</span>
              </div>
            )}

            {/* Error overlay */}
            {state === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 p-4 text-center">
                <CameraOff className="size-8 text-white/70" />
                <span className="text-white text-sm">{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Manual fallback */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              placeholder="Escribe SKU o código de barras"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1"
              autoComplete="off"
              inputMode="text"
            />
            <Button
              type="submit"
              variant="outline"
              className="min-h-[48px] px-4"
              disabled={!manualCode.trim()}
            >
              Buscar
            </Button>
          </form>

          <Button
            variant="ghost"
            className="min-h-[48px] w-full"
            onClick={handleClose}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
