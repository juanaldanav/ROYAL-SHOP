# Royale Shop — Estado del Proyecto

> Actualizado: 2026-05-25
> Propósito: punto de referencia si se cierra la terminal para no perder contexto.

---

## ✅ FUNCIONA (listo para producción)

### Core POS
- **POS `/pos`**: grid de productos+servicios, carrito lateral, cobro en 3 pasos, métodos de pago (efectivo/tarjeta/transferencia/mixto), cambio calculado, descuento opcional, barra inferior fija con total al tener ítems en carrito
- **Escáner de códigos**: `html5-qrcode` integrado, cámara nativa, fallback manual
- **Cortes de caja**: abrir con saldo inicial, cerrar con conteo físico, diferencia automática, estado OPEN/CLOSED, enlazado a ventas
- **Stock**: descuenta inventario automáticamente al cerrar venta (transaccional, sin negativos)
- **Inventario `/inventario`**: edición inline de stock, CSV import, alertas de stock bajo, filtros

### Dashboard y Reportes
- **Dashboard `/dashboard`**: KPIs hoy vs ayer (ventas, tickets, ticket prom.), semana, mes, utilidad, métodos de pago del día, desglose por sucursal (cuando hay +1 sucursal)
- **Ventas `/ventas`**: historial con filtro de fecha SERVER-SIDE (límite 200), búsqueda por texto, detalle de venta, vista de ticket con logo SVG
- **Reportes `/reportes`**: estadísticas por período (hoy/7d/30d), por sucursal, top productos

### Auth y Seguridad
- **Login `/login`**: PIN de 4 dígitos, selector de sucursal, teclado físico + touch, logo Stitch, fondo negro, PIN dots dorados
- **Roles**: OWNER / MANAGER / CASHIER (sesión en localStorage, headers x-tenant-id/x-branch-id/x-user-id)
- **Multi-tenant**: `tenantId` en todas las tablas transaccionales, `getSession()` en todas las rutas API

### Diseño
- **Design system**: DM Sans (fuente correctamente aplicada via `--font-sans`), dorado `#D4A820`, negro `#0A0A0A`, fondo `#F7F7F7`, cards `bg-white rounded-2xl` sin bordes visibles
- **Logo**: imagen Stitch (diamante dorado en blob negro) en `public/logo.png`, componente en `components/ui/royale-logo.tsx`
- **Mobile**: bottom nav, sheet "Más" sin doble X (`showCloseButton={false}`), carrito fijo en POS
- **Sidebar**: wave SVG blanco→negro, botón "Ir al POS" dorado, punto indicador dorado en nav activo

### CRUD Admin
- Productos, Servicios, Categorías, Cajeros, Sucursales — CRUD completo con shadcn dialogs
- Imágenes de producto: upload + servidas via `/api/uploads/` (Docker volume persistente)

### Configuración del negocio (`/configuracion`)
- Nombre del negocio, teléfono, logo — guardados en DB, reflejados en tiempo real en toda la app
- Logo y nombre dinámicos en sidebar, header y sheet móvil
- WhatsApp QR visible directamente desde `/configuracion` (sin SSH)

### Tickets
- Ticket en pantalla muestra nombre real, teléfono y logo del negocio (desde DB)
- WhatsApp auto-send al cobrar: si se captura teléfono del cliente, el ticket se envía automáticamente
- Formato texto con folio, fecha, sucursal, items, total y método de pago

### Base de Datos (VM: soporte.lamarque.mx)
- Container: `royaleshop-postgres`, DB: `royaleshop`, user: `royale`
- Sucursales: `Explanada` (clx_dev_branch_001), `Sendero` (clx_dev_branch_002)
- TenantId único MVP: `clx_dev_tenant_001`
- Acceso: `ssh noreply@soporte.lamarque.mx` → `sudo docker exec royaleshop-postgres psql -U royale royaleshop`

---

## 🚧 PARCIAL (funciona pero incompleto)

| Feature | Avance | Qué falta |
|---|---|---|
| Reportes CSV export | 60% | Botón de descarga CSV — EN PAUSA |
| PDF de ticket | 100% | `lib/generate-ticket-pdf.tsx` + `/send-file` en WA svc — deployado |
| Admin reset endpoint | dev-only | Acotar por tenantId, no borrar todo |

---

## 🗂️ BACKLOG ACTIVO — Orden de ejecución

### ✅ FASE 1: Protección de API (COMPLETADA)
- `assertManagerOrOwner` en: `inventory/[id]` PATCH, `transfers/` POST, `transfers/[id]` PATCH, `products/upload` POST
- Filtro `branchId` forzado para CASHIER en GET: ventas, inventario, reportes
- Cash-cuts: CASHIER solo opera sobre su propia sucursal (`branchId` de sesión)

