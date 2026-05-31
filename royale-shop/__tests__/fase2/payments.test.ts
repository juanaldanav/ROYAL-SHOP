import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: vi.fn() },
    branchStock: { findUnique: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { db } from "@/lib/db"
import { POST } from "@/app/api/sales/route"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSaleReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/sales", {
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

const BASE_ITEMS = [{ productId: "p1", name: "Anillo", price: 100, quantity: 1 }]
const BASE_SALE = { id: "s1", folio: "VTA-001", total: 100, status: "COMPLETED", items: [] }

function mockTx(paymentCreate = vi.fn().mockResolvedValue({})) {
  const tx = {
    product: { findUnique: vi.fn().mockResolvedValue({ cost: 50 }) },
    sale: { create: vi.fn().mockResolvedValue(BASE_SALE) },
    branchStock: {
      findUnique: vi.fn().mockResolvedValue({ stock: 10 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    payment: { create: paymentCreate },
  }
  vi.mocked(db.$transaction).mockImplementation(async (fn: (tx: never) => unknown) =>
    fn(tx as never)
  )
  return paymentCreate
}

beforeEach(() => vi.resetAllMocks())

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/sales — Payment records", () => {
  it("T-P1: venta CASH crea un Payment con method=CASH y amount=total", async () => {
    const paymentCreate = mockTx()
    await POST(makeSaleReq({
      cashCutId: "cc1",
      items: BASE_ITEMS,
      paymentMethod: "CASH",
      amountPaid: 150,
    }))
    expect(paymentCreate).toHaveBeenCalledTimes(1)
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: "CASH", amount: 100 }) })
    )
  })

  it("T-P2: venta CARD crea un Payment con method=CARD y amount=total", async () => {
    const paymentCreate = mockTx()
    await POST(makeSaleReq({
      cashCutId: "cc1",
      items: BASE_ITEMS,
      paymentMethod: "CARD",
      amountPaid: 100,
    }))
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: "CARD", amount: 100 }) })
    )
  })

  it("T-P3: venta TRANSFER crea un Payment con method=TRANSFER y amount=total", async () => {
    const paymentCreate = mockTx()
    await POST(makeSaleReq({
      cashCutId: "cc1",
      items: BASE_ITEMS,
      paymentMethod: "TRANSFER",
      amountPaid: 100,
    }))
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: "TRANSFER", amount: 100 }) })
    )
  })

  it("T-P4: venta MIXED crea dos Payment records (CASH + CARD)", async () => {
    const paymentCreate = mockTx()
    // Total = 300 = 100 cash + 200 card
    const mixedItems = [{ productId: "p1", name: "Collar", price: 300, quantity: 1 }]
    const tx4 = {
      product: { findUnique: vi.fn().mockResolvedValue({ cost: 150 }) },
      sale: { create: vi.fn().mockResolvedValue({ ...BASE_SALE, total: 300 }) },
      branchStock: { findUnique: vi.fn().mockResolvedValue({ stock: 5 }), upsert: vi.fn().mockResolvedValue({}) },
      payment: { create: paymentCreate },
    }
    vi.mocked(db.$transaction).mockImplementation(async (fn: (tx: never) => unknown) => fn(tx4 as never))
    await POST(makeSaleReq({
      cashCutId: "cc1",
      items: mixedItems,
      paymentMethod: "MIXED",
      cashAmount: 100,
      cardAmount: 200,
      transferAmount: 0,
    }))
    expect(paymentCreate).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(paymentCreate).mock.calls.map((c) => (c[0] as { data: unknown }).data)
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "CASH", amount: 100 }),
        expect.objectContaining({ method: "CARD", amount: 200 }),
      ])
    )
  })

  it("T-P5: venta MIXED con transferencia crea CASH + TRANSFER, no CARD", async () => {
    const paymentCreate = mockTx()
    const mixedItems = [{ productId: "p1", name: "Collar", price: 300, quantity: 1 }]
    const tx5 = {
      product: { findUnique: vi.fn().mockResolvedValue({ cost: 150 }) },
      sale: { create: vi.fn().mockResolvedValue({ ...BASE_SALE, total: 300 }) },
      branchStock: { findUnique: vi.fn().mockResolvedValue({ stock: 5 }), upsert: vi.fn().mockResolvedValue({}) },
      payment: { create: paymentCreate },
    }
    vi.mocked(db.$transaction).mockImplementation(async (fn: (tx: never) => unknown) => fn(tx5 as never))
    await POST(makeSaleReq({
      cashCutId: "cc1",
      items: mixedItems,
      paymentMethod: "MIXED",
      cashAmount: 150,
      cardAmount: 0,
      transferAmount: 150,
    }))
    expect(paymentCreate).toHaveBeenCalledTimes(2)
    const methods = vi.mocked(paymentCreate).mock.calls.map(
      (c) => ((c[0] as { data: { method: string } }).data).method
    )
    expect(methods).toContain("CASH")
    expect(methods).toContain("TRANSFER")
    expect(methods).not.toContain("CARD")
  })

  it("T-P6: items vacíos → 400, no se ejecuta transaction", async () => {
    const res = await POST(makeSaleReq({ cashCutId: "cc1", items: [], paymentMethod: "CASH" }))
    expect(res.status).toBe(400)
    expect(vi.mocked(db.$transaction)).not.toHaveBeenCalled()
  })
})
