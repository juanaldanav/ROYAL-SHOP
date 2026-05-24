import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { pin, branchId } = await req.json()

    if (!pin || !branchId) {
      return NextResponse.json({ error: "pin y branchId son requeridos" }, { status: 400 })
    }

    const user = await db.user.findFirst({
      where: {
        tenantId: DEV_TENANT_ID,
        branchId,
        pin: String(pin),
        active: true,
      },
      include: { branch: true },
    })

    if (!user) {
      return NextResponse.json({ error: "PIN incorrecto o usuario no encontrado" }, { status: 401 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      branchName: user.branch?.name ?? "",
    })
  } catch (error) {
    console.error("[POST /api/auth/login]", error)
    return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 })
  }
}