---

### 🔲 FASE 2: Cancelaciones Post-Corte
**Backend:**
- Nuevo modelo `CashMovement` en Prisma (tipo REFUND/EXPENSE, ligado a `CashCut` activo y `Sale` cancelada)
- `POST /api/sales/[id]/cancel` con `$transaction`:
  1. Marca `Sale` como `CANCELLED` (soft delete, conserva folio)
  2. Restaura stock en `BranchStock` por cada `SaleItem` con `productId`
  3. Si el `CashCut` de la venta está `CLOSED` → crea `CashMovement(REFUND)` en el corte ACTUAL abierto
  4. Si el `CashCut` está `OPEN` → solo marca cancelada (el cierre ya excluye status ≠ COMPLETED)
- Actualizar cálculo de `expectedCash` al cerrar corte para descontar `CashMovements` de tipo REFUND
- Autorización: requiere PIN de MANAGER o OWNER (verificado en DB)
- Tests unitarios validando la regla contable post-corte

**UI (PASO 2):**
- Vista/modal "Buscador de Folios" en `/ventas`
- Detalle de ticket + botón rojo "Cancelar Ticket"
- Modal de autorización con PIN de GERENTE/OWNER
- Badge `CANCELADO` en la venta tras confirmar

**Reportes BI (PASO 3):**
- Dashboard: separar Ventas Brutas / Devoluciones / Ventas Netas
- Mobile-First

---

### 🔲 FASE 3: Cuadre Físico de Caja
- Validar vouchers de tarjeta vs monto de tarjeta en sistema al cerrar turno
- Validar efectivo físico vs efectivo esperado (ya parcialmente implementado)
- UI de conteo físico billetes/monedas

---

### 🔲 FASE 4: UX y Validaciones
- Bloquear excedente en pago con tarjeta (no puede pagar más de lo necesario)
- Dropdown multi-sucursal para OWNER en el header (ver datos de cualquier sucursal)
- Asignar múltiples sucursales a usuarios en Admin

---

### 🔲 FASE 5: Producción
- Cambiar typo "royale" → "Royal" en textos visibles al usuario
- Validar Logo PWA en dispositivos reales
- Script `seed-clean.ts` para demo reproducible

---

## 🔧 DEUDA TÉCNICA (no urgente)
- **PIN en texto plano.** Los PINs de cajeros/owner se guardan sin hashear en
  DB; el login (`/api/auth/login`) compara en texto plano. Aceptable para MVP.
  Antes de onboarding masivo de clientes: hashear con bcrypt en login + seed +
  `scripts/create-tenant.ts` (migrar los PINs existentes). No urgente hoy.

## ⏸️ EN PAUSA
- Reportes CSV export (botón falta, lógica está al 60%)

## 📅 EN EL RADAR (siguiente sprint)

### PDF de ticket para WhatsApp ✅ COMPLETADO
- `lib/generate-ticket-pdf.tsx`: template @react-pdf con logo, folio, items, totales, método de pago
- `services/whatsapp/server.js`: `POST /send-file` con `MessageMedia` de whatsapp-web.js
- `app/api/tickets/whatsapp/route.ts`: POST acepta `{ phone, saleId }`, genera PDF en servidor, envía vía WhatsApp; fallback a texto si falla
- POS: simplificado — pasa `saleId` al backend, que maneja todo

### Cancelación de ventas con PIN
- Lógica de cancelación ya implementada en backend (`PATCH /api/sales/[id]`)
- Falta: test del flujo completo, restauración de stock, refund en corte cerrado

### Detalle de corte cerrado (ver ventas incluidas)
- En `/cortes`, al ver un corte CLOSED poder expandir y ver las ventas que lo componen

### Email SMTP
- Envío de ticket por correo al cliente (`nodemailer` + Gmail app password)

## 🐛 BUGS CORREGIDOS (sesión 2026-05-31)

| Bug | Fix aplicado |
|---|---|
| Sistema NO multitenant: login hardcodeaba `DEV_TENANT_ID` | `/api/auth/login` ahora resuelve el tenant desde `branchId` (cuid global único) — sin tenantId fijo |
| Selector de sucursal en /login solo mostraba el tenant DEV | Nuevo endpoint público `GET /api/auth/branches` lista sucursales de todos los negocios; chip muestra el negocio cuando hay >1 tenant |
| `/configuracion`: polling WhatsApp con `clearInterval` dentro del updater de estado (impuro) + fetch infinito | Reescrito: `fetchWAStatus` devuelve `ready`; el `setInterval` se detiene al conectar; cleanup seguro |
| `/configuracion`: preview de logo daba 404 con URLs legacy `/uploads/...` | `resolveLogoSrc` aplica el mismo criterio que el sidebar (`/uploads/`→`/api/uploads/`) |
| `/configuracion`: `export const dynamic = "force-dynamic"` en archivo `"use client"` (no-op) | Eliminado |

