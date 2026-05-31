# Royal Shop — Siguiente Sprint

> Creado: 2026-05-31 (cierre del sprint del 31 Mayo)
> Ver estado actual en `PROGRESS.md`.

---

## ✅ Lo que quedó en prod hoy (Sprint 31 Mayo 2026)

- **9/9 requerimientos de Diana** completos y live en `royalshop.lamarque.mx`.
- **Multitenant real** sin hardcode: el login resuelve el tenant desde la sucursal.
  `npm run create-tenant` funcional (Tenant + sucursal + OWNER en una transacción).
- **Fix de descuento de stock atómico**: sin race condition, sin negativos, bloquea sobreventa (409).
- **Reporte de inventario `.xlsx`** descargable (OWNER/MANAGER) — `GET /api/reports/inventory`.
- **`/configuracion` reparado** (polling WhatsApp, preview de logo, force-dynamic).
- **SMTP**: estructura lista (Tenant.email + EmailLog + nodemailer + envío de PDF).
  ⚠️ **Faltan credenciales** en el `.env` de prod para activarlo.
- **Cajero Demo**: PIN `1111`, sucursal Explanada (cajero seed viejo con PIN 1111 desactivado).

---

## 🎯 Siguiente sprint — en orden

### 1. Offline sync / IndexedDB
El POS no funciona sin conexión hoy (`POST /api/sales` falla y la venta se pierde).
- **DECIDIR PRIMERO la estrategia de folio.** Hoy el servidor genera el folio
  definitivo y la UI lo usa. Offline, el cliente debe generar un folio provisional
  y reconciliar al sincronizar, o arriesgar folios duplicados/huecos.
- Service Worker que intercepte `POST /api/sales` sin red.
- Wrapper IndexedDB para encolar ventas pendientes.
- Lógica de sync al reconectar + hook `useOfflineSync` (estado online/offline).
- Nota: `BranchStock` es independiente por sucursal (confirmado) — el descuento de
  stock debe reconciliarse al sincronizar (puede haber sobreventa entre dispositivos).

### 2. Hashear PINs con bcrypt
Deuda de seguridad — hacer **antes de onboarding masivo de clientes**.
- Toca: `lib` de auth (`/api/auth/login` compara texto plano), `scripts/seed-clean.ts`/seed,
  y `scripts/create-tenant.ts`. Migrar los PINs existentes en prod.

### 3. Flujo completo de inventario (casos de uso definidos)

**CU1 — Llegó mercancía (captura manual):**
El trabajador busca el producto en `/inventario`, captura cuántas piezas llegaron y
en qué sucursal. El sistema **suma** al stock actual en `BranchStock`. Queda
registrado quién lo hizo y cuándo.

**CU2 — Llegó mercancía en volumen (xlsx):**
La dueña descarga la plantilla, llena: Producto/SKU, Sucursal, Cantidad que llegó.
Sube el archivo. El sistema **suma todo** en una sola operación.
(Hoy solo existe import CSV de inventario — extender a xlsx + modo "sumar".)

**CU3 — Venta:** ✅ Ya funciona — al cerrar venta descuenta automáticamente de
`BranchStock`. Stock nunca negativo, bloquea sobreventa.

**CU4 — Conteo físico (el viernes):**
1. Descargar reporte de existencias desde `/inventario`.
2. El xlsx tiene: Producto, SKU, Sucursal, **Stock Sistema**, **Físico** (columna
   vacía), **Diferencia** (fórmula automática).
3. El trabajador llena la columna **Físico** con lo contado.
4. Sube ese mismo archivo.
5. El sistema **ajusta** `BranchStock` con la diferencia.
6. Registra el ajuste: fecha, usuario, motivo opcional.

**CU5 — Traspaso entre sucursales:**
Ya existe el módulo. **Verificar** que descuente de origen y sume en destino
correctamente (con cámara/QR según RF-05).

**Reglas globales de inventario (todas las CU):**
- Siempre filtrar por `tenantId`.
- Siempre registrar **quién** hizo el movimiento y **cuándo**.
- Stock **nunca negativo**.
- Todos los movimientos en un **log auditable** (modelo nuevo de movimientos de
  inventario, distinto de `CashMovement`).

### 4. Reconciliar repo git con prod
- **Nota de realidad:** el **código** ya se reconcilió en el commit `b7ff34f`
  (features que estaban en prod sin versionar). Lo que queda fuera son **artefactos
  no-código** (cotizaciones `.docx/.pdf`, zips de handoff, `.bat`, notas sueltas).
- Decidir si esos artefactos se versionan o se mueven a otro lado / `.gitignore`.

### 5. Deploy por git en lugar de scp manual
- Hoy el deploy es: `scp` de archivos a `/opt/royaleshop/royale-shop` + rebuild.
  La VM **no es un repo git** (`/opt/royaleshop` sin `.git`).
- Crear/actualizar `scripts/deploy-vm.sh`: convertir `/opt/royaleshop` en checkout git,
  `git pull origin master` + `prisma db push` (no hay migrations) + rebuild + healthcheck
  + `docker builder prune`. Eliminar el scp manual.

### 6. Super Admin Panel `/admin`
- Gestionar tenants sin entrar a la terminal.
- Nuevo rol `SUPERADMIN` (enum `UserRole`).
- Toggle activo/inactivo por tenant, alta de negocios desde UI (envuelve `create-tenant`).

---

## 🔧 Pendiente operativo

- [ ] **Cargar credenciales SMTP** en `/opt/royaleshop/.env` en la VM
      (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) y reiniciar `pos-app`.
      Sin esto, el envío de ticket por correo no funciona (no-op seguro).
- [ ] **Royal Shop demo cancelada** — reagendar.
- [ ] **Ola Café** — Alejandra Ortiz tiene docs, esperando respuesta para firma del SLA.
