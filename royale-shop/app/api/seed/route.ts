import { db } from "@/lib/db"
import { DEV_BRANCH_ID, DEV_TENANT_ID, DEV_USER_ID } from "@/lib/constants"
import { NextResponse } from "next/server"

// POST /api/seed — crea tenant/branch/user + demo catalog (solo dev)
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }

  try {
    // ── Core entities ──────────────────────────────────────────────────────────
    const tenant = await db.tenant.upsert({
      where: { id: DEV_TENANT_ID },
      update: {},
      create: {
        id: DEV_TENANT_ID,
        name: "Royale Shop",
        slug: "royale-shop",
        phone: "526681234567",
      },
    })

    const branch = await db.branch.upsert({
      where: { id: DEV_BRANCH_ID },
      update: {},
      create: {
        id: DEV_BRANCH_ID,
        tenantId: DEV_TENANT_ID,
        name: "Sucursal Centro",
        address: "Culiacán, Sinaloa",
      },
    })

    const user = await db.user.upsert({
      where: { id: DEV_USER_ID },
      update: {},
      create: {
        id: DEV_USER_ID,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        email: "owner@royale.shop",
        name: "Dueño",
        role: "OWNER",
        pin: "1234",
      },
    })

    // ── Demo categories ────────────────────────────────────────────────────────
    const catAretes = await db.category.upsert({
      where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Aretes", type: "PRODUCT" } },
      update: {},
      create: { tenantId: DEV_TENANT_ID, name: "Aretes", type: "PRODUCT", sortOrder: 1 },
    })
    const catAnillos = await db.category.upsert({
      where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Anillos", type: "PRODUCT" } },
      update: {},
      create: { tenantId: DEV_TENANT_ID, name: "Anillos", type: "PRODUCT", sortOrder: 2 },
    })
    const catCollar = await db.category.upsert({
      where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Collares", type: "PRODUCT" } },
      update: {},
      create: { tenantId: DEV_TENANT_ID, name: "Collares", type: "PRODUCT", sortOrder: 3 },
    })
    const catPiercing = await db.category.upsert({
      where: { tenantId_name_type: { tenantId: DEV_TENANT_ID, name: "Perforaciones", type: "SERVICE" } },
      update: {},
      create: { tenantId: DEV_TENANT_ID, name: "Perforaciones", type: "SERVICE", sortOrder: 4 },
    })

    // ── Demo products ──────────────────────────────────────────────────────────
    const productsData = [
      { sku: "ARE-001", name: "Arete Plata 925", price: 280, stock: 15, minStock: 3, categoryId: catAretes.id },
      { sku: "ARE-002", name: "Arete Acero Inoxidable", price: 120, stock: 20, minStock: 5, categoryId: catAretes.id },
      { sku: "ARE-003", name: "Arracada Chapa Oro", price: 350, stock: 10, minStock: 2, categoryId: catAretes.id },
      { sku: "ANI-001", name: "Anillo Plata Simple", price: 180, stock: 12, minStock: 3, categoryId: catAnillos.id },
      { sku: "ANI-002", name: "Anillo Grabado", price: 240, stock: 8, minStock: 2, categoryId: catAnillos.id },
      { sku: "COL-001", name: "Collar Cadena Plata", price: 420, stock: 6, minStock: 2, categoryId: catCollar.id },
      { sku: "COL-002", name: "Collar Acero 45cm", price: 160, stock: 14, minStock: 3, categoryId: catCollar.id },
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

    // ── Demo services ──────────────────────────────────────────────────────────
    const servicesData = [
      { name: "Perforación Lóbulo", price: 150, duration: 15, categoryId: catPiercing.id },
      { name: "Perforación Nariz", price: 200, duration: 20, categoryId: catPiercing.id },
      { name: "Perforación Cartílago", price: 250, duration: 25, categoryId: catPiercing.id },
      { name: "Expansión Oído", price: 180, duration: 20, categoryId: catPiercing.id },
    ]

    const services = await Promise.all(
      servicesData.map((s) =>
        db.service.upsert({
          where: {
            // Services don't have a unique SKU — use findFirst + create pattern
            id: `seed-svc-${s.name.toLowerCase().replace(/\s+/g, "-")}`,
          },
          update: {},
          create: {
            id: `seed-svc-${s.name.toLowerCase().replace(/\s+/g, "-")}`,
            ...s,
            tenantId: DEV_TENANT_ID,
          },
        })
      )
    )

    return NextResponse.json({
      tenant,
      branch,
      user,
      categories: [catAretes, catAnillos, catCollar, catPiercing],
      products,
      services,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Seed failed", detail: String(error) }, { status: 500 })
  }
}
