"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Scissors,
  Tag,
  ShoppingCart,
  Receipt,
  Gem,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/servicios", label: "Servicios", icon: Scissors },
  { href: "/categorias", label: "Categorías", icon: Tag },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/cortes", label: "Cortes de Caja", icon: Receipt },
]

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/productos": "Productos",
  "/servicios": "Servicios",
  "/categorias": "Categorías",
  "/ventas": "Ventas",
  "/cortes": "Cortes de Caja",
}

function NavLinks({ onSelect }: { onSelect?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onSelect}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors",
            pathname === href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-5 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const title = pageTitles[pathname] ?? "Royale Shop"

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-background border-b shadow-sm">
        {/* Hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </Button>

        {/* Brand + page title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Gem className="size-5 text-primary shrink-0" />
          <span className="font-bold text-base truncate">Royale Shop</span>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <span className="text-sm text-muted-foreground hidden sm:inline truncate">{title}</span>
        </div>

        {/* POS shortcut */}
        <Link href="/pos">
          <Button size="sm" className="h-9 px-3 shrink-0 text-sm">
            <ShoppingCart className="size-4 mr-1.5" />
            <span className="hidden sm:inline">POS</span>
          </Button>
        </Link>
      </header>

      {/* ── Drawer Navigation ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <Gem className="size-5 text-primary" />
              <SheetTitle className="font-bold text-base">Royale Shop</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Nav links */}
          <NavLinks onSelect={() => setOpen(false)} />

          {/* Divider + POS button */}
          <div className="px-4 py-4 border-t mt-auto">
            <Link href="/pos" onClick={() => setOpen(false)}>
              <Button className="w-full h-12 text-base" variant="default">
                <ShoppingCart className="size-5 mr-2" />
                Ir al POS
              </Button>
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Page Content ── */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  )
}
