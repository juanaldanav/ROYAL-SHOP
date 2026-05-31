import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { POST } from "@/app/api/auth/login/route"

// IP única por test → evita que el rate-limit en memoria (5/IP) cruce casos
function makeReq(body: unknown, ip: string) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.mocked(db.user.findFirst).mockReset())

describe("POST /api/auth/login — multitenant", () => {
  it("resuelve el tenant desde la sucursal, sin hardcodear tenantId", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: "u_b", name: "Dueño B", role: "OWNER",
      tenantId: "tenant_B", branchId: "branch_B",
      branch: { name: "Sucursal B" },
    } as never)

    const res = await POST(makeReq({ pin: "4321", branchId: "branch_B" }, "10.0.0.1"))
    const data = await res.json()

    expect(res.status).toBe(200)
    // El payload usa el tenant del usuario, no DEV_TENANT_ID
    expect(data.tenantId).toBe("tenant_B")
    expect(data.branchName).toBe("Sucursal B")

    // El where NO debe filtrar por un tenantId fijo — solo branch + pin + active
    const where = vi.mocked(db.user.findFirst).mock.calls[0][0]!.where as Record<string, unknown>
    expect(where).not.toHaveProperty("tenantId")
    expect(where).toMatchObject({ branchId: "branch_B", pin: "4321", active: true })
  })

  it("PIN incorrecto → 401", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never)
    const res = await POST(makeReq({ pin: "0000", branchId: "branch_B" }, "10.0.0.2"))
    expect(res.status).toBe(401)
  })

  it("falta branchId → 400", async () => {
    const res = await POST(makeReq({ pin: "1234" }, "10.0.0.3"))
    expect(res.status).toBe(400)
  })
})
