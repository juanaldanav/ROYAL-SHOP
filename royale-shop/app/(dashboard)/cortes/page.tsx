"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, RefreshCw, Wallet } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useSession } from "@/contexts/session-context"
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
  expectedCard: string | null
  countedCard: string | null
  cardDifference: string | null
  status: "OPEN" | "CLOSED"
  user: { name: string } | null
  _count: { sales: number }
}

type CutDetail = CashCut & {
  methodTotals: { CASH: number; CARD: number; TRANSFER: number }
  cashIn: number
  cashOut: number
  totalSalesLive: number
  expectedCashLive: number
}

type CuadreStatus = "EXACTO" | "SOBRANTE" | "FALTANTE"
type CloseResult = CashCut & {
  cuadreStatus: CuadreStatus
  cardCuadreStatus: CuadreStatus
  difference: string
  cardDifference: string
  expectedCash: string
  expectedCard: string
  countedCash: string
  countedCard: string
}

export default function CortesPage() {
  const { user } = useSession()
  const isCashier = user?.role === "CASHIER"
  const [cuts, setCuts] = useState<CashCut[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Open corte dialog
  const [openDialog, setOpenDialog] = useState(false)
  const [openingBalance, setOpeningBalance] = useState("")
  const [opening, setOpening] = useState(false)

  // Close corte dialog
  const [closeDialog, setCloseDialog] = useState<CashCut | null>(null)
  const [cutDetail, setCutDetail] = useState<CutDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [countedCash, setCountedCash] = useState("")
  const [countedCard, setCountedCard] = useState("")
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

  async function openCloseCutDialog(cut: CashCut) {
    setCountedCash("")
    setCountedCard("")
    setCutDetail(null)
    setCloseDialog(cut)
    setLoadingDetail(true)
    try {
      const res = await apiFetch(`/api/cash-cuts/${cut.id}`)
      if (res.ok) setCutDetail(await res.json())
    } catch { /* non-critical */ } finally {
      setLoadingDetail(false)
    }
  }

  async function handleCloseCut() {
    if (!closeDialog) return
    if (countedCash === "" || countedCash === undefined) {
      toast.error("Ingresa el efectivo contado")
      return
    }
    if (countedCard === "" || countedCard === undefined) {
      toast.error("Ingresa el conteo de tarjeta")
      return
    }
    setClosing(true)
    try {
      const res = await apiFetch(`/api/cash-cuts/${closeDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countedCash: parseFloat(countedCash),
          countedCard: parseFloat(countedCard),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al cerrar corte")
        return
      }
      toast.success("Corte cerrado")
      setCloseDialog(null)
      setCountedCash("")
      setCountedCard("")
      fetchCuts()
    } catch {
      toast.error("Error al cerrar corte")
    } finally {
      setClosing(false)
    }
  }

  const countedNum = parseFloat(countedCash) || 0
  const countedCardNum = parseFloat(countedCard) || 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">{isCashier ? "Mi Turno" : "Cortes de Caja"}</h1>
          <p className="text-sm text-muted-foreground">
            {isCashier ? "Tu turno de caja actual" : "Control de turnos y efectivo"}
          </p>
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
            {isCashier ? "Abrir Turno" : "Abrir Corte"}
          </Button>
        </div>
      </div>

      {/* ── CASHIER: "Mi Turno" — solo el turno activo, sin historial ── */}
      {isCashier && loading && (
        <Card className="p-6"><Skeleton className="h-24 w-full" /></Card>
      )}
      {isCashier && !loading && (
        openCut ? (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="size-2.5 rounded-full bg-[var(--rs-gold)] shrink-0" />
              <span className="font-semibold">Turno abierto</span>
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                desde {formatDateTime(openCut.openedAt)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Ventas del turno</p>
                <p className="text-xl font-semibold">{openCut._count.sales}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Saldo inicial</p>
                <p className="text-xl font-semibold font-mono">{formatMXN(parseFloat(openCut.openingBalance))}</p>
              </div>
            </div>
            <Button className="w-full min-h-[48px] mt-5" onClick={() => openCloseCutDialog(openCut)}>
              Cerrar Turno
            </Button>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 size-12 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="size-6 text-muted-foreground" />
            </div>
            <p className="font-semibold mb-1">No tienes un turno abierto</p>
            <p className="text-sm text-muted-foreground mb-5">
              Abre tu turno para empezar a registrar ventas.
            </p>
            <Button
              className="min-h-[48px] px-6"
              onClick={() => { setOpeningBalance(""); setOpenDialog(true) }}
            >
              Abrir Turno
            </Button>
          </Card>
        )
      )}

      {/* ── OWNER/MANAGER: banner + historial completo de cortes ── */}
      {!isCashier && (
      <>
      {/* Status Banner */}
      {!loading && (
        openCut ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 mb-6 text-sm">
            <span className="size-2 rounded-full bg-[var(--rs-gold)] shrink-0" />
            <span className="font-medium">
              Corte en curso desde{" "}
              <span className="font-semibold">{formatDateTime(openCut.openedAt)}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-[#0A0A0A] px-4 py-3 mb-6 text-sm">
            <AlertTriangle className="size-4 text-[var(--rs-gold)] shrink-0" />
            <span className="font-medium text-white/90">
              Sin corte abierto — las ventas no podrán registrarse hasta abrir un corte.
            </span>
          </div>
        )
      )}

      {/* ── Móvil (<sm): lista de cards — sin scroll horizontal ── */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-20 w-full" /></Card>
          ))
        ) : cuts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Sin cortes registrados. Abre el primero para empezar.
          </Card>
        ) : (
          cuts.map((cut) => {
            const diff = cut.difference !== null ? parseFloat(cut.difference) : null
            return (
              <Card key={cut.id} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium">{formatDateTime(cut.openedAt).split(",")[0]}</span>
                  <Badge variant={cut.status === "OPEN" ? "default" : "secondary"}>
                    {cut.status === "OPEN" ? "Abierto" : "Cerrado"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo inicial</p>
                    <p className="font-mono">{formatMXN(parseFloat(cut.openingBalance))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ventas</p>
                    <p>{cut._count.sales}</p>
                  </div>
                  {cut.totalSales !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Total ventas</p>
                      <p className="font-mono">{formatMXN(parseFloat(cut.totalSales))}</p>
                    </div>
                  )}
                  {diff !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Diferencia</p>
                      <p className={diff >= 0 ? "text-green-600 font-mono" : "text-destructive font-mono"}>
                        {diff >= 0 ? "+" : ""}{formatMXN(diff)}
                      </p>
                    </div>
                  )}
                </div>
                {cut.status === "OPEN" && (
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] mt-3"
                    onClick={() => openCloseCutDialog(cut)}
                  >
                    Cerrar Corte
                  </Button>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* ── sm+: tabla ── */}
      <Card className="hidden sm:block">
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
                            onClick={() => openCloseCutDialog(cut)}
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
      </>
      )}

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
        onOpenChange={(open) => { if (!open) { setCloseDialog(null); setCutDetail(null) } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar Corte de Caja</DialogTitle>
          </DialogHeader>
          {closeDialog && (
            <div className="space-y-4 py-2">
              {/* Efectivo */}
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

              {/* Tarjeta */}
              <div className="space-y-2">
                <Label htmlFor="countedCard">Vouchers de tarjeta contados (MXN)</Label>
                <Input
                  id="countedCard"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={countedCard}
                  onChange={(e) => setCountedCard(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>

              <Separator />

              {loadingDetail ? (
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo inicial</span>
                    <span className="font-mono">{formatMXN(parseFloat(closeDialog.openingBalance))}</span>
                  </div>

                  {cutDetail && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground pl-3">+ Efectivo recibido</span>
                        <span className="font-mono">{formatMXN(cutDetail.cashIn)}</span>
                      </div>
                      {cutDetail.cashOut > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground pl-3">− Cambio devuelto</span>
                          <span className="font-mono text-muted-foreground">−{formatMXN(cutDetail.cashOut)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Efectivo summary */}
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Efectivo esperado</span>
                    <span className="font-mono">
                      {cutDetail ? formatMXN(cutDetail.expectedCashLive) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contado efectivo</span>
                    <span className="font-mono">{formatMXN(countedNum)}</span>
                  </div>
                  {cutDetail && (
                    <div className="flex justify-between font-semibold">
                      <span>Dif. efectivo</span>
                      <span className={
                        (countedNum - cutDetail.expectedCashLive) >= 0
                          ? "text-green-600 dark:text-green-400 font-mono"
                          : "text-destructive font-mono"
                      }>
                        {(() => {
                          const d = countedNum - cutDetail.expectedCashLive
                          return `${d >= 0 ? "+" : ""}${formatMXN(d)}`
                        })()}
                      </span>
                    </div>
                  )}

                  <Separator />

                  {/* Tarjeta summary */}
                  {cutDetail && cutDetail.methodTotals.CARD > 0 && (
                    <>
                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">Tarjeta esperada</span>
                        <span className="font-mono">{formatMXN(cutDetail.methodTotals.CARD)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contado tarjeta</span>
                        <span className="font-mono">{formatMXN(countedCardNum)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Dif. tarjeta</span>
                        <span className={
                          (countedCardNum - cutDetail.methodTotals.CARD) >= 0
                            ? "text-green-600 dark:text-green-400 font-mono"
                            : "text-destructive font-mono"
                        }>
                          {(() => {
                            const d = countedCardNum - cutDetail.methodTotals.CARD
                            return `${d >= 0 ? "+" : ""}${formatMXN(d)}`
                          })()}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Transferencias (info only) */}
                  {cutDetail && cutDetail.methodTotals.TRANSFER > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Transferencias (info)</span>
                      <span className="font-mono">{formatMXN(cutDetail.methodTotals.TRANSFER)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCloseDialog(null); setCutDetail(null) }}
              className="min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloseCut}
              disabled={closing || loadingDetail}
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
