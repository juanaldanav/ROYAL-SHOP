"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Package,
  Scissors,
  Tag,
  ShoppingCart,
  Receipt,
  Gem,
  BarChart2,
  Store,
  Users,
  TrendingUp,
  LogOut,
  ArrowLeftRight,
  MoreHorizontal,
  X,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useSession } from "@/contexts/session-context"
import { toast } from "sonner"

// Bottom-nav: 2 left + 2 right (center is the FAB)
const leftNav = [
  { href: "/dashboard",  label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventas",     label: "Ventas",     icon: ShoppingCart },
]
const rightNav = [
  { href: "/traspasos",  label: "Traspasos",  icon: ArrowLeftRight },
  { href: "/inventario", label: "Inventario", icon: BarChart2 },
]

// All nav items (sidebar + overflow sheet)
const allNav = [
  { href: "/dashboard",  label: "Dashboard",     icon: LayoutDashboard },
  { href: "/ventas",     label: "Ventas",         icon: ShoppingCart },
  { href: "/traspasos",  label: "Traspasos",      icon: ArrowLeftRight },
  { href: "/inventario", label: "Inventario",     icon: BarChart2 },
  { href: "/productos",  label: "Productos",      icon: Package },
  { href: "/servicios",  label: "Servicios",      icon: Scissors },
  { href: "/categorias", label: "Categorías",     icon: Tag },
  { href: "/cortes",     label: "Cortes de Caja", icon: Receipt },
  { href: "/reportes",   label: "Reportes",       icon: TrendingUp },
  { href: "/sucursales", label: "Sucursales",     icon: Store },
  { href: "/cajeros",    label: "Cajeros",        icon: Users },
]

const pageTitles: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/productos":  "Productos",
  "/servicios":  "Servicios",
  "/categorias": "Categorías",
  "/ventas":     "Ventas",
  "/cortes":     "Cortes de Caja",
  "/inventario": "Inventario",
  "/reportes":   "Reportes",
  "/sucursales": "Sucursales",
  "/cajeros":    "Cajeros",
  "/traspasos":  "Traspasos",
}

function SidebarLinks({ onSelect }: { onSelect?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {allNav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onSelect}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
            pathname === href
              ? "bg-[var(--rs-gold-subtle)] text-foreground font-semibold"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
          {pathname === href && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--rs-gold)]" />
          )}
        </Link>
      ))}
    </nav>
  )
}