**Nuevos archivos:** `scripts/create-tenant.ts` (onboarding), `app/api/auth/branches/route.ts` (selector login), `__tests__/auth/login-multitenant.test.ts`.

---

## 🐛 BUGS CORREGIDOS (sesión 2026-05-25)

| Bug | Fix aplicado |
|---|---|
| WhatsApp spinner infinito en /configuracion | URL incorrecta `/status` (404) + sin manejo de error → `wa` nunca salía de `null` |
| Logo y nombre hardcodeados en layout | Layout ahora fetcha `/api/tenant` y usa valores de DB |
| Ticket dice "ROYALE SHOP" | `TicketView` recibe `tenant.name` desde DB |
| Ticket sin teléfono del negocio | `TicketView` muestra `tenant.phone` si está configurado |
| Imágenes de producto no se muestran | Ruta `/api/uploads/[...path]` sirve archivos desde filesystem |
| URLs de imágenes antiguas `/uploads/...` rotas | Helper `resolveUploadUrl` convierte a `/api/uploads/...` en frontend |
| Folio en toast venía del cliente, no del servidor | `submitSale` ahora lee `saleData.folio` de la respuesta |

---

## 🐛 BUGS CORREGIDOS EN ESTA SESIÓN

| Bug | Fix aplicado |
|---|---|
| Font Times New Roman | `variable: "--font-sans"` en layout.tsx + `font-sans` en `<html>` |
| Doble X en Sheet "Más" | `showCloseButton={false}` en SheetContent del layout |
| `SelectValue` render-prop inválido | Reemplazado con `placeholder` prop |
| `sales/[id]` usaba DEV_TENANT_ID | Reemplazado con `getSession(req)` |
| `services/[id]` sin getSession + sin try/catch | Corregido |
| `categories/[id]` WHERE sin tenantId | Añadido `tenantId` en update/delete |
| Ventas: filtro fecha client-side sobre 50 registros | Server-side con límite 200 |
| Sucursal "Sucursal Centro" | Renombrado a "Explanada" en DB |
| Sucursal "Sucursal Sendero" | Renombrado a "Sendero" en DB |
| `/logo.jpg` no existía | Copiado logo Stitch a `public/logo.png`, referencias actualizadas |
| Logo SVG manual no coincidía con Stitch | Reemplazado con imagen real del handoff |

---

## 🗺️ ENTORNO DE PRODUCCIÓN

```
VM:    soporte.lamarque.mx (GCP Ubuntu 22.04)
SSH:   ssh noreply@soporte.lamarque.mx
App:   Docker :3000 (reverse proxy Apache2)
DB:    sudo docker exec royaleshop-postgres psql -U royale royaleshop

Deploy (cuando esté aprobado):
  sudo docker compose -f docker-compose.prod.yml up -d --build
```

### 🆕 Alta de un negocio nuevo (onboarding multitenant)

Cada negocio = un `Tenant` con su propio `tenantId` (cuid). Un solo deployment
sirve a todos. Para dar de alta un cliente nuevo:

```bash
# Local o dentro del contenedor app
cd royale-shop
npm run create-tenant
```

El script (`scripts/create-tenant.ts`) pregunta:
1. Nombre del negocio
2. Teléfono (opcional)
3. Nombre del usuario OWNER
4. PIN del OWNER (4 dígitos)
5. Nombre de la primera sucursal

Y crea **en una sola transacción**: `Tenant` (slug único autogenerado) +
`Branch` + `User` OWNER (email único autogenerado `<slug>-owner@royal.shop`).

Dentro del contenedor en la VM:
```bash
sudo docker compose -f docker-compose.prod.yml exec app npm run create-tenant
```

Luego el dueño entra en `/login`, elige la sucursal de su negocio (el selector
lista las sucursales de todos los negocios; muestra el nombre del negocio cuando
hay más de uno) y teclea su PIN.

> ⚠️ Deuda técnica: el PIN se guarda en **texto plano** (el login compara en
> texto plano). Migrar a hash (bcrypt) en login + seed + este script es trabajo
> post-MVP.

---

## 📦 STACK

- Next.js 16.2.6 · TypeScript · Tailwind v4 · shadcn/ui (base-ui)
- Prisma 7.8.0 · PostgreSQL 16
- DM Sans (Google Fonts) · html5-qrcode
- Pendientes: @react-pdf/renderer · nodemailer · whatsapp-web.js
