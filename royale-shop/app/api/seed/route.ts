import { db } from "@/lib/db"
import { DEV_BRANCH_ID, DEV_TENANT_ID, DEV_USER_ID } from "@/lib/constants"
import { NextResponse } from "next/server"

// POST /api/seed — crea tenant/branch/user de desarrollo
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }

  try {
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

    return NextResponse.json({ tenant, branch, user })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Seed failed" }, { status: 500 })
  }
}