function NavTab({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: React.ElementType
}) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [ventaOpen, setVentaOpen] = useState(false)
  const { user, loaded, logout } = useSession()
  const title = pageTitles[pathname] ?? "Royale Shop"

  useEffect(() => {
    if (loaded && !user) {
      router.replace("/login")
    }
  }, [loaded, user, router])

  function handleLogout() {
    logout()
    toast.success("Sesión cerrada")
    router.replace("/login")
  }

  if (!loaded) return null

  return (
    <div className="flex min-h-screen bg-muted/40">

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 fixed left-0 top-0 h-screen bg-white z-30">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E8E8E8]">
          <Image src="/logo.jpg" alt="Royal Shop" width={34} height={34} className="rounded-full object-cover shrink-0" />
          <span className="font-bold text-base">Royale Shop</span>
        </div>

        {user && (
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.branchName} · {user.role}</p>
          </div>
        )}

        <SidebarLinks />

        {/* Transición blanco → negro */}
        <div className="h-10 relative shrink-0 bg-white overflow-hidden">
          <svg viewBox="0 0 240 42" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-full">
            <path d="M0,42 L0,36 C60,36 60,6 120,6 C180,6 180,36 240,36 L240,42 Z" fill="#0A0A0A"/>
          </svg>
        </div>

        {/* Sección negra */}
        <div className="bg-[#0A0A0A] px-3 pb-5 pt-1 space-y-2 shrink-0">
          <Link href="/pos">
            <Button className="w-full h-10 text-sm font-bold bg-[var(--rs-gold)] text-black hover:opacity-85">
              <ShoppingCart className="size-4 mr-2" />
              Ir al POS
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full h-9 text-xs text-white/40 hover:text-white/70 justify-start"
            onClick={handleLogout}
          >
            <LogOut className="size-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 md:ml-60">

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 bg-background border-b shadow-sm">
          <Image src="/logo.jpg" alt="Royal Shop" width={30} height={30} className="rounded-full object-cover shrink-0" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-bold text-base truncate">Royale Shop</span>
            <span className="text-muted-foreground hidden sm:inline text-sm">·</span>
            <span className="text-sm text-muted-foreground hidden sm:inline truncate">{title}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                {user.name} · {user.branchName}
              </span>
            )}
            <Button
              size="sm"
              className="h-9 px-3 shrink-0 text-sm"
              onClick={() => setVentaOpen(true)}
            >
              <Plus className="size-4 mr-1.5" />
              <span className="hidden sm:inline">Hacer Venta</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 md:flex hidden"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 pb-20 md:pb-0">
          <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex items-center h-16">
        {/* Left: Dashboard + Ventas */}
        {leftNav.map((item) => (
          <NavTab key={item.href} {...item} />
        ))}

        {/* Center button — Hacer Venta */}
        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={() => setVentaOpen(true)}
            aria-label="Hacer venta"
            className="flex flex-col items-center gap-0.5"
          >
            <span className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-primary active:scale-95 transition-transform shadow-sm">
              <Plus className="size-4 text-primary-foreground" strokeWidth={2.5} />
              <span className="text-primary-foreground text-sm font-semibold">Venta</span>
            </span>
          </button>
        </div>

        {/* Right: Inventario + Más */}
        {rightNav.map((item) => (
          <NavTab key={item.href} {...item} />
        ))}

        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          onClick={() => setMoreOpen(true)}
          aria-label="Más opciones"
        >
          <MoreHorizontal className="size-5" />
          <span>Más</span>
        </button>
      </nav>

      {/* ── "Hacer Venta" Overlay ── */}
      {ventaOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setVentaOpen(false)}
        >
          {/* Title */}
          <p className="text-white/60 text-sm font-medium mb-8 tracking-widest uppercase">
            ¿Cómo quieres vender?
          </p>

          {/* Cards */}
          <div
            className="flex gap-5 px-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* POS */}
            <button
              className="flex-1 flex flex-col items-center gap-4 rounded-3xl bg-white/10 border border-white/20 py-8 px-4 hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md"
              onClick={() => {
                setVentaOpen(false)
                router.push("/pos")
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-16 h-16 text-white"
              >
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <div className="text-center">
                <p className="text-white text-xl font-bold tracking-wide">POS</p>
                <p className="text-white/60 text-xs mt-1">Catálogo de productos</p>
              </div>
            </button>

            {/* ESCANEAR */}
            <button
              className="flex-1 flex flex-col items-center gap-4 rounded-3xl bg-white/10 border border-white/20 py-8 px-4 hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md"
              onClick={() => {
                setVentaOpen(false)
                router.push("/pos?scan=1")
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-16 h-16 text-white"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="8" y1="12" x2="8" y2="12" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="16" y1="12" x2="16" y2="12" />
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <div className="text-center">
                <p className="text-white text-xl font-bold tracking-wide">ESCANEAR</p>
                <p className="text-white/60 text-xs mt-1">Leer código de barras</p>
              </div>
            </button>
          </div>

          {/* Dismiss hint */}
          <p className="text-white/30 text-xs mt-10">Toca afuera para cerrar</p>
        </div>
      )}

      {/* ── Mobile "Más" Sheet ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <Image src="/logo.jpg" alt="Royal Shop" width={24} height={24} className="rounded-full object-cover" />
              <SheetTitle className="font-bold text-base">Menú</SheetTitle>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setMoreOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          {user && (
            <div className="px-5 py-2.5 border-b bg-muted/30">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.branchName} · {user.role}</p>
            </div>
          )}

          <nav className="grid grid-cols-2 gap-1 p-3">
            {allNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="px-4 pb-6 pt-2 border-t space-y-2">
            <button
              onClick={() => { setMoreOpen(false); setVentaOpen(true) }}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2"
            >
              <Plus className="size-5" />
              Hacer Venta
            </button>
            <Button
              variant="outline"
              className="w-full h-10 text-sm"
              onClick={() => { setMoreOpen(false); handleLogout() }}
            >
              <LogOut className="size-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
