"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMXN, formatDateTime } from "@/lib/format"

type CashCut = {
  id: string
  openedAt: string
  closedAt: string | null
  openingBalance: string
  totalSales: string | null
  expectedCash: string | null
  countedCash: string | null
  difference: string | null
  status: "OPEN" | "CLOSED"
  user: { name: string } | null
  _count: { sales: number }
}

export default function CortesPage() {
  const [cuts, setCuts] = useState<CashCut[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Open corte dialog
  const [openDialog, setOpenDialog] = useState(false)
  const [openingBalance, setOpeningBalance] = useState("")
  const [opening, setOpening] = useState(false)

  // Close corte dialog
  const [closeDialog, setCloseDialog] = useState<CashCut | null>(null)
  const [countedCash, setCountedCash] = useState("")
  const [closing, setClosing] = useState(false)

  const openCut = cuts.find((c) => c.status === "OPEN") ?? null

  async function fetchCuts() {
    try {
      const res = await apiFetch("/api/cash-cuts")
      if (!res.ok) throw new Error("Error del servidor")
      const data: CashCut[] = await res.json()
      setCuts(data)
    } catch {
      toast.error("No se pudieron cargar los cortes de caja")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCuts()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchCuts()
  }

  async function handleOpenCut() {
    if (!openingBalance && openingBalance !== "0") {
      toast.error("Ingresa el saldo inicial")
      return
    }
    setOpening(true)
    try {
      const res = await apiFetch("/api/cash-cuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: parseFloat(openingBalance) }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al abrir corte")
        return
      }
      toast.success("Corte abierto")
      setOpenDialog(false)
      setOpeningBalance("")
      fetchCuts()
    } catch {
      toast.error("Error al abrir corte")
    } finally {
      setOpening(false)
    }
  }

  async function handleCloseCut() {
    if (!closeDialog) return
    if (!countedCash && countedCash !== "0") {
      toast.error("Ingresa el efectivo contado")
      return
    }
    setClosing(true)
    try {
      const res = await apiFetch(`/api/cash-cuts/${closeDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedCash: parseFloat(countedCash) }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al cerrar corte")
        return
      }
      toast.success("Corte cerrado")
      setCloseDialog(null)
      setCountedCash("")
      fetchCuts()
    } catch {
      toast.error("Error al cerrar corte")
    } finally {
      setClosing(false)
    }
  }

  // Live preview for the close dialog
  const expectedCashPreview =
    closeDialog
      ? parseFloat(closeDialog.openingBalance) +
        (closeDialog.expectedCash
          ? parseFloat(closeDialog.expectedCash) - parseFloat(closeDialog.openingBalance)
          : 0)
      : 0

  // If the cut is still open we don't have expectedCash yet — show opening balance only
  const openingBalancePreview = closeDialog
    ? parseFloat(closeDialog.openingBalance)
    : 0

  const countedNum = parseFloat(countedCash) || 0
  // For an OPEN cut, expected = openingBalance (we don't know sales yet from the cut object)
  // The server calculates the real difference; we show an estimate here
  const differencePreview = closeDialog?.expectedCash
    ? countedNum - parseFloat(closeDialog.expectedCash)
    : countedNum - openingBalancePreview

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Cortes de Caja</h1>
          <p className="text-sm text-muted-foreground">Control de turnos y efectivo</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Actualizar"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={!!openCut || loading}
            onClick={() => {
              setOpeningBalance("")
              setOpenDialog(true)
            }}
          >
            Abrir Corte
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {!loading && (
        openCut ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-4 py-3 mb-6 text-sm">
            <span className="size-2 rounded-full bg-green-500 shrink-0" />
            <span className="font-medium text-green-800 dark:text-green-300">
              Corte en curso desde{" "}
              <span className="font-semibold">{formatDateTime(openCut.openedAt)}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 px-4 py-3 mb-6 text-sm">
            <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <span className="font-medium text-yellow-800 dark:text-yellow-300">
              Sin corte abierto — las ventas no podrán registrarse hasta abrir un corte.
            </span>
          </div>
        )
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Turno</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Ventas</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Total Ventas</th>
                <th className="text-right px-4 py-3 font-medium">Saldo Inicial</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Contado</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Diferencia</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : cuts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    Sin cortes registrados. Abre el primero para empezar.
                  </td>
                </tr>
              ) : (
                cuts.map((cut) => {
                  const diff = cut.difference !== null ? parseFloat(cut.difference) : null
                  return (
                    <tr key={cut.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(cut.openedAt).split(",")[0]}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                        {formatDateTime(cut.openedAt).split(", ")[1] ?? "—"}
                        {cut.closedAt && (
                          <> → {formatDateTime(cut.closedAt).split(", ")[1] ?? "—"}</>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {cut._count.sales}
                      </td>
                      <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
                        {cut.totalSales !== null
                          ? formatMXN(parseFloat(cut.totalSales))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMXN(parseFloat(cut.openingBalance))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">
                        {cut.countedCash !== null
                          ? formatMXN(parseFloat(cut.countedCash))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {diff !== null ? (
                          <span
                            className={
                              diff >= 0
                                ? "text-green-600 dark:text-green-400 font-mono"
                                : "text-destructive font-mono"
                            }
                          >
                            {diff >= 0 ? "+" : ""}
                            {formatMXN(diff)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={cut.status === "OPEN" ? "default" : "secondary"}
                        >
                          {cut.status === "OPEN" ? "Abierto" : "Cerrado"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cut.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-[44px]"
                            onClick={() => {
                              setCountedCash("")
                              setCloseDialog(cut)
                            }}
                          >
                            Cerrar Corte
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Open Corte Dialog ── */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Corte de Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Saldo inicial en caja (MXN)</Label>
              <Input
                id="openingBalance"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="min-h-[44px]"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Cantidad de efectivo físico en la caja al inicio del turno.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDialog(false)}
              className="min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleOpenCut}
              disabled={opening}
              className="min-h-[44px]"
            >
              {opening ? "Abriendo..." : "Abrir Corte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Close Corte Dialog ── */}
      <Dialog
        open={!!closeDialog}
        onOpenChange={(open) => { if (!open) setCloseDialog(null) }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar Corte de Caja</DialogTitle>
          </DialogHeader>
          {closeDialog && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="countedCash">Efectivo contado en caja (MXN)</Label>
                <Input
                  id="countedCash"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="min-h-[44px]"
                  autoFocus
                />
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo inicial</span>
                  <span className="font-mono">
                    {formatMXN(openingBalancePreview)}
                  </span>
                </div>
                {closeDialog.expectedCash && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efectivo esperado</span>
                    <span className="font-mono">
                      {formatMXN(parseFloat(closeDialog.expectedCash))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contado</span>
                  <span className="font-mono">{formatMXN(countedNum)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Diferencia (estimada)</span>
                  <span
                    className={
                      differencePreview >= 0
                        ? "text-green-600 dark:text-green-400 font-mono"
                        : "text-destructive font-mono"
                    }
                  >
                    {differencePreview >= 0 ? "+" : ""}
                    {formatMXN(differencePreview)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseDialog(null)}
              className="min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloseCut}
              disabled={closing}
              className="min-h-[44px]"
            >
              {closing ? "Cerrando..." : "Cerrar Corte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
