import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { db } from "@/lib/db"
import { generateTicketPDF } from "@/lib/generate-ticket-pdf"

const WA_URL = process.env.WHATSAPP_SERVICE_URL ?? "http://whatsapp-svc:3001"

// POST /api/tickets/whatsapp
// Body: { phone: string, saleId: string }
// Fetches sale from DB, generates PDF, sends to WhatsApp.
// Falls back to text message if PDF generation fails.
export async function POST(req: NextRequest) {
  try {
    const { phone, saleId } = await req.json()
    if (!phone || !saleId) {
      return NextResponse.json({ error: "phone y saleId son requeridos" }, { status: 400 })
    }

    const session = getSession(req)

    // Fetch sale with all relations needed for the ticket
    const sale = await db.sale.findFirst({
      where: { id: saleId, tenantId: session.tenantId },
      include: {
        items: true,
        payments: true,
        user: { select: { name: true } },
        branch: { select: { name: true } },
      },
    })
    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } })
    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Try PDF first, fall back to text
    try {
      const pdfBuffer = await generateTicketPDF(
        {
          folio: sale.folio ?? "",
          createdAt: sale.createdAt,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          subtotal: sale.subtotal.toString(),
          discount: sale.discount.toString(),
          total: sale.total.toString(),
          change: sale.change.toString(),
          amountPaid: sale.amountPaid.toString(),
          paymentMethod: sale.paymentMethod,
          items: sale.items.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            price: i.price.toString(),
            subtotal: i.subtotal.toString(),
          })),
          payments: sale.payments.map((p) => ({ method: p.method, amount: p.amount.toString() })),
          cashAmount: sale.cashAmount?.toString(),
          cardAmount: sale.cardAmount?.toString(),
          transferAmount: sale.transferAmount?.toString(),
          user: sale.user,
          branch: sale.branch,
        },
        {
          name: tenant.name,
          phone: tenant.phone,
          logoUrl: tenant.logoUrl,
        }
      )

      const base64 = pdfBuffer.toString("base64")
      const folio = sale.folio ?? sale.id.slice(0, 8)

      const waRes = await fetch(`${WA_URL}/send-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          data: base64,
          mimetype: "application/pdf",
          filename: `ticket-${folio}.pdf`,
          caption: `Ticket de compra en ${tenant.name} — Folio: ${folio}`,
        }),
      })

      const waData = await waRes.json()
      return NextResponse.json(waData, { status: waRes.status })
    } catch (pdfErr) {
      console.error("[POST /api/tickets/whatsapp] PDF error, falling back to text:", pdfErr)

      // Text fallback
      const folio = sale.folio ?? sale.id.slice(0, 8)
      const date = new Date(sale.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      const METHOD: Record<string, string> = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", MIXED: "Pago Mixto" }
      const lines: string[] = [
        `*${tenant.name.toUpperCase()}*`,
        "Joyería & Perforaciones",
        ...(tenant.phone ? [`📞 ${tenant.phone}`] : []),
        ...(sale.branch?.name ? [`📍 ${sale.branch.name}`] : []),
        "",
        `📋 Folio: ${folio}`,
        `🗓 ${date}`,
        "─────────────────",
        ...sale.items.map((i) => `• ${i.name}  x${i.quantity}  $${parseFloat(String(i.subtotal)).toFixed(2)}`),
        "─────────────────",
        `*TOTAL  $${parseFloat(String(sale.total)).toFixed(2)}*`,
        `Método: ${METHOD[sale.paymentMethod] ?? sale.paymentMethod}`,
        "",
        "¡Gracias por tu compra! 🙏",
      ]

      const textRes = await fetch(`${WA_URL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message: lines.join("\n") }),
      })
      const textData = await textRes.json()
      return NextResponse.json(textData, { status: textRes.status })
    }
  } catch (err) {
    console.error("[POST /api/tickets/whatsapp]", err)
    return NextResponse.json({ error: "Servicio WhatsApp no disponible" }, { status: 503 })
  }
}

// GET /api/tickets/whatsapp?qr=1 → proxy a /status del microservicio
export async function GET(req: NextRequest) {
  try {
    const wantQr = req.nextUrl.searchParams.get("qr") === "1"
    const res = await fetch(`${WA_URL}/status`)
    const data = await res.json()

    if (wantQr && !data.ready) {
      try {
        const qrRes = await fetch(`${WA_URL}/qr`)
        const qrData = await qrRes.json()
        return NextResponse.json({ ...data, qrImage: qrData.qr ?? null })
      } catch {
        return NextResponse.json({ ...data, qrImage: null })
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ready: false, error: "Servicio no disponible" }, { status: 503 })
  }
}
