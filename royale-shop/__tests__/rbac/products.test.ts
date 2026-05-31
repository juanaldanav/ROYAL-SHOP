import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "p1", name: "Anillo" }),
    },
    branchStock: { create: vi.fn() },
    branch: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        product: { create: vi.fn().mockResolvedValue({ id: "p1", name: "Anillo" }) },
        branchStock: { create: vi.fn() },
        branch: { findMany: vi.fn().mockResolvedValue([]) },
      })
    ),
  },
}))

import { db } from "@/lib/db"
import { POST, GET } from "@/app/api/products/route"

function makeReq(method: string, body?: unknown, role = "CASHIER") {
  return new NextRequest("http://localhost/api/products", {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_001",
      "x-branch-id": "branch_001",
      "x-user-id": "user_001",
      "x-user-role": role,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function mockUserRole(role: string) {
  vi.mocked(db.user.findUnique).mockResolvedValue({
    id: "user_001", role, tenantId: "tenant_001",
  } as never)
}

beforeEach(() => vi.mocked(db.user.findUnique).mockReset())

describe("POST /api/products — RBAC", () => {
  it("T1: CASHIER recibe 403 al intentar crear un producto", async () => {
    mockUserRole("CASHIER")
    const res = await POST(makeReq("POST", { name: "Anillo", price: 100 }))
    expect(res.status).toBe(403)
  })

  it("T9a: OWNER puede crear un producto (no recibe 403)", async () => {
    mockUserRole("OWNER")
    const res = await POST(makeReq("POST", { name: "Anillo", price: 100 }, "OWNER"))
    expect(res.status).not.toBe(403)
  })

  it("T9b: MANAGER puede crear un producto (no recibe 403)", async () => {
    mockUserRole("MANAGER")
    const res = await POST(makeReq("POST", { name: "Collar", price: 200 }, "MANAGER"))
    expect(res.status).not.toBe(403)
  })

  it("T10: CASHIER sí puede listar productos (GET)", async () => {
    mockUserRole("CASHIER")
    const res = await GET(makeReq("GET"))
    expect(res.status).toBe(200)
  })
})
