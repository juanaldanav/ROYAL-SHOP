"use client"

export const dynamic = "force-dynamic"

function resolveUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith("/uploads/")) return `/api${url}`
  return url
}

import { Suspense } from "react"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ShoppingCart,
  ScanBarcode,
  Minus,
  Plus,
  AlertTriangle,
  Search,
  Gem,
  X,
  History,
  Receipt,
  ArrowLeft,
} from "lucide-react"

import Link from "next/link"
import { formatMXN, generateFolio, cartSubtotal } from "@/lib/format"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { BarcodeScanner } from "@/components/pos/BarcodeScanner"

// ─── Types ────────────────────────────────────────────────────────────────────

type CartItem = {
  key: string
  productId?: string
  serviceId?: string
  name: string
  price: number
  quantity: number
}

type Product = {
  id: string
  name: string
  price: number
  sku?: string | null
  barcode?: string | null
  categoryId?: string | null
  active: boolean
  imageUrl?: string | null
  category?: { id: string; name: string } | null
}

type Service = {
  id: string
  name: string
  price: number
  categoryId?: string | null
  category?: { id: string; name: string } | null
}

type Category = {
  id: string
  name: string
}

type CashCut = {
  id: string
  status: string
}

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "MIXED"

// ─── WhatsApp ticket helpers ──────────────────────────────────────────────────

function normalizeWAPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.length === 10 ? `52${digits}` : digits
}

// ─── Component ────────────────────────────────────────────────────────────────

function POSContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCashCut, setActiveCashCut] = useState<CashCut | null>(null)
  const [loading, setLoading] = useState(true)

  // UI state
  const [activeCategory, setActiveCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [cartOpen, setCartOpen] = useState(false)
  // Auto-open scanner if ?scan=1 was passed from the "Hacer Venta → ESCANEAR" flow
  const [scannerOpen, setScannerOpen] = useState(searchParams.get("scan") === "1")
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [amountPaid, setAmountPaid] = useState("")
  // Pago mixto
  const [mixedCash, setMixedCash] = useState("")
  const [mixedSecond, setMixedSecond] = useState("")
  const [mixedSecondMethod, setMixedSecondMethod] = useState<"CARD" | "TRANSFER">("CARD")
  const [submitting, setSubmitting] = useState(false)

  // Turno (cash cut) management — inline for CASHIER who can't access /cortes
  const [openCutDialog, setOpenCutDialog] = useState(false)
  const [closeCutDialog, setCloseCutDialog] = useState(false)
  const [turnOpeningBalance, setTurnOpeningBalance] = useState("")
  const [turnOpening, setTurnOpening] = useState(false)
  const [turnCountedCash, setTurnCountedCash] = useState("")
  const [turnCountedCard, setTurnCountedCard] = useState("")
  const [turnClosing, setTurnClosing] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      try {
        const [productsRes, servicesRes, categoriesRes, cutsRes] =
          await Promise.all([
            apiFetch("/api/products?active=true"),
            apiFetch("/api/services"),
            apiFetch("/api/categories"),
            apiFetch("/api/cash-cuts"),
          ])

        const [productsData, servicesData, categoriesData, cutsData] =
          await Promise.all([
            productsRes.json(),
            servicesRes.json(),
            categoriesRes.json(),
            cutsRes.json(),
          ])

        setProducts(Array.isArray(productsData) ? productsData : [])
        setServices(Array.isArray(servicesData) ? servicesData : [])
        setCategories(Array.isArray(categoriesData) ? categoriesData : [])

        const cuts: CashCut[] = Array.isArray(cutsData) ? cutsData : []
        const openCut = cuts.find((c) => c.status === "OPEN") ?? null
        setActiveCashCut(openCut)
      } catch (err) {
        console.error("[POS] loadAll error", err)
        toast.error("Error al cargar datos")
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  const subtotal = cartSubtotal(cart)
  const discountAmount = parseFloat(discount) || 0
  const total = Math.max(0, subtotal - discountAmount)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const change =
    paymentMethod === "CASH"
      ? Math.max(0, (parseFloat(amountPaid) || 0) - total)
      : 0

  // Filtered catalog (products + services mixed, filtered by category tab)
  const catalogProducts: Array<{
    key: string
    productId?: string
    serviceId?: string
    name: string
    price: number
    isService: boolean
    categoryId?: string | null
  }> = [
    ...products.map((p) => ({
      key: `p-${p.id}`,
      productId: p.id,
      name: p.name,
      price: p.price,
      isService: false,
      categoryId: p.categoryId,
    })),
    ...services.map((s) => ({
      key: `s-${s.id}`,
      serviceId: s.id,
      name: s.name,
      price: s.price,
      isService: true,
      categoryId: s.categoryId,
    })),
  ]

  const filteredCatalog = catalogProducts.filter((item) => {
    const matchCat = activeCategory === "all" || item.categoryId === activeCategory
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Cart handlers ──────────────────────────────────────────────────────────

  const addToCart = useCallback(
    (item: Omit<CartItem, "key" | "quantity">) => {
      const key = item.productId ? `p-${item.productId}` : `s-${item.serviceId}`
      setCart((prev) => {
        const existing = prev.find((c) => c.key === key)
        if (existing) {
          return prev.map((c) =>
            c.key === key ? { ...c, quantity: c.quantity + 1 } : c
          )
        }
        return [...prev, { ...item, key, quantity: 1 }]
      })
    },
    []
  )

  const updateQty = useCallback((key: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((c) =>
        c.key === key ? { ...c, quantity: c.quantity + delta } : c
      )
      return updated.filter((c) => c.quantity > 0)
    })
  }, [])

  const resetCart = useCallback(() => {
    setCart([])
    setDiscount("")
    setCustomerPhone("")
    setCustomerEmail("")
    setAmountPaid("")
    setMixedCash("")
    setMixedSecond("")
    setMixedSecondMethod("CARD")
    setPaymentMethod("CASH")
  }, [])

  // ── Scanner handler ────────────────────────────────────────────────────────

  const handleScan = useCallback(
    (code: string) => {
      const found = products.find(
        (p) => p.barcode === code || p.sku === code
      )
      if (found) {
        addToCart({ productId: found.id, name: found.name, price: found.price })
        toast.success(`Añadido: ${found.name}`)
      } else {
        toast.warning(`Código no encontrado: ${code}`)
      }
    },
    [products, addToCart]
  )

  // Derived mixed amounts
  const mixedCashNum   = parseFloat(mixedCash) || 0
  const mixedSecondNum = parseFloat(mixedSecond) || Math.max(0, total - mixedCashNum)
  // Card/Transfer can never exceed the remaining balance — terminals don't give change
  const mixedSecondMax      = Math.max(0, total - mixedCashNum)
  const mixedSecondOverpaid = mixedSecondNum > mixedSecondMax + 0.005
  const mixedChange    = Math.max(0, mixedCashNum + mixedSecondNum - total)
  const mixedValid     = mixedCashNum + mixedSecondNum >= total
    && (mixedCashNum > 0 || mixedSecondNum > 0)
    && !mixedSecondOverpaid

  // ── Submit sale ────────────────────────────────────────────────────────────

  const submitSale = useCallback(async () => {
    if (!activeCashCut) return
    if (cart.length === 0) return

    setSubmitting(true)
    try {
      const folio = generateFolio()
      const payload = {
        cashCutId: activeCashCut.id,
        folio,
        items: cart.map((i) => ({
          productId: i.productId,
          serviceId: i.serviceId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        paymentMethod,
        amountPaid: paymentMethod === "MIXED"
          ? mixedCashNum + mixedSecondNum
          : parseFloat(amountPaid) || total,
        discount: discountAmount,
        customerName: undefined,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        // Desglose mixto
        cashAmount:     paymentMethod === "MIXED" ? mixedCashNum : undefined,
        cardAmount:     paymentMethod === "MIXED" && mixedSecondMethod === "CARD" ? mixedSecondNum : undefined,
        transferAmount: paymentMethod === "MIXED" && mixedSecondMethod === "TRANSFER" ? mixedSecondNum : undefined,
      }

      const res = await apiFetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const saleData = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(saleData?.error ?? "Error al registrar la venta")
      }

      const serverFolio: string = saleData.folio ?? folio
      toast.success(`¡Venta registrada! Folio: ${serverFolio}`)
      resetCart()
      setPaymentOpen(false)
      setCartOpen(false)

      // Send WhatsApp ticket as PDF — fire-and-forget, sale already confirmed
      if (customerPhone.trim() && saleData.id) {
        apiFetch("/api/tickets/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizeWAPhone(customerPhone), saleId: saleData.id }),
        }).then(r => {
          if (r.ok) toast.success("Ticket enviado por WhatsApp 📲")
        }).catch(() => {})
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [
    activeCashCut,
    cart,
    paymentMethod,
    amountPaid,
    total,
    discountAmount,
    customerPhone,
    customerEmail,
    mixedCashNum,
    mixedSecondNum,
    mixedSecondMethod,
    resetCart,
  ])

  // ── Payment modal open ─────────────────────────────────────────────────────

  function openPayment() {
    setAmountPaid(total.toString())
    setMixedCash("")
    setMixedSecond(total.toString())
    setPaymentOpen(true)
  }

  // ── Turno handlers ────────────────────────────────────────────────────────

  async function handleOpenTurno() {
    if (turnOpeningBalance === "") {
      toast.error("Ingresa el saldo inicial")
      return
    }
    setTurnOpening(true)
    try {
      const res = await apiFetch("/api/cash-cuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: parseFloat(turnOpeningBalance) || 0 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Error al abrir turno")
        return
      }
      const cut: CashCut = await res.json()
      setActiveCashCut(cut)
      setOpenCutDialog(false)
      setTurnOpeningBalance("")
      toast.success("Turno abierto")
    } catch {
      toast.error("Error de conexión")
    } finally {
      setTurnOpening(false)
    }
  }

  async function handleCloseTurno() {
    if (!activeCashCut) return
    if (turnCountedCash === "") {
      toast.error("Ingresa el efectivo contado")
      return
    }
    if (turnCountedCard === "") {
      toast.error("Ingresa el conteo de tarjeta")
      return
    }
    setTurnClosing(true)
    try {
      const res = await apiFetch(`/api/cash-cuts/${activeCashCut.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countedCash: parseFloat(turnCountedCash) || 0,
          countedCard: parseFloat(turnCountedCard) || 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Error al cerrar turno")
        return
      }
      setActiveCashCut(null)
      setCloseCutDialog(false)
      setTurnCountedCash("")
      setTurnCountedCard("")
      toast.success("Turno cerrado correctamente")
    } catch {
      toast.error("Error de conexión")
    } finally {
      setTurnClosing(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando POS…</div>
      </div>
    )
  }

  return (
    <>
    <div className="relative flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-background">

      {/* ── No cash cut warning ── */}
      {!activeCashCut && (
        <div className="relative z-20 flex items-center gap-2 bg-[#0A0A0A] px-4 py-2.5 text-white/90 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-[var(--rs-gold)]" />
          <span>
            Sin corte de caja abierto.{" "}
            <button
              className="underline underline-offset-2 font-medium text-white"
              onClick={() => { setTurnOpeningBalance(""); setOpenCutDialog(true) }}
            >
              Abrir turno.
            </button>
          </span>
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 shrink-0 bg-background border-b">
        {/* Row 1: back + title + turno + cart */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={() => router.push("/dashboard")}
            aria-label="Volver al dashboard"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <span className="font-bold text-base flex-1">POS</span>
          {activeCashCut ? (
            <button
              onClick={() => { setTurnCountedCash(""); setTurnCountedCard(""); setCloseCutDialog(true) }}
              className="shrink-0"
              aria-label="Cerrar turno"
            >
              <Badge variant="default" className="text-xs cursor-pointer hover:opacity-80 transition-opacity">
                Turno Abierto ▾
              </Badge>
            </button>
          ) : (
            <button
              onClick={() => { setTurnOpeningBalance(""); setOpenCutDialog(true) }}
              className="shrink-0"
              aria-label="Abrir turno"
            >
              <Badge variant="destructive" className="text-xs cursor-pointer hover:opacity-80 transition-opacity">
                Sin Turno ▾
              </Badge>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="relative min-h-[44px] min-w-[44px] shrink-0"
            onClick={() => setCartOpen(true)}
            aria-label={`Carrito, ${cartCount} artículos`}
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground rounded-full">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Button>
        </div>
        {/* Row 2: search + scan */}
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar producto o servicio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-9 text-sm bg-muted/60 rounded-xl border-0 outline-none focus:ring-2 focus:ring-[var(--rs-gold)] placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear código"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E8E8E8] bg-white active:scale-95 transition-transform"
          >
            <ScanBarcode className="size-5 text-[#0A0A0A]" />
          </button>
        </div>
      </header>

      {/* ── Category pills ── */}
      <div className="relative z-20 shrink-0 bg-background border-b">
        <div
          className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {[{ id: "all", name: "Todos" }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-[#0A0A0A] text-white"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product grid ── */}
      <main className="flex-1 overflow-y-auto p-3">
        {filteredCatalog.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            Sin productos en esta categoría
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredCatalog.map((item) => {
              const prod = item.productId
                ? products.find((p) => p.id === item.productId)
                : null
              return (
                <button
                  key={item.key}
                  onClick={() =>
                    addToCart({
                      productId: item.productId,
                      serviceId: item.serviceId,
                      name: item.name,
                      price: item.price,
                    })
                  }
                  className="flex flex-col rounded-xl bg-white shadow-sm overflow-hidden text-left active:scale-[0.97] transition-transform"
                >
                  {/* Image / placeholder */}
                  <div className="w-full aspect-square relative overflow-hidden">
                    {prod?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveUploadUrl(prod.imageUrl)!}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#111] to-[#2a2a2a] flex items-center justify-center">
                        {item.isService ? (
                          <span className="text-[var(--rs-gold)] text-2xl font-black opacity-60">✦</span>
                        ) : (
                          <Gem className="size-7 text-[var(--rs-gold)] opacity-50" />
                        )}
                      </div>
                    )}
                    {item.isService && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full">
                        Serv.
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                      {item.name}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--rs-gold)]">
                      {formatMXN(item.price)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Fixed bottom cart bar ── */}
      {cartCount > 0 && (
        <div className="relative z-20 shrink-0 px-3 py-3 bg-background border-t">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between bg-[#0A0A0A] text-white rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-2.5">
              <span className="bg-[var(--rs-gold)] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
              <span className="text-sm font-semibold">Ver carrito</span>
            </span>
            <span className="text-sm font-bold tabular-nums">{formatMXN(total)}</span>
          </button>
        </div>
      )}

      {/* ── Cart Sheet ── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 w-full sm:max-w-md"
          showCloseButton
        >
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle>Carrito</SheetTitle>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
              El carrito está vacío
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Items list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    {/* Name + price */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatMXN(item.price)} × {item.quantity} ={" "}
                        <span className="font-medium text-foreground">
                          {formatMXN(item.price * item.quantity)}
                        </span>
                      </p>
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => updateQty(item.key, -1)}
                        aria-label="Reducir cantidad"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => updateQty(item.key, 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t px-4 pt-3 pb-4 space-y-3 shrink-0">
                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMXN(subtotal)}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground shrink-0">
                    Descuento
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-9 text-right"
                    inputMode="decimal"
                  />
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-base">Total</span>
                  <span className="text-xl font-bold">{formatMXN(total)}</span>
                </div>

                {/* Customer phone */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                    Teléfono
                  </label>
                  <Input
                    type="tel"
                    placeholder="WhatsApp (ej: 6681234567)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9"
                    inputMode="tel"
                  />
                </div>

                {/* Customer email */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                    Correo
                  </label>
                  <Input
                    type="email"
                    placeholder="Opcional (ticket por email)"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-9"
                    inputMode="email"
                  />
                </div>

                {/* Cobrar */}
                <Button
                  className="w-full min-h-[52px] text-base font-bold bg-[#0A0A0A] text-white hover:opacity-85"
                  onClick={openPayment}
                  disabled={cart.length === 0 || !activeCashCut}
                >
                  Cobrar {formatMXN(total)}
                </Button>
                {!activeCashCut && (
                  <p className="text-center text-xs text-destructive">
                    Abre un corte de caja primero
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Payment Modal ── */}
      <Dialog open={paymentOpen} onOpenChange={(o) => { if (!o) setPaymentOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cobro</DialogTitle>
          </DialogHeader>

          {/* Total display */}
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total a cobrar</p>
            <p className="text-3xl font-bold">{formatMXN(total)}</p>
          </div>

          {/* Payment method — 2×2 grid */}
          <div className="grid grid-cols-2 gap-2">
            {(["CASH", "CARD", "TRANSFER", "MIXED"] as PaymentMethod[]).map((m) => {
              const labels: Record<PaymentMethod, string> = {
                CASH: "Efectivo",
                CARD: "Tarjeta",
                TRANSFER: "Transferencia",
                MIXED: "Mixto",
              }
              return (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl border p-3 text-sm font-medium transition-colors min-h-[48px] ${
                    paymentMethod === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {labels[m]}
                </button>
              )
            })}
          </div>

          {/* Cash fields */}
          {paymentMethod === "CASH" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground shrink-0 w-20">Recibido</label>
                <Input
                  type="number"
                  min={total}
                  step="0.50"
                  placeholder={total.toFixed(2)}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="h-10 text-right font-medium"
                  inputMode="decimal"
                  autoFocus
                />
              </div>
              <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">Cambio</span>
                <span className="font-bold text-lg">{formatMXN(change)}</span>
              </div>
            </div>
          )}

          {/* Mixed payment fields */}
          {paymentMethod === "MIXED" && (
            <div className="space-y-3">
              {/* Row 1: Cash */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium w-20 shrink-0">Efectivo</span>
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="0.00"
                  value={mixedCash}
                  onChange={(e) => {
                    setMixedCash(e.target.value)
                    const cash = parseFloat(e.target.value) || 0
                    setMixedSecond(Math.max(0, total - cash).toFixed(2))
                  }}
                  className="h-10 text-right font-medium"
                  inputMode="decimal"
                  autoFocus
                />
              </div>

              {/* Row 2: Card or Transfer selector + amount */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border overflow-hidden shrink-0">
                  <button
                    onClick={() => setMixedSecondMethod("CARD")}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      mixedSecondMethod === "CARD"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Tarjeta
                  </button>
                  <button
                    onClick={() => setMixedSecondMethod("TRANSFER")}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      mixedSecondMethod === "TRANSFER"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Transfer.
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={mixedSecondMax}
                  step="0.50"
                  placeholder="0.00"
                  value={mixedSecond}
                  onChange={(e) => setMixedSecond(e.target.value)}
                  className={`h-10 text-right font-medium ${mixedSecondOverpaid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  inputMode="decimal"
                />
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total pagado</span>
                  <span className={mixedValid ? "text-foreground font-medium" : "text-destructive font-medium"}>
                    {formatMXN(mixedCashNum + mixedSecondNum)}
                  </span>
                </div>
                {mixedChange > 0 && !mixedSecondOverpaid && (
                  <div className="flex justify-between text-sm font-bold">
                    <span>Cambio</span>
                    <span>{formatMXN(mixedChange)}</span>
                  </div>
                )}
                {mixedSecondOverpaid && (
                  <p className="text-xs text-destructive font-medium">
                    {mixedSecondMethod === "CARD" ? "Tarjeta" : "Transferencia"} no puede exceder el saldo pendiente ({formatMXN(mixedSecondMax)})
                  </p>
                )}
                {!mixedValid && !mixedSecondOverpaid && mixedCashNum + mixedSecondNum < total && (
                  <p className="text-xs text-destructive">
                    Faltan {formatMXN(total - mixedCashNum - mixedSecondNum)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Confirm */}
          <Button
            className="w-full min-h-[52px] text-base font-semibold"
            onClick={submitSale}
            disabled={
              submitting ||
              cart.length === 0 ||
              !activeCashCut ||
              (paymentMethod === "CASH" && (parseFloat(amountPaid) || 0) < total) ||
              (paymentMethod === "MIXED" && !mixedValid)
            }
          >
            {submitting ? "Registrando…" : "Confirmar Venta"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Barcode Scanner ── */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {/* ── Abrir Turno Dialog ── */}
      <Dialog open={openCutDialog} onOpenChange={setOpenCutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pos-opening-balance">Saldo inicial en caja (MXN)</Label>
              <Input
                id="pos-opening-balance"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={turnOpeningBalance}
                onChange={(e) => setTurnOpeningBalance(e.target.value)}
                className="min-h-[48px] text-lg"
                inputMode="decimal"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Efectivo físico en la caja al inicio del turno.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenCutDialog(false)}
              className="min-h-[48px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleOpenTurno}
              disabled={turnOpening}
              className="min-h-[48px]"
            >
              {turnOpening ? "Abriendo..." : "Abrir Turno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cerrar Turno Dialog ── */}
      <Dialog open={closeCutDialog} onOpenChange={(o) => { if (!o) setCloseCutDialog(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar Turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pos-counted-cash">Efectivo contado en caja (MXN)</Label>
              <Input
                id="pos-counted-cash"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={turnCountedCash}
                onChange={(e) => setTurnCountedCash(e.target.value)}
                className="min-h-[48px] text-lg"
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-counted-card">Vouchers de tarjeta (MXN)</Label>
              <Input
                id="pos-counted-card"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={turnCountedCard}
                onChange={(e) => setTurnCountedCard(e.target.value)}
                className="min-h-[48px] text-lg"
                inputMode="decimal"
              />
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Cuenta el efectivo y vouchers físicos. Esta acción cerrará el turno y no podrás registrar más ventas hasta abrir uno nuevo.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseCutDialog(false)}
              className="min-h-[48px]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseTurno}
              disabled={turnClosing}
              className="min-h-[48px]"
            >
              {turnClosing ? "Cerrando..." : "Cerrar Turno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    {/* ── Bottom nav bar ── */}
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex items-stretch h-16">
      <Link
        href="/pos"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-primary"
      >
        <ShoppingCart className="size-5" />
        <span>Caja</span>
      </Link>
      <Link
        href="/ventas"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
      >
        <History className="size-5" />
        <span>Ventas</span>
      </Link>
      <Link
        href="/cortes"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
      >
        <Receipt className="size-5" />
        <span>Cortes</span>
      </Link>
    </nav>
    </>
  )
}

export default function POSPage() {
  return (
    <Suspense>
      <POSContent />
    </Suspense>
  )
}
