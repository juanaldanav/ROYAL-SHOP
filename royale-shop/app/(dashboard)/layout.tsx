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
  Settings,
  Gem,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/servicios", label: "Servicios", icon: Scissors },
  { href: "/categorias", label: "Categorías", icon: Tag },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/cortes", label: "Cortes de Caja", icon: Receipt },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-muted/40">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-background border-r">
        {/* Brand */}
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <Gem className="size-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Royale Shop</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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

        {/* Bottom */}
        <div className="px-3 py-4 border-t">
          <Link
            href="/pos"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <ShoppingCart className="size-4" />
            Ir al POS
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  )
}
