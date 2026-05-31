import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// tx mock compartido — cada test ajusta branchStock.updateMany
const tx = {
  product: { findUnique: vi.fn().mockResolvedValue({ cost: 50 }) },
  sale: { create: vi.fn().mockResolvedValue({ id: "s1", folio: "VTA-1", items: [] }) },
  branchStock: { updateMany: vi.fn() },
  payment: { create: vi.fn().mockResolvedValue({}) },
}

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  },
}))

import { POST } from "@/app/api/sales/route"

function makeReq(body: unknown) {
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

const baseSale = {
  cashCutId: "cc1",
  paymentMethod: "CASH",
  amountPaid: 200,
  items: [{ productId: "p1", name: "Anillo", price: 100, quantity: 2 }],
}

beforeEach(() => {
  tx.branchStock.updateMany.mockReset()
  tx.sale.create.mockClear()
  tx.payment.create.mockClear()
})

describe("POST /api/sales — descuento de stock", () => {
  it("descuenta atómico cuando hay stock suficiente (201)", async () => {
    tx.branchStock.updateMany.mockResolvedValue({ count: 1 })
    const res = await POST(makeReq(baseSale))
    expect(res.status).toBe(201)
    // decremento atómico con guarda stock>=qty
    const call = tx.branchStock.updateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ tenantId: "t1", branchId: "b1", productId: "p1" })
    expect(call.where.stock).toEqual({ gte: 2 })
    expect(call.data).toEqual({ stock: { decrement: 2 } })
  })

  it("rechaza con 409 cuando no hay stock suficiente (o no existe row)", async () => {
    tx.branchStock.updateMany.mockResolvedValue({ count: 0 })
    const res = await POST(makeReq(baseSale))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain("Stock insuficiente")
    // no debe haber creado pagos tras el fallo
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("no intenta descontar stock para items sin productId (servicio/concepto libre)", async () => {
    tx.branchStock.updateMany.mockResolvedValue({ count: 1 })
    const res = await POST(makeReq({
      ...baseSale,
      items: [{ serviceId: "svc1", name: "Perforación", price: 150, quantity: 1 }],
    }))
    expect(res.status).toBe(201)
    expect(tx.branchStock.updateMany).not.toHaveBeenCalled()
  })
})
