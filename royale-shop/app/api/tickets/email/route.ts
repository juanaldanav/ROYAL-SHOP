import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sendSaleTicketEmail } from "@/lib/mailer"

// POST /api/tickets/email — Body: { saleId }
// Envía (o reenvía) el ticket de la venta por correo al cliente.
export async function POST(req: NextRequest) {
  try {
    const { saleId } = await req.json()
    if (!saleId) {
      return NextResponse.json({ error: "saleId es requerido" }, { status: 400 })
    }
    const { tenantId } = getSession(req)
    const result = await sendSaleTicketEmail(saleId, tenantId)
    if (!result.sent) {
      return NextResponse.json(
        { error: result.error ?? result.skipped ?? "No se envió el correo" },
        { status: result.error ? 502 : 400 }
      )
    }
    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error("[POST /api/tickets/email]", err)
    return NextResponse.json({ error: "Error al enviar el correo" }, { status: 500 })
  }
}
