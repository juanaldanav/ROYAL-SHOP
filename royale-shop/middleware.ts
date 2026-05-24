import { NextRequest, NextResponse } from "next/server"

const PROD_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://soporte.lamarque.mx"
const ALLOWED_ORIGINS = new Set(
  process.env.NODE_ENV === "production"
    ? [PROD_ORIGIN]
    : ["http://localhost:3000", "http://localhost:3001", "http://10.2.0.2:3000"]
)

const ALLOWED_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
const ALLOWED_HEADERS = ["Content-Type", "Authorization", "X-Requested-With"]

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS.join(", "),
    "Access-Control-Allow-Headers": ALLOWED_HEADERS.join(", "),
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Solo aplica a rutas /api/*
  if (!pathname.startsWith("/api/")) return NextResponse.next()

  const origin = request.headers.get("origin")

  // Requests sin Origin header = same-origin o non-browser → permitir
  if (!origin) return NextResponse.next()

  const allowed = ALLOWED_ORIGINS.has(origin)

  // Preflight OPTIONS
  if (request.method === "OPTIONS") {
    if (!allowed) return new NextResponse(null, { status: 204 })
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }

  // Bloquear origins no permitidos
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }

  // Añadir CORS headers a response normal
  const response = NextResponse.next()
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export const config = {
  matcher: "/api/:path*",
}
