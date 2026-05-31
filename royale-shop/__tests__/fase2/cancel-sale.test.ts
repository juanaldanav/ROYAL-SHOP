import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    sale: { findFirst: vi.fn(), update: vi.fn() },
    cashCut: { findFirst: vi.fn() },
    branchStock: { update: vi.fn() },
    cashMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { db } from "@/lib/db"
import { PATCH } from "@/app/api/sales/[id]/route"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCancelReq(pin = "1234") {
  return new NextRequest("http://localhost/api/sales/s1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "t1",
      "x-branch-id": "b1",
      "x-user-id": "u1",
    },
    body: JSON.stringify({ action: "cancel", authPin: pin }),
  })
}

const AUTHORIZER = { id: "mgr1", role: "MANAGER" }

const OPEN_CUT  = { id: "cut-open",   status: "OPEN"   }
const CLOSED_CUT = { id: "cut-closed", status: "CLOSED" }

function makeSale(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    tenantId: "t1",
    branchId: "b1",
    folio: "VTA-001",
    total: "300.00",
    status: "COMPLETED",
    paymentMethod: "CASH",
    cashAmount: "300.00",
    cardAmount: "0.00",
    transferAmount: "0.00",
    change: "0.00",
    cashCut: OPEN_CUT,
    items: [{ productId: "p1", quantity: 2 }, { productId: null, quantity: 1 }],
    payments: [],
    ...overrides,
  }
}

function setupTransaction() {
  const txSaleUpdate  = vi.fn().mockResolvedValue({ id: "s1", status: "CANCELLED" })
  const txStockUpdate = vi.fn().mockResolvedValue({})
  const txMovCreate   = vi.fn().mockResolvedValue({})
  const tx = {
    sale:         { update: txSaleUpdate },
    branchStock:  { update: txStockUpdate },
    cashMovement: { create: txMovCreate },
  }
  vi.mocked(db.$transaction).mockImplementation(async (fn: (tx: never) => unknown) => fn(tx as never))
  return { txSaleUpdate, txStockUpdate, txMovCreate }
}

beforeEach(() => vi.resetAllMocks())

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/sales/[id] — cancelación", () => {

  it("T-C1: sin PIN → 403", async () => {
    const req = new NextRequest("http://localhost/api/sales/s1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-tenant-id": "t1", "x-branch-id": "b1", "x-user-id": "u1" },
      body: JSON.stringify({ action: "cancel" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(403)
  })

  it("T-C2: PIN inválido (no MANAGER/OWNER) → 403", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeCancelReq("9999"), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/PIN/i)
  })

  it("T-C3: sin corte abierto → 400 con mensaje de turno", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(AUTHORIZER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(makeSale() as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(null) // no hay corte abierto
    const res = await PATCH(makeCancelReq(), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/turno|corte/i)
  })

  it("T-C4: venta ya cancelada → 409", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(AUTHORIZER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(makeSale({ status: "CANCELLED" }) as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const res = await PATCH(makeCancelReq(), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(409)
  })

  it("T-C5: cancelación con corte ABIERTO — marca CANCELLED, restaura stock, NO crea CashMovement", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(AUTHORIZER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(makeSale({ cashCut: OPEN_CUT }) as never)
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { txSaleUpdate, txStockUpdate, txMovCreate } = setupTransaction()

    const res = await PATCH(makeCancelReq(), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(200)
    expect(txSaleUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED" } }))
    expect(txStockUpdate).toHaveBeenCalledTimes(1) // solo el item con productId
    // Regla: corte abierto → NO se crea CashMovement
    expect(txMovCreate).not.toHaveBeenCalled()
  })

  it("T-C6: cancelación con corte CERRADO y pago CASH — crea CashMovement(REFUND) en corte actual", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(AUTHORIZER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(
      makeSale({ cashCut: CLOSED_CUT, paymentMethod: "CASH", total: "300.00" }) as never
    )
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { txMovCreate } = setupTransaction()

    await PATCH(makeCancelReq(), { params: Promise.resolve({ id: "s1" }) })
    expect(txMovCreate).toHaveBeenCalledTimes(1)
    expect(txMovCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "REFUND",
          amount: 300,
          cashCutId: OPEN_CUT.id,
          authorizedById: AUTHORIZER.id,
        }),
      })
    )
  })

  it("T-C7: cancelación con corte CERRADO y pago 100% TARJETA — NO crea CashMovement", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(AUTHORIZER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(
      makeSale({
        cashCut: CLOSED_CUT,
        paymentMethod: "CARD",
        cashAmount: "0.00",
        total: "300.00",
        payments: [{ method: "CARD", amount: "300.00" }],
      }) as never
    )
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { txMovCreate } = setupTransaction()

    await PATCH(makeCancelReq(), { params: Promise.resolve({ id: "s1" }) })
    // Tarjeta → devolución en terminal bancaria → no afecta el cajón
    expect(txMovCreate).not.toHaveBeenCalled()
  })

  it("T-C8: cancelación MIXED (150 cash + 150 tarjeta) con corte CERRADO — CashMovement solo por $150", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(AUTHORIZER as never)
    vi.mocked(db.sale.findFirst).mockResolvedValue(
      makeSale({
        cashCut: CLOSED_CUT,
        paymentMethod: "MIXED",
        total: "300.00",
        payments: [
          { method: "CASH", amount: "150.00" },
          { method: "CARD", amount: "150.00" },
        ],
      }) as never
    )
    vi.mocked(db.cashCut.findFirst).mockResolvedValue(OPEN_CUT as never)
    const { txMovCreate } = setupTransaction()

    await PATCH(makeCancelReq(), { params: Promise.resolve({ id: "s1" }) })
    expect(txMovCreate).toHaveBeenCalledTimes(1)
    expect(txMovCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "REFUND", amount: 150 }),
      })
    )
  })

})
