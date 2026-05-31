import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    user:         { findFirst: vi.fn() },
    sale:         { findFirst: vi.fn(), update: vi.fn() },
    cashCut:      { findFirst: vi.fn() },
    branchStock:  { update: vi.fn() },
    cashMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { db } from "@/lib/db"
import { PATCH } from "@/app/api/sales/[id]/route"

const PARAMS = { params: Promise.resolve({ id: "s1" }) }

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/sales/s1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_001",
      "x-branch-id": "branch_001",
      "x-user-id": "cashier_001",
    },
    body: JSON.stringify(body),
  })
}

const OPEN_CUT = { id: "cut_open", status: "OPEN" }

const COMPLETED_SALE = {
  id: "s1",
  tenantId: "tenant_001",
  branchId: "branch_001",
  folio: "VTA-0042",
  total: "200.00",
  status: "COMPLETED",
  paymentMethod: "CASH",
  cashAmount: "200.00",
  cardAmount: "0.00",
  transferAmount: "0.00",
  change: "0.00",
  cashCut: OPEN_CUT,
  payments: [],
  items: [
    { id: "si1", productId: "p1", quantity: 2, serviceId: null },
    { id: "si2", productId: null, quantity: 1, serviceId: "svc1" },
  ],
}

const MANAGER_USER = {
  id: "mgr_001",
  role: "MANAGER",
  tenantId: "tenant_001",
  pin: "1234",
  active: true,
}

function mockTransaction(saleOverride: Record<string, unknown> = {}) {
  const branchStockUpdate = vi.fn().mockResolvedValue({})
  const saleUpdate = vi.fn().mockResolvedValue({ ...COMPLETED_SALE, status: "CANCELLED", ...saleOverride })
  const movCreate = vi.fn().mockResolvedValue({})
  const tx = {
    sale:         { update: saleUpdate },
    branchStock:  { update: branchStockUpdate },
    cashMovement: { create: movCreate },
  }
  vi.mocked(db.$transaction).mockImplementation(async (fn: (tx: never) => unknown) =>
    fn(tx as never)
  )
  return { branchStockUpdate, saleUpdate, movCreate }
}

beforeEach(() => vi.resetAllMocks())

describe("PATCH /api/sales/[id] — cancelación con PIN", () => {
  it("T-C1: sin authPin → 403 inmediato sin consultar DB", async () => {
    const res = await PATCH(makeReq({ action: "cancel" }), PARAMS)
    expect(res.status).toBe(403)
    expect(vi.mocked(db.user.findFirst)).not.toHaveBeenCalled()
  })

  it("T-C2: PIN incorrecto (ningún MANAGER/OWNER con ese PIN) → 403", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeReq({ action: "cancel", authPin: "9999" }), PARAMS)
    expect(res.status).toBe(403)
  })

  it("T-C3: PIN válido de MANAGER → 200 con status CANCELLED", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(MANAGER_USER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(COMPLETED_SALE as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { saleUpdate } = mockTransaction()
    saleUpdate.mockResolvedValue({ ...COMPLETED_SALE, status: "CANCELLED" })

    const res = await PATCH(makeReq({ action: "cancel", authPin: "1234" }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("CANCELLED")
  })

  it("T-C4: folio original conservado en venta cancelada", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(MANAGER_USER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(COMPLETED_SALE as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { saleUpdate } = mockTransaction()
    saleUpdate.mockResolvedValue({ ...COMPLETED_SALE, status: "CANCELLED" })

    const res = await PATCH(makeReq({ action: "cancel", authPin: "1234" }), PARAMS)
    const body = await res.json()
    expect(body.folio).toBe("VTA-0042")
  })

  it("T-C5: stock restaurado solo para items con productId (no servicios)", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(MANAGER_USER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(COMPLETED_SALE as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { branchStockUpdate } = mockTransaction()

    await PATCH(makeReq({ action: "cancel", authPin: "1234" }), PARAMS)
    // Solo 1 item tiene productId ("p1" con qty 2); el servicio no toca stock
    expect(branchStockUpdate).toHaveBeenCalledTimes(1)
    expect(branchStockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stock: { increment: 2 } },
      })
    )
  })

  it("T-C6: venta ya CANCELLED → 409 conflict, no modifica DB", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(MANAGER_USER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue({ ...COMPLETED_SALE, status: "CANCELLED" } as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { saleUpdate } = mockTransaction({ status: "CANCELLED" })

    const res = await PATCH(makeReq({ action: "cancel", authPin: "1234" }), PARAMS)
    expect(res.status).toBe(409)
    expect(saleUpdate).not.toHaveBeenCalled()
  })

  it("T-C7: acción desconocida → 400", async () => {
    const res = await PATCH(makeReq({ action: "refund" }), PARAMS)
    expect(res.status).toBe(400)
  })
})
