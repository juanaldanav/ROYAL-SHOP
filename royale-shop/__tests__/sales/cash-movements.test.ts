import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    cashCut: { findFirst: vi.fn() },
    cashMovement: { create: vi.fn().mockResolvedValue({ id: "m1", type: "EXPENSE" }) },
  },
}))

import { db } from "@/lib/db"
import { POST } from "@/app/api/cash-movements/route"

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/cash-movements", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "t1",
      "x-branch-id": "b1",
      "x-user-id": "u1",
    },
    body: JSON.stringify(body),
  })
}

const openCut = { id: "cc1", tenantId: "t1", branchId: "b1", status: "OPEN" }

beforeEach(() => {
  vi.mocked(db.cashCut.findFirst).mockReset()
  vi.mocked(db.cashMovement.create).mockClear()
})

describe("POST /api/cash-movements — salida de efectivo (EXPENSE)", () => {
  it("registra una salida con monto>0 y razón (201, type EXPENSE)", async () => {
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(openCut as never)
    const res = await POST(makeReq({ cashCutId: "cc1", amount: 50, description: "compra de bolsas" }))
    expect(res.status).toBe(201)
    const data = vi.mocked(db.cashMovement.create).mock.calls[0][0].data
    expect(data).toMatchObject({ type: "EXPENSE", amount: 50, description: "compra de bolsas", cashCutId: "cc1", authorizedById: "u1", tenantId: "t1", branchId: "b1" })
  })

  it("rechaza monto <= 0 (400)", async () => {
    const res = await POST(makeReq({ cashCutId: "cc1", amount: 0, description: "x" }))
    expect(res.status).toBe(400)
    expect(db.cashMovement.create).not.toHaveBeenCalled()
  })

  it("rechaza razón vacía (400)", async () => {
    const res = await POST(makeReq({ cashCutId: "cc1", amount: 10, description: "   " }))
    expect(res.status).toBe(400)
  })

  it("rechaza si el corte está cerrado (409)", async () => {
    vi.mocked(db.cashCut.findFirst).mockResolvedValue({ ...openCut, status: "CLOSED" } as never)
    const res = await POST(makeReq({ cashCutId: "cc1", amount: 10, description: "pago" }))
    expect(res.status).toBe(409)
  })

  it("rechaza corte de otra sucursal (403)", async () => {
    vi.mocked(db.cashCut.findFirst).mockResolvedValue({ ...openCut, branchId: "otra" } as never)
    const res = await POST(makeReq({ cashCutId: "cc1", amount: 10, description: "pago" }))
    expect(res.status).toBe(403)
  })
})
