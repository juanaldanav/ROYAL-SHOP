import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    cashCut:      { findFirst: vi.fn(), update: vi.fn() },
    sale:         { findMany: vi.fn() },
    cashMovement: { findMany: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { PATCH } from "@/app/api/cash-cuts/[id]/route"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/cash-cuts/cut1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "t1",
      "x-branch-id": "b1",
      "x-user-id": "u1",
    },
    body: JSON.stringify(body),
  })
}

const PARAMS = { params: Promise.resolve({ id: "cut1" }) }

const OPEN_CUT = {
  id: "cut1",
  tenantId: "t1",
  branchId: "b1",
  status: "OPEN",
  openingBalance: "500.00",
}

const CLOSED_CUT = { ...OPEN_CUT, status: "CLOSED" }

// Ventas: 1 CASH $300, 1 CARD $200, 1 TRANSFER $100
function makeSales(overrides: Record<string, unknown>[] = []) {
  const defaults = [
    {
      total: "300.00", paymentMethod: "CASH", change: "0.00",
      cashAmount: "0.00", cardAmount: "0.00", transferAmount: "0.00",
      payments: [{ method: "CASH", amount: "300.00" }],
    },
    {
      total: "200.00", paymentMethod: "CARD", change: "0.00",
      cashAmount: "0.00", cardAmount: "0.00", transferAmount: "0.00",
      payments: [{ method: "CARD", amount: "200.00" }],
    },
    {
      total: "100.00", paymentMethod: "TRANSFER", change: "0.00",
      cashAmount: "0.00", cardAmount: "0.00", transferAmount: "0.00",
      payments: [{ method: "TRANSFER", amount: "100.00" }],
    },
  ]
  return overrides.length ? overrides : defaults
}

function setupMocks(cutOverride = {}, salesOverride: Record<string, unknown>[] = []) {
  vi.mocked(db.cashCut.findFirst).mockResolvedValue({ ...OPEN_CUT, ...cutOverride } as never)
  vi.mocked(db.sale.findMany).mockResolvedValue(makeSales(salesOverride) as never)
  vi.mocked(db.cashMovement.findMany).mockResolvedValue([])
  vi.mocked(db.cashCut.update).mockResolvedValue({
    ...OPEN_CUT,
    status: "CLOSED",
    user: { name: "Test" },
    // Los campos computados llegan via los fallbacks `?? local` del handler
    totalSales: null, expectedCash: null, countedCash: null, difference: null,
    expectedCard: null, countedCard: null, cardDifference: null,
    closedAt: new Date(), notes: null,
  } as never)
}

beforeEach(() => vi.resetAllMocks())

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/cash-cuts/[id] — cuadre físico", () => {

  it("T-F3-1: countedCard ausente → 400", async () => {
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 800 }), PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/countedCard/i)
  })

  it("T-F3-2: countedCash ausente → 400", async () => {
    setupMocks()
    const res = await PATCH(makeReq({ countedCard: 200 }), PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/countedCash/i)
  })

  it("T-F3-3: corte ya CERRADO → 409", async () => {
    setupMocks(CLOSED_CUT)
    const res = await PATCH(makeReq({ countedCash: 800, countedCard: 200 }), PARAMS)
    expect(res.status).toBe(409)
  })

  it("T-F3-4: cuadre exacto — difference=0, cardDifference=0, ambos EXACTO", async () => {
    // expectedCash = 500 (opening) + 300 (cashIn) - 0 (change) - 0 (refunds) = 800
    // expectedCard = 200 (solo CARD, no TRANSFER)
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 800, countedCard: 200 }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.difference).toBe(0)
    expect(body.cardDifference).toBe(0)
    expect(body.cuadreStatus).toBe("EXACTO")
    expect(body.cardCuadreStatus).toBe("EXACTO")
  })

  it("T-F3-5: sobrante de efectivo → difference > 0, cuadreStatus=SOBRANTE", async () => {
    // expectedCash = 800, se ingresan 850 → sobrante de 50
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 850, countedCard: 200 }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.difference).toBeGreaterThan(0)
    expect(body.cuadreStatus).toBe("SOBRANTE")
  })

  it("T-F3-6: faltante de efectivo → difference < 0, cuadreStatus=FALTANTE", async () => {
    // expectedCash = 800, se ingresan 750 → faltante de -50
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 750, countedCard: 200 }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.difference).toBeLessThan(0)
    expect(body.cuadreStatus).toBe("FALTANTE")
  })

  it("T-F3-7: sobrante de tarjeta → cardDifference > 0, cardCuadreStatus=SOBRANTE", async () => {
    // expectedCard = 200, se ingresan 250 → sobrante de 50
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 800, countedCard: 250 }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cardDifference).toBeGreaterThan(0)
    expect(body.cardCuadreStatus).toBe("SOBRANTE")
  })

  it("T-F3-8: faltante de tarjeta → cardDifference < 0, cardCuadreStatus=FALTANTE", async () => {
    // expectedCard = 200, se ingresan 170 → faltante de -30
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 800, countedCard: 170 }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cardDifference).toBeLessThan(0)
    expect(body.cardCuadreStatus).toBe("FALTANTE")
  })

  it("T-F3-9: expectedCard excluye TRANSFER (solo CARD)", async () => {
    // Ventas: CASH $300, CARD $200, TRANSFER $100
    // expectedCard debe ser $200, NO $300 (sin TRANSFER)
    setupMocks()
    const res = await PATCH(makeReq({ countedCash: 800, countedCard: 200 }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.expectedCard).toBe(200)
    expect(body.cardDifference).toBe(0)
  })

})
