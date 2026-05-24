# ROYALE SHOP POS — Progress Tracker

> Última actualización: 2026-05-24

## Estado General

| Día | Objetivo | Estado |
|-----|----------|--------|
| 1 | Infra + Stack + CRUD Catálogo | ✅ Completo |
| 2 | Vista POS Cajero | ⏳ Pendiente |
| 3 | Ventas + Corte de Caja | ⏳ Pendiente |
| 4 | Tickets WhatsApp | ⏳ Pendiente |
| 5 | Inventario + CSV Import | ⏳ Pendiente |
| 6 | Docker Compose prod + Deploy VM | ⏳ Pendiente |
| 7 | Buffer / Pulido / Tests | ⏳ Pendiente |

---

## ✅ Día 1 — Completado

### Infraestructura Local
- [x] Backup `D:\lighthouse-bot-backup-20260523.zip`
- [x] Directorio limpio — solo `royale-shop/` y `.git`
- [x] CLAUDE.md con stack, reglas y requisitos

### GCP VM (`soporte.lamarque.mx`)
- [x] `/opt/lighthouse-bot` eliminado
- [x] Docker PostgreSQL 16 (`royaleshop-postgres`) corriendo en `127.0.0.1:5432`
- [x] 9 tablas creadas y verificadas
- [x] Seed: Tenant / Branch / User de desarrollo
- [x] **RLS activado en 9/9 tablas** + 9 políticas por tenant

### Stack Next.js
- [x] Next.js 16.2.6 + React 19 + Tailwind v4 + shadcn v4
- [x] Prisma 7.8.0 con `@prisma/adapter-pg`
- [x] Schema aprobado: 9 modelos, tenant_id en todo
- [x] `lib/db.ts` singleton con PrismaPg adapter
- [x] `lib/format.ts` — formatMXN, generateFolio, formatDate

### Seguridad
- [x] `suppressHydrationWarning` — fix extensión Heurio en browser
- [x] `middleware.ts` — CORS: solo origenes permitidos en `/api/*`
- [x] `next.config.ts` — Security headers:
  - Content-Security-Policy (dev/prod diferenciados)
  - Strict-Transport-Security (2 años)
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(self) — necesario para QR scanner
- [x] **PostgreSQL RLS** en todas las tablas con datos de usuario

### UI — Dashboard
- [x] Header sticky mobile-first (hamburger → Sheet drawer)
- [x] Navegación: Dashboard / Productos / Servicios / Categorías / Ventas / Cortes
- [x] CRUD Productos — tabla + dialog create/edit + toggle activo
- [x] CRUD Servicios — tabla + dialog create/edit + toggle activo
- [x] CRUD Categorías — tabla + dialog create
- [x] `/pos` — scaffold (Día 2)

### API Routes
- [x] `GET/POST /api/products`
- [x] `PATCH/DELETE /api/products/[id]`
- [x] `GET/POST /api/services`
- [x] `PATCH/DELETE /api/services/[id]`
- [x] `GET/POST /api/categories`
- [x] `POST /api/seed` (solo dev)

---

## ⏳ Día 2 — POS View (Cajero)

### Objetivo
Vista `/pos` estilo PULPOS: cobrar en 3 clics.

### Tareas
- [ ] Grid de productos/servicios con categorías como tabs horizontales
- [ ] Carrito: Sheet lateral (tablet) / bottom drawer (mobile)
- [ ] Resumen de venta: subtotal, descuento, total
- [ ] Modal de cobro: efectivo / tarjeta / transferencia
- [ ] Generar folio (`VTA-YYYYMMDD-XXXX`)
- [ ] Botón "Escanear" — placeholder (html5-qrcode Día 5)
- [ ] Buscar producto por nombre/SKU
- [ ] API `POST /api/sales` — crear venta y descontar stock

---

## ⏳ Día 3 — Ventas + Corte de Caja

- [ ] `GET /api/sales` — historial paginado
- [ ] `GET /api/cash-cuts` / `POST /api/cash-cuts`
- [ ] UI: lista de ventas del día
- [ ] UI: abrir / cerrar corte de caja
- [ ] Dashboard: métricas (ventas hoy, semana, mes)

---

## ⏳ Día 4 — Tickets WhatsApp

- [ ] Servicio aislado `services/whatsapp/` (Node.js + whatsapp-web.js)
- [ ] Generar ticket texto formateado (o PDF con @react-pdf/renderer)
- [ ] `POST /api/tickets/whatsapp` → envía al número del cliente
- [ ] Fallback: download PDF

---

## ⏳ Día 5 — Inventario + CSV

- [ ] Página `/inventario` con stock en tiempo real
- [ ] Alertas de stock mínimo
- [ ] Upload CSV para carga masiva de productos
- [ ] Traspaso entre sucursales (QR verification con html5-qrcode)

---

## ⏳ Día 6 — Deploy en VM

- [ ] `docker-compose.yml` producción (Next.js + PostgreSQL)
- [ ] `Dockerfile` para Next.js app
- [ ] Apache2 VirtualHost → proxy a Next.js :3000
- [ ] Variables de entorno en VM (`.env.production`)
- [ ] First deploy y smoke test

---

## Notas Técnicas

### RLS (Row Level Security)
- **Estado:** Habilitado en 9/9 tablas, 9 políticas `FOR ALL TO PUBLIC`
- **Mecánica:** `royale` (owner) bypasa RLS por defecto en PostgreSQL
- **Protección real:** cualquier rol no-owner que acceda directo a la BD solo ve datos del tenant con `app.current_tenant` seteado
- **TODO post-MVP:** crear `royale_app` (non-owner) + Prisma `$extends` que ejecute `SET LOCAL app.current_tenant = tenantId` antes de cada query → RLS estricto en capa de app también

### CORS
- Dev: `localhost:3000`, `localhost:3001`
- Prod: `NEXT_PUBLIC_APP_URL` (default: `https://soporte.lamarque.mx`)
- Requests sin `Origin` header → permitidos (same-origin, herramientas CLI)
- Origins no permitidos → 403

### SSH Tunnel (dev local)
```powershell
Start-Job -ScriptBlock { ssh -N -L 5432:127.0.0.1:5432 noreply@soporte.lamarque.mx }
```
Necesario antes de `npx prisma db push` o `npx prisma generate`.

### Prisma 7 Quirks
- Import: `@/app/generated/prisma/client` (NO `@/app/generated/prisma`)
- Client: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- datasource URL va en `prisma.config.ts`, NO en `schema.prisma`
- `schema.prisma` SÍ necesita `datasource db { provider = "postgresql" }` (sin url)

### Tailwind v4 Quirks
- Sin `tailwind.config.js` — configuración via CSS en `globals.css`
- `@import "tailwindcss"` en vez de `@tailwind base/components/utilities`
- `@theme inline { }` para CSS variables

---

## GCP VM — Snapshot actual

```
Host:      soporte.lamarque.mx
OS:        Ubuntu 22.04
RAM:       3.8GB / 1.3GB used / 2.2GB free
Disk:      29GB / 17GB used / 13GB free

Servicios activos:
  apache2     → :80, :443 (Omada proxy + SSL Let's Encrypt)
  jsvc        → :8043, :8088, :8843 (Omada Controller)
  mariadbd    → :3306 (internal)
  mongod      → :27217 (internal)
  sshd        → :22

Docker:
  royaleshop-postgres  → 127.0.0.1:5432 (postgres:16-alpine)
  
Pendiente deploy:
  royaleshop-nextjs    → 127.0.0.1:3000 (Día 6)
```
