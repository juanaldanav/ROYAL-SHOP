import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// In-memory rate limit: 5 attempts per IP per 15 min
const _attempts = new Map<string, { count: number; resetAt: number }>()
const MAX = 5
const WINDOW = 15 * 60 * 1000

function ip(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

function rateCheck(addr: string): { blocked: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = _attempts.get(addr)
  if (!entry || now > entry.resetAt) {
    _attempts.set(addr, { count: 1, resetAt: now + WINDOW })
    return { blocked: false }
  }
  if (entry.count >= MAX) {
    return { blocked: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { blocked: false }
}

function rateClear(addr: string) {
  _attempts.delete(addr)
}

export async function POST(req: NextRequest) {
  const addr = ip(req)
  const limit = rateCheck(addr)

  if (limit.blocked) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${limit.retryAfter}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      }
    )
  }

  try {
    const { pin, branchId } = await req.json()

    if (!pin || !branchId) {
      return NextResponse.json({ error: "pin y branchId son requeridos" }, { status: 400 })
    }

    // Multitenant: branchId (cuid global único) determina el tenant. No se
    // hardcodea ningún tenantId — el usuario se resuelve por su sucursal + PIN.
    const user = await db.user.findFirst({
      where: {
        branchId,
        pin: String(pin),
        active: true,
      },
      include: { branch: true },
    })

    if (!user) {
      return NextResponse.json({ error: "PIN incorrecto o usuario no encontrado" }, { status: 401 })
    }

    // Login OK → clear rate limit for this IP
    rateClear(addr)

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
