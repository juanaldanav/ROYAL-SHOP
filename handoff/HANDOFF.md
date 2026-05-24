# Royal Shop — Design System Handoff

> Instrucciones para implementar el nuevo diseño en el proyecto Next.js existente.
> Analiza cada sección y aplica solo lo que mejore sin romper la funcionalidad actual.

---

## 1. Tokens de color (globals.css)

Copia el contenido de `handoff/brand-tokens.css` en `royale-shop/app/globals.css`.

Los cambios clave sobre el sistema actual (oklch sin chroma = gris puro):

| Token | Antes | Después |
|---|---|---|
| `--primary` | negro neutro | negro `#0A0A0A` (igual, pero intencional) |
| `--accent` | no existía | dorado `#D4A820` |
| `--border` | 0% gris | `#E8E8E8` muy sutil |
| `--radius` | `0.5rem` | `0.625rem` (10px) |
| `--rs-gold` | — | `#D4A820` (nueva variable de marca) |

---

## 2. Logo (public/)

Guarda el logo original como:
```
royale-shop/public/logo.jpg   (original circular negro/dorado)
```

Para usarlo en componentes:
```tsx
// En el sidebar layout.tsx — reemplaza el <Gem> icon
<Image
  src="/logo.jpg"
  alt="Royal Shop"
  width={38} height={38}
  className="rounded-full object-cover shrink-0"
/>

// En la pantalla de login
<Image
  src="/logo.jpg"
  alt="Royal Shop"
  width={120} height={120}
  className="rounded-full object-cover mx-auto"
/>
```

---

## 3. Sidebar (app/(dashboard)/layout.tsx)

### 3a. Cambios de color

Busca la clase del `<aside>` y cambia:
```tsx
// ANTES
className="hidden md:flex flex-col w-60 ... border-r bg-background"

// DESPUÉS — sidebar blanco, sin border-r visible
className="hidden md:flex flex-col w-60 ... bg-white"
```

### 3b. Nav items activos (SidebarLinks)

```tsx
// ANTES
pathname === href
  ? "bg-primary text-primary-foreground"
  : "text-muted-foreground hover:bg-muted hover:text-foreground"

// DESPUÉS — fondo dorado sutil, sin border-left, punto indicador
pathname === href
  ? "bg-[#D4A82014] text-foreground font-semibold"
  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
```

Agrega el punto dorado al item activo:
```tsx
{pathname === href && (
  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--rs-gold)]" />
)}
```

### 3c. Ola negra al fondo del sidebar

Añade esto ANTES de la sección de botones (`Ir al POS` / `Cerrar Sesión`):

```tsx
{/* Transición blanco → negro */}
<div className="h-10 relative shrink-0 bg-white overflow-hidden">
  <svg viewBox="0 0 240 42" preserveAspectRatio="none"
    className="absolute bottom-0 left-0 w-full h-full">
    <path d="M0,42 L0,36 C60,36 60,6 120,6 C180,6 180,36 240,36 L240,42 Z"
      fill="#0A0A0A"/>
  </svg>
</div>

{/* Sección negra */}
<div className="bg-[#0A0A0A] px-3 pb-4 pt-1 space-y-2 shrink-0">
  {/* botón Ir al POS */}
  <Link href="/pos">
    <Button className="w-full h-10 text-sm bg-[var(--rs-gold)] text-black hover:opacity-85 font-bold">
      <ShoppingCart className="size-4 mr-2" />
      Ir al POS
    </Button>
  </Link>
  {/* botón Cerrar Sesión */}
  <Button variant="ghost" className="w-full h-9 text-xs text-white/40 hover:text-white/70 justify-start" onClick={handleLogout}>
    <LogOut className="size-4 mr-2" />
    Cerrar Sesión
  </Button>
</div>
```

---

## 4. Precios en el POS (app/(pos)/pos/page.tsx)

Cambia el color de los precios de `text-primary` a dorado:

```tsx
// ANTES
<span className="mt-1 text-base font-bold text-primary">

// DESPUÉS
<span className="mt-1 text-base font-bold text-[var(--rs-gold)]">
```

---

## 5. Botón "Cobrar" en el carrito

```tsx
// Hazlo más prominente — fondo negro, texto blanco
<Button className="w-full min-h-[52px] text-base font-bold bg-[#0A0A0A] text-white hover:opacity-85">
  Cobrar {formatMXN(total)}
</Button>
```

---

## 6. Pantalla de Login (app/(auth)/login/page.tsx)

Reemplaza el icono `<Gem>` con el logo real:
```tsx
// ANTES
<Gem className="size-10 text-primary" />

// DESPUÉS
<Image src="/logo.jpg" alt="Royal Shop" width={110} height={110}
  className="rounded-full object-cover mx-auto mb-4" />
```

---

## 7. Animaciones (globals.css)

Añade al final de globals.css:
```css
/* Transición de páginas suave */
@keyframes pageSlideIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
.page-enter {
  animation: pageSlideIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Ripple para nav items */
@keyframes rippleSpread {
  from { transform: scale(0); opacity: 0.5; }
  to   { transform: scale(28); opacity: 0; }
}

/* Animación de éxito en cobro */
@keyframes successPop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1);   opacity: 1; }
}
```

---

## 8. Tipografía

Cambia la fuente en `layout.tsx`:
```tsx
// ANTES (Inter u otra)
import { Inter } from 'next/font/google'

// DESPUÉS
import { DM_Sans } from 'next/font/google'
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300','400','500','600','700','800'] })
```

---

## 9. Qué NO cambiar

- La lógica de autenticación y sesiones
- Los contextos (`session-context`, `api-client`)
- Las rutas API (`/api/products`, `/api/sales`, etc.)
- El schema de Prisma
- La lógica del POS (carrito, cálculos, scanner)
- Los componentes UI de shadcn (solo modificar tokens CSS)

---

## 10. Para tickets de venta

En el componente de confirmación de venta, añade el logo:
```tsx
<div className="text-center border-b pb-4 mb-4">
  <Image src="/logo.jpg" alt="Royal Shop" width={60} height={60}
    className="rounded-full mx-auto mb-2"/>
  <p className="font-bold text-sm">Royal Shop</p>
  <p className="text-xs text-muted-foreground">Piercing &amp; Joyería</p>
</div>
```

---

## Resumen de colores finales

```
Fondo general:    #F7F7F7
Tarjetas / cards: #FFFFFF  (sin sombra, solo sobre el fondo gris)
Texto principal:  #0A0A0A
Texto muted:      #737373
Dorado (acento):  #D4A820
Dorado sutil bg:  #D4A82014
Negro sidebar:    #0A0A0A
Borde:            #E8E8E8  (solo donde estrictamente necesario)
Verde estado:     #1A7A2E  (Abierta / Activo)
Rojo error:       #CC2020
```
