import nodemailer from "nodemailer"
import { db } from "@/lib/db"
import { generateTicketPDF } from "@/lib/generate-ticket-pdf"

// Transport SMTP global por variables de entorno. Si no están configuradas,
// getTransport() devuelve null y no se envía nada (sin default hardcodeado).
function getTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  const port = Number(process.env.SMTP_PORT ?? 587)
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export type EmailResult = { sent: boolean; skipped?: string; error?: string }

/**
 * Envía el ticket de una venta por correo al cliente, en PDF adjunto.
 * No envía (skip) si: SMTP no configurado, el tenant no tiene correo, o la
 * venta no tiene customerEmail. Registra el intento en EmailLog. Nunca lanza.
 */
export async function sendSaleTicketEmail(saleId: string, tenantId: string): Promise<EmailResult> {
  try {
    const transport = getTransport()
    if (!transport) return { sent: false, skipped: "SMTP no configurado" }

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant?.email) return { sent: false, skipped: "Tenant sin correo de remitente" }

    const sale = await db.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: true,
        payments: true,
        user: { select: { name: true } },
        branch: { select: { name: true } },
      },
    })
    if (!sale) return { sent: false, skipped: "Venta no encontrada" }
    if (!sale.customerEmail) return { sent: false, skipped: "Venta sin correo de cliente" }

    const folio = sale.folio ?? sale.id.slice(0, 8)
    const subject = `Ticket de compra ${folio} — ${tenant.name}`

    try {
      const pdf = await generateTicketPDF(
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
          notes: sale.notes,
        },
        { name: tenant.name, phone: tenant.phone, logoUrl: tenant.logoUrl }
      )

      await transport.sendMail({
        from: `"${tenant.name}" <${tenant.email}>`,
        to: sale.customerEmail,
        subject,
        text: `Gracias por tu compra en ${tenant.name}. Adjuntamos tu ticket (folio ${folio}).`,
        attachments: [{ filename: `ticket-${folio}.pdf`, content: pdf }],
      })

      await db.emailLog.create({
        data: { tenantId, to: sale.customerEmail, subject, saleId: sale.id, status: "SENT" },
      })
      return { sent: true }
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr)
      await db.emailLog.create({
        data: { tenantId, to: sale.customerEmail, subject, saleId: sale.id, status: "FAILED", error: msg },
      })
      return { sent: false, error: msg }
    }
  } catch (err) {
    console.error("[sendSaleTicketEmail]", err)
    return { sent: false, error: err instanceof Error ? err.message : String(err) }
  }
}
