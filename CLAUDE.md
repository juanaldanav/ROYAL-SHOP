# ROYALE SHOP — POS SaaS-Ready

## Proyecto
POS (Punto de Venta) para joyería y tienda de perforaciones.
Referencia UX: PULPOS — mobile-first, checkout en 3 clics, sin fricción.

## Stack obligatorio
- **App:** Next.js 14+ (App Router) + TypeScript + TailwindCSS + shadcn/ui
- **DB:** PostgreSQL 16 (Docker en GCP VM) + Prisma ORM
- **Tickets:** PDF (`@react-pdf/renderer`) + WhatsApp (`whatsapp-web.js` en servicio aislado)
- **Scanner:** `html5-qrcode` — cámara nativa del dispositivo
- **Deploy:** Docker Compose en GCP VM (`soporte.lamarque.mx`) + Apache2 reverse proxy → :3000

## Estructura del repo
```
D:\lighthouse bot\
├── CLAUDE.md             ← estás aquí
├── docker-compose.yml    ← PostgreSQL + Next.js en prod
├── ROYALESHOP/           ← Next.js app
│   ├── prisma/
│   ├── src/app/
│   └── ...
└── services/
    └── whatsapp/         ← servicio aislado Node.js
```

## Reglas de código (NO romper)
1. **No migres sin aprobación.** Mostrar schema/migración al usuario antes de ejecutar.
2. **Mobile-First estricto.** Toda UI de cajero debe funcionar con el pulgar en iPhone/iPad — botones mínimo 48px touch target.
3. **3 clics para cobrar.** El flujo POS: selecciona producto → revisa carrito → cobra. Cero pantallas intermedias innecesarias.
4. **tenant_id en TODA tabla transaccional.** Sin excepción. Multitenant por columna.
5. **No mutes precio en SaleItem.** Snapshot del precio al momento de venta — inmutable.
6. **Sin sobre-ingeniería.** Si funciona en 20 líneas, no uses 100. Caveman style.
7. **TDD en core.** Sale, SaleItem, CashCut, Inventory — deben tener tests antes de UI.
8. **No toques Apache2.** Proxy via VirtualHost a :3000 — no detener apache2.
9. **No commits sin pruebas pasando.** `npm test` debe pasar antes de `git commit`.

## Arquitectura Multitenant
Estrategia: **Tenant por Columna** (no por esquema).
- `tenant_id: String` en todas las tablas excepto `Tenant` y `User` (User tiene `tenantId`).
- Queries SIEMPRE filtran por `tenantId` — nunca cruzar datos entre tenants.
- Escalar a esquemas separados después del MVP si necesario (ADR pendiente).

## Requisitos Funcionales

### RF-01: POS Modo Enfoque (cajero)
- Ruta: `/pos` — vista exclusiva, sin nav lateral
- Grid de productos/servicios con imagen y precio grande
- Carrito lateral (desktop) o modal (mobile)
- Cobrar en 3 clics: selecciona ítem → revisa total → elige método de pago → confirma
- Soporte: efectivo, tarjeta, transferencia

### RF-02: Escaneo Integrado
- Botón "Escanear" activa cámara nativa via `html5-qrcode`
- Lee código de barras o QR → busca SKU/barcode en DB → agrega al carrito
- Fallback: búsqueda manual por nombre o SKU (sin cámara)
- Venta por concepto libre (sin producto en catálogo)

### RF-03: Tickets por WhatsApp
- Al finalizar venta: captura teléfono del cliente (opcional)
- Genera ticket estructurado (texto formateado o PDF)
- Envía vía WhatsApp Web.js (servicio aislado en :3001)
- Alternativa: descargar PDF / imprimir

### RF-04: Panel de Dueño
- Ruta: `/dashboard` — protegida por rol OWNER/MANAGER
- Métricas: ventas del día, semana, mes
- Cortes de caja históricos con detalle
- CRUD: productos, servicios, categorías, usuarios
- Exportar reportes CSV

### RF-05: Inventario Transaccional
- Stock se descuenta automáticamente al cerrar venta
- Alertas de stock mínimo
- Carga masiva: CSV/Excel upload
- Traspaso entre sucursales con verificación por cámara (QR scan)

## Requisitos No Funcionales

### RNF-01: Mobile-First
- UI cajero: diseñada para iPad (768px) y móvil (390px)
- Sin scroll horizontal NUNCA
- Botones touch: mínimo 48×48px
- Fuente legible sin zoom: mínimo 16px en campos

### RNF-02: Base de Datos
- PostgreSQL — normalización 3NF mínimo
- Prisma migrations con nombres descriptivos
- Backup diario via cron en VM

### RNF-03: Multitenant Ligero
- `tenant_id` en todas las tablas transaccionales
- Diseño permite escalar a SaaS real después del MVP
- Un solo deployment sirve múltiples negocios

### RNF-04: Despliegue
- Next.js en Docker → puerto 3000 (interno)
- Apache2 en VM hace reverse proxy: `soporte.lamarque.mx/pos` → :3000
- SSL: Let's Encrypt ya configurado en VM (cert existente)
- PostgreSQL en Docker → puerto 5432 (solo interno, no expuesto)

## Usuarios del sistema
| Rol | Acceso |
|-----|--------|
| OWNER | Todo — dashboard, config, reportes, CRUD |
| MANAGER | Dashboard, cortes de caja, reportes |
| CASHIER | Solo /pos — cobrar, ver historial propio |

## VM Info
- Host: `soporte.lamarque.mx` (GCP Ubuntu 22.04, 3.8GB RAM)
- SSH: `ssh noreply@soporte.lamarque.mx`
- Apache2 ya tiene SSL (Let's Encrypt) — NO detener
- Servicios existentes intocables: apache2, mariadb, tpeap, GCP ops agent

## Comandos frecuentes
```bash
# Desarrollo local
cd ROYALESHOP && npm run dev

# Prisma
npx prisma migrate dev --name <descripcion>
npx prisma studio

# Tests
npm test
npm run test:watch

# Deploy
docker compose up -d --build
```
