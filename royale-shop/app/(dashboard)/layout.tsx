"use client"

import Link from "next/link"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useSession } from "@/contexts/session-context"
import { toast } from "sonner"

// Primary bottom-nav items (mobile)
const primaryNav = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/ventas",     label: "Ventas",      icon: ShoppingCart },
  { href: "/traspasos",  label: "Traspasos",   icon: ArrowLeftRight },
  { href: "/inventario", label: "Inventario",  icon: BarChart2 },
]

// All nav items (sidebar + overflow sheet)
const allNav = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/ventas",     label: "Ventas",        icon: ShoppingCart },
  { href: "/traspasos",  label: "Traspasos",     icon: ArrowLeftRight },
  { href: "/inventario", label: "Inventario",    icon: BarChart2 },
  { href: "/productos",  label: "Productos",     icon: Package },
  { href: "/servicios",  label: "Servicios",     icon: Scissors },
  { href: "/categorias", label: "Categorías",    icon: Tag },
  { href: "/cortes",     label: "Cortes de Caja",icon: Receipt },
  { href: "/reportes",   label: "Reportes",      icon: TrendingUp },
  { href: "/sucursales", label: "Sucursales",    icon: Store },
  { href: "/cajeros",    label: "Cajeros",       icon: Users },
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
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
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
      <aside className="hidden md:flex flex-col w-60 shrink-0 fixed left-0 top-0 h-screen border-r bg-background z-30">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <Gem className="size-5 text-primary shrink-0" />
          <span className="font-bold text-base">Royale Shop</span>
        </div>

        {/* User info */}
        {user && (
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.branchName} · {user.role}</p>
          </div>
        )}

        {/* Nav */}
        <SidebarLinks />

        {/* Footer: POS + logout */}
        <div className="px-3 py-3 border-t space-y-1.5 mt-auto">
          <Link href="/pos">
            <Button className="w-full h-10 text-sm" variant="default">
              <ShoppingCart className="size-4 mr-2" />
              Ir al POS
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full h-9 text-sm text-muted-foreground justify-start"
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
          <Gem className="size-5 text-primary shrink-0" />
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
            <Link href="/pos">
              <Button size="sm" className="h-9 px-3 shrink-0 text-sm">
                <ShoppingCart className="size-4 mr-1.5" />
                <span className="hidden sm:inline">POS</span>
              </Button>
            </Link>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex items-stretch h-16">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("size-5", active && "text-primary")} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* Más */}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          onClick={() => setMoreOpen(true)}
          aria-label="Más opciones"
        >
          <MoreHorizontal className="size-5" />
          <span>Más</span>
        </button>
      </nav>

      {/* ── Mobile "Más" Sheet ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <Gem className="size-4 text-primary" />
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
            <Link href="/pos" onClick={() => setMoreOpen(false)}>
              <Button className="w-full h-12 text-base" variant="default">
                <ShoppingCart className="size-5 mr-2" />
                Ir al POS
              </Button>
            </Link>
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
