"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ShoppingCart,
  ScanBarcode,
  Minus,
  Plus,
  AlertTriangle,
} from "lucide-react"

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
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type PaymentMethod = "CASH" | "CARD" | "TRANSFER"

// ─── Component ────────────────────────────────────────────────────────────────

export default function POSPage() {
  const router = useRouter()

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCashCut, setActiveCashCut] = useState<CashCut | null>(null)
  const [loading, setLoading] = useState(true)

  // UI state
  const [activeCategory, setActiveCategory] = useState("all")
  const [cartOpen, setCartOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [amountPaid, setAmountPaid] = useState("")
  const [submitting, setSubmitting] = useState(false)

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

  const filteredCatalog =
    activeCategory === "all"
      ? catalogProducts
      : catalogProducts.filter((item) => item.categoryId === activeCategory)

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
        amountPaid: parseFloat(amountPaid) || total,
        discount: discountAmount,
        customerName: undefined,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
      }

      const res = await apiFetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? "Error al registrar la venta")
      }

      toast.success(`¡Venta registrada! Folio: ${folio}`)
      resetCart()
      setPaymentOpen(false)
      setCartOpen(false)
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
    resetCart,
  ])

  // ── Payment modal open ─────────────────────────────────────────────────────

  function openPayment() {
    setAmountPaid(total.toString())
    setPaymentOpen(true)
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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── No cash cut warning ── */}
      {!activeCashCut && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-amber-800 text-sm border-b border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Sin corte de caja abierto.{" "}
            <button
              className="underline underline-offset-2 font-medium"
              onClick={() => router.push("/dashboard/cash-cuts")}
            >
              Ve a Cortes para abrir uno.
            </button>
          </span>
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-3 py-2 shrink-0">
        {/* Back */}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[48px] min-w-[48px]"
          onClick={() => router.push("/dashboard")}
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="size-5" />
        </Button>

        {/* Center */}
        <div className="flex flex-1 items-center gap-2">
          <span className="font-semibold text-base">POS</span>
          {activeCashCut ? (
            <Badge variant="default" className="text-xs">
              Corte Abierto
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">
              Sin Corte
            </Badge>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[48px] min-w-[48px]"
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear código"
          >
            <ScanBarcode className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative min-h-[48px] min-w-[48px]"
            onClick={() => setCartOpen(true)}
            aria-label={`Carrito, ${cartCount} artículos`}
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <Badge
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] flex items-center justify-center"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* ── Category tabs ── */}
      <div className="shrink-0 border-b bg-background">
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList
            className="h-auto w-full justify-start overflow-x-auto rounded-none bg-transparent px-3 py-2 gap-1.5"
            style={{ scrollbarWidth: "none" }}
          >
            <TabsTrigger
              value="all"
              className="shrink-0 rounded-full border px-3 py-1.5 text-sm data-active:bg-primary data-active:text-primary-foreground data-active:border-primary"
            >
              Todo
            </TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="shrink-0 rounded-full border px-3 py-1.5 text-sm data-active:bg-primary data-active:text-primary-foreground data-active:border-primary"
              >
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* ── Product grid ── */}
      <main className="flex-1 overflow-y-auto p-3">
        {filteredCatalog.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            Sin productos en esta categoría
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredCatalog.map((item) => (
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
                className="group relative flex min-h-[80px] flex-col items-start justify-between rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 active:scale-[0.98]"
              >
                {item.isService && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
                    Servicio
                  </Badge>
                )}
                <span className="line-clamp-2 text-sm font-medium leading-snug pr-10">
                  {item.name}
                </span>
                <span className="mt-1 text-base font-bold text-primary">
                  {formatMXN(item.price)}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

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
                    placeholder="Opcional (WhatsApp)"
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
                  className="w-full min-h-[52px] text-base font-semibold"
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

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-2">
            {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((m) => {
              const labels: Record<PaymentMethod, string> = {
                CASH: "Efectivo",
                CARD: "Tarjeta",
                TRANSFER: "Transferencia",
              }
              return (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl border p-3 text-sm font-medium transition-colors min-h-[52px] ${
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
                <label className="text-sm text-muted-foreground shrink-0">
                  Recibido
                </label>
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
                <span className="font-bold text-lg">
                  {formatMXN(change)}
                </span>
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
              (paymentMethod === "CASH" &&
                (parseFloat(amountPaid) || 0) < total)
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
    </div>
  )
}
