import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { NextResponse } from "next/server"

const BRANCH_EXPLANADA = "clx_dev_branch_001"
const BRANCH_SENDERO   = "clx_dev_branch_002"
const USER_OWNER       = "clx_dev_user_001"

// POST /api/seed — crea tenant/branches/users + catálogo demo (solo dev)
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }

  try {
    // ── Tenant ────────────────────────────────────────────────────────────────
    const tenant = await db.tenant.upsert({
      where: { id: DEV_TENANT_ID },
      update: {},
      create: { id: DEV_TENANT_ID, name: "Royale Shop", slug: "royale-shop", phone: "526681234567" },
    })

    // ── Branches ──────────────────────────────────────────────────────────────
    const [branchExplanada, branchSendero] = await Promise.all([
      db.branch.upsert({
        where: { id: BRANCH_EXPLANADA },
        update: {},
        create: { id: BRANCH_EXPLANADA, tenantId: DEV_TENANT_ID, name: "Sucursal Explanada", address: "Plaza Explanada, Culiacán, Sinaloa" },
      }),
      db.branch.upsert({
        where: { id: BRANCH_SENDERO },
        update: {},
        create: { id: BRANCH_SENDERO, tenantId: DEV_TENANT_ID, name: "Sucursal Sendero", address: "Plaza Sendero, Culiacán, Sinaloa" },
      }),
    ])

    // ── Users ─────────────────────────────────────────────────────────────────
    const owner = await db.user.upsert({
      where: { id: USER_OWNER },
      update: {},
      create: {
        id: USER_OWNER,
        tenantId: DEV_TENANT_ID,
        branchId: BRANCH_EXPLANADA,
        email: "owner@royale.shop",
        name: "Dueño",
        role: "OWNER",
        pin: "1234",
      },
    })

    const cashierE = await db.user.upsert({
      where: { email: "explanada@royale.shop" },
      update: {},
      create: {
        tenantId: DEV_TENANT_ID,
        branchId: BRANCH_EXPLANADA,
        email: "explanada@royale.shop",
        name: "Cajero Explanada",
        role: "CASHIER",
        pin: "1111",
      },
    })

    const cashierS = await db.user.upsert({
      where: { email: "sendero@royale.shop" },
      update: {},
      create: {
        tenantId: DEV_TENANT_ID,
        branchId: BRANCH_SENDERO,
        email: "sendero@royale.shop",
        name: "Cajero Sendero",
        role: "CASHIER",
        pin: "2222",
      },
    })

    // ── Categories ────────────────────────────────────────────────────────────
    const cats = await Promise.all([
      db.category.upsert({ where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Aretes", type: "PRODUCT" } }, update: {}, create: { tenantId: DEV_TENANT_ID, name: "Aretes", type: "PRODUCT", sortOrder: 1 } }),
      db.category.upsert({ where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Anillos", type: "PRODUCT" } }, update: {}, create: { tenantId: DEV_TENANT_ID, name: "Anillos", type: "PRODUCT", sortOrder: 2 } }),
      db.category.upsert({ where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Collares", type: "PRODUCT" } }, update: {}, create: { tenantId: DEV_TENANT_ID, name: "Collares", type: "PRODUCT", sortOrder: 3 } }),
      db.category.upsert({ where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Perforaciones", type: "SERVICE" } }, update: {}, create: { tenantId: DEV_TENANT_ID, name: "Perforaciones", type: "SERVICE", sortOrder: 4 } }),
    ])
    const [catAretes, catAnillos, catCollar, catPiercing] = cats

    // ── Products ──────────────────────────────────────────────────────────────
    const productsData = [
      { sku: "ARE-001", name: "Arete Plata 925",        price: 280, categoryId: catAretes.id },
      { sku: "ARE-002", name: "Arete Acero Inoxidable", price: 120, categoryId: catAretes.id },
      { sku: "ARE-003", name: "Arracada Chapa Oro",     price: 350, categoryId: catAretes.id },
      { sku: "ANI-001", name: "Anillo Plata Simple",    price: 180, categoryId: catAnillos.id },
      { sku: "ANI-002", name: "Anillo Grabado",         price: 240, categoryId: catAnillos.id },
      { sku: "COL-001", name: "Collar Cadena Plata",    price: 420, categoryId: catCollar.id },
      { sku: "COL-002", name: "Collar Acero 45cm",      price: 160, categoryId: catCollar.id },
    ]

    const products = await Promise.all(
      productsData.map((p) =>
        db.product.upsert({
          where: { tenantId_sku: { tenantId: DEV_TENANT_ID, sku: p.sku } },
          update: {},
          create: { ...p, tenantId: DEV_TENANT_ID },
        })
      )
    )

    // ── BranchStock — stock independiente por sucursal ────────────────────────
    const stockData = [
      // Explanada
      { branchId: BRANCH_EXPLANADA, sku: "ARE-001", stock: 15, minStock: 3 },
      { branchId: BRANCH_EXPLANADA, sku: "ARE-002", stock: 20, minStock: 5 },
      { branchId: BRANCH_EXPLANADA, sku: "ARE-003", stock: 8,  minStock: 2 },
      { branchId: BRANCH_EXPLANADA, sku: "ANI-001", stock: 12, minStock: 3 },
      { branchId: BRANCH_EXPLANADA, sku: "ANI-002", stock: 6,  minStock: 2 },
      { branchId: BRANCH_EXPLANADA, sku: "COL-001", stock: 5,  minStock: 2 },
      { branchId: BRANCH_EXPLANADA, sku: "COL-002", stock: 10, minStock: 3 },
      // Sendero
      { branchId: BRANCH_SENDERO, sku: "ARE-001", stock: 10, minStock: 3 },
      { branchId: BRANCH_SENDERO, sku: "ARE-002", stock: 14, minStock: 5 },
      { branchId: BRANCH_SENDERO, sku: "ARE-003", stock: 3,  minStock: 2 },
      { branchId: BRANCH_SENDERO, sku: "ANI-001", stock: 8,  minStock: 3 },
      { branchId: BRANCH_SENDERO, sku: "ANI-002", stock: 4,  minStock: 2 },
      { branchId: BRANCH_SENDERO, sku: "COL-001", stock: 2,  minStock: 2 }, // stock bajo!
      { branchId: BRANCH_SENDERO, sku: "COL-002", stock: 7,  minStock: 3 },
    ]

    const productBySku = Object.fromEntries(products.map((p) => [p.sku!, p.id]))

    await Promise.all(
      stockData.map((s) => {
        const productId = productBySku[s.sku]
        if (!productId) return Promise.resolve()
        return db.branchStock.upsert({
          where: { tenantId_branchId_productId: { tenantId: DEV_TENANT_ID, branchId: s.branchId, productId } },
          update: {},
          create: { tenantId: DEV_TENANT_ID, branchId: s.branchId, productId, stock: s.stock, minStock: s.minStock },
        })
      })
    )

    // ── Services ──────────────────────────────────────────────────────────────
    const servicesData = [
      { id: "seed-svc-lobulo",     name: "Perforación Lóbulo",    price: 150, duration: 15 },
      { id: "seed-svc-nariz",      name: "Perforación Nariz",     price: 200, duration: 20 },
      { id: "seed-svc-cartilago",  name: "Perforación Cartílago", price: 250, duration: 25 },
      { id: "seed-svc-expansion",  name: "Expansión Oído",        price: 180, duration: 20 },
    ]

    const services = await Promise.all(
      servicesData.map((s) =>
        db.service.upsert({
          where: { id: s.id },
          update: {},
          create: { ...s, tenantId: DEV_TENANT_ID, categoryId: catPiercing.id },
        })
      )
    )

    return NextResponse.json({
      tenant,
      branches: [branchExplanada, branchSendero],
      users: [owner, cashierE, cashierS],
      categories: cats,
      products,
      services,
      stockEntries: stockData.length,
    })
  } catch (error) {
    console.error("[POST /api/seed]", error)
    return NextResponse.json({ error: "Seed failed", detail: String(error) }, { status: 500 })
  }
}
