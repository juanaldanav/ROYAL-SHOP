import { db } from "@/lib/db"
import { assertManagerOrOwner } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"

export async function GET(req: NextRequest) {
  try {
    const denied = await assertManagerOrOwner(req)
    if (denied) return denied
    const { tenantId } = getSession(req)
    const { searchParams } = req.nextUrl
    const branchId = searchParams.get("branchId")

    const users = await db.user.findMany({
      where: {
        tenantId,
        active: true,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { name: true } },
        userBranches: { include: { branch: { select: { id: true, name: true } } } },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(users.map((u) => ({ ...u, pin: undefined })))
  } catch (error) {
    console.error("[GET /api/users]", error)
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await assertManagerOrOwner(req)
    if (denied) return denied
    const { tenantId } = getSession(req)
    const { name, email, pin, role, branchId, branchIds } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ error: "name y email son requeridos" }, { status: 400 })
    }

    if (pin && (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin)))) {
      return NextResponse.json({ error: "El PIN debe ser de 4 dígitos" }, { status: 400 })
    }

    // PIN must be unique per branch
    if (pin && branchId) {
      const conflict = await db.user.findFirst({
        where: { tenantId, branchId, pin: String(pin), active: true },
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Ya existe un cajero con ese PIN en esta sucursal" },
          { status: 409 }
        )
      }
    }

    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId,
          name,
          email,
          pin: pin ? String(pin) : null,
          role: (role as UserRole) ?? "CASHIER",
          branchId: branchId ?? null,
        },
        include: { branch: { select: { name: true } } },
      })
      // UserBranch records for MANAGER multi-branch access
      const bids: string[] = Array.isArray(branchIds) ? branchIds : []
      if (bids.length > 0) {
        await tx.userBranch.createMany({
          data: bids.map((bid) => ({ userId: u.id, branchId: bid })),
          skipDuplicates: true,
        })
      }
      return u
    })

    return NextResponse.json({ ...user, pin: undefined }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/users]", error)
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 })
  }
}
