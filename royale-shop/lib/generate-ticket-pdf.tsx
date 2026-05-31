import React from "react"
import {
  Document,
  Page,
  View,
  Text,
  Image as PDFImage,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import { readFile } from "fs/promises"
import path from "path"

// ─── Types ────────────────────────────────────────────────────────────────────

export type PDFSaleItem = {
  id: string
  name: string
  quantity: number
  price: string | number
  subtotal: string | number
}

export type PDFPayment = {
  method: string
  amount: string | number
}

export type PDFSale = {
  folio: string
  createdAt: string | Date
  customerName?: string | null
  customerPhone?: string | null
  subtotal: string | number
  discount: string | number
  total: string | number
  change: string | number
  amountPaid: string | number
  paymentMethod: string
  items: PDFSaleItem[]
  payments?: PDFPayment[]
  cashAmount?: string | number
  cardAmount?: string | number
  transferAmount?: string | number
  user?: { name: string } | null
  branch?: { name: string } | null
  notes?: string | null
}

export type PDFTenant = {
  name: string
  phone?: string | null
  logoUrl?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: string | number) =>
  `$${parseFloat(String(n)).toFixed(2)}`

const fmtDateTime = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  MIXED: "Pago Mixto",
}

function getPaymentLines(sale: PDFSale): { method: string; amount: number }[] {
  if (sale.payments && sale.payments.length > 0) {
    return sale.payments.map((p) => ({ method: p.method, amount: parseFloat(String(p.amount)) }))
  }
  const lines: { method: string; amount: number }[] = []
  if (parseFloat(String(sale.cashAmount ?? 0)) > 0)
    lines.push({ method: "CASH", amount: parseFloat(String(sale.cashAmount)) })
  if (parseFloat(String(sale.cardAmount ?? 0)) > 0)
    lines.push({ method: "CARD", amount: parseFloat(String(sale.cardAmount)) })
  if (parseFloat(String(sale.transferAmount ?? 0)) > 0)
    lines.push({ method: "TRANSFER", amount: parseFloat(String(sale.transferAmount)) })
  return lines
}

// Resolves a logoUrl to a base64 data URI suitable for @react-pdf/renderer.
// Supports: /api/uploads/... (reads from filesystem), /uploads/... (legacy), https?:// (fetches).
async function resolveLogoForPDF(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null
  try {
    if (logoUrl.startsWith("/api/uploads/") || logoUrl.startsWith("/uploads/")) {
      const rel = logoUrl.startsWith("/api/uploads/")
        ? logoUrl.slice("/api/uploads/".length)
        : logoUrl.slice("/uploads/".length)
      const filePath = path.join(process.cwd(), "public", "uploads", rel)
      const buf = await readFile(filePath)
      const ext = path.extname(rel).toLowerCase().replace(".", "")
      const mime =
        ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "png" ? "image/png"
        : ext === "webp" ? "image/webp"
        : "image/jpeg"
      return `data:${mime};base64,${buf.toString("base64")}`
    }
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get("content-type") ?? "image/jpeg"
      return `data:${ct};base64,${buf.toString("base64")}`
    }
    return null
  } catch {
    return null
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0a0a0a",
    padding: "12 18",
    backgroundColor: "#ffffff",
  },
  center: { alignItems: "center" },
  logo: { width: 52, height: 52, borderRadius: 999, marginBottom: 4, objectFit: "cover" },
  bizName: { fontSize: 12, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#666" },
  dash: { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "dashed", marginVertical: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1.5 },
  label: { color: "#666" },
  bold: { fontFamily: "Helvetica-Bold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1.5, fontSize: 11 },
  footer: { fontSize: 8, color: "#888", textAlign: "center", marginTop: 4 },
})

// ─── PDF Document ─────────────────────────────────────────────────────────────

function TicketPDFDocument({
  sale,
  tenant,
  logoData,
}: {
  sale: PDFSale
  tenant: PDFTenant
  logoData: string | null
}) {
  const discount = parseFloat(String(sale.discount))
  const changeAmt = parseFloat(String(sale.change))

  return (
    <Document>
      <Page size={[210, 650]} style={s.page}>

        {/* Header */}
        <View style={s.center}>
          {logoData && <PDFImage src={logoData} style={s.logo} />}
          <Text style={s.bizName}>{tenant.name.toUpperCase()}</Text>
          <Text style={s.subtitle}>Joyería & Perforaciones</Text>
          {tenant.phone && <Text style={s.subtitle}>Tel: {tenant.phone}</Text>}
          {sale.branch?.name && <Text style={s.subtitle}>{sale.branch.name}</Text>}
        </View>

        <View style={s.dash} />

        {/* Meta */}
        <View>
          <View style={s.row}>
            <Text style={s.label}>Folio</Text>
            <Text style={s.bold}>{sale.folio ?? "—"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Fecha</Text>
            <Text>{fmtDateTime(sale.createdAt)}</Text>
          </View>
          {sale.user?.name && (
            <View style={s.row}>
              <Text style={s.label}>Cajero</Text>
              <Text>{sale.user.name}</Text>
            </View>
          )}
          {(sale.customerName || sale.customerPhone) && (
            <View style={s.row}>
              <Text style={s.label}>Cliente</Text>
              <Text>{sale.customerName ?? sale.customerPhone}</Text>
            </View>
          )}
        </View>

        <View style={s.dash} />

        {/* Items */}
        <View style={{ marginBottom: 2 }}>
          {sale.items.map((item, i) => (
            <View key={i} style={{ marginBottom: 3 }}>
              <Text>{item.name}</Text>
              <View style={s.row}>
                <Text style={[s.label, { paddingLeft: 6 }]}>
                  {item.quantity} × {fmt(item.price)}
                </Text>
                <Text style={s.bold}>{fmt(item.subtotal)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.dash} />

        {/* Totals */}
        <View>
          {discount > 0 && (
            <>
              <View style={s.row}>
                <Text style={s.label}>Subtotal</Text>
                <Text>{fmt(sale.subtotal)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Descuento</Text>
                <Text>- {fmt(sale.discount)}</Text>
              </View>
            </>
          )}
          <View style={s.totalRow}>
            <Text style={s.bold}>TOTAL</Text>
            <Text style={s.bold}>{fmt(sale.total)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Método</Text>
            <Text>{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</Text>
          </View>

          {sale.paymentMethod === "CASH" && (
            <>
              <View style={s.row}>
                <Text style={s.label}>Recibido</Text>
                <Text>{fmt(sale.amountPaid)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Cambio</Text>
                <Text>{fmt(sale.change)}</Text>
              </View>
            </>
          )}

          {sale.paymentMethod === "MIXED" &&
            getPaymentLines(sale).map((p, i) => (
              <View key={i} style={s.row}>
                <Text style={s.label}>· {METHOD_LABEL[p.method] ?? p.method}</Text>
                <Text>{fmt(p.amount)}</Text>
              </View>
            ))}
          {sale.paymentMethod === "MIXED" && changeAmt > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Cambio</Text>
              <Text>{fmt(sale.change)}</Text>
            </View>
          )}
        </View>

        {sale.notes ? (
          <>
            <View style={s.dash} />
            <View>
              <Text style={s.label}>Nota</Text>
              <Text>{sale.notes}</Text>
            </View>
          </>
        ) : null}

        <View style={s.dash} />
        <Text style={s.footer}>¡Gracias por su compra!</Text>

      </Page>
    </Document>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function generateTicketPDF(sale: PDFSale, tenant: PDFTenant): Promise<Buffer> {
  const logoData = await resolveLogoForPDF(tenant.logoUrl)
  const element = React.createElement(TicketPDFDocument, { sale, tenant, logoData })
  return renderToBuffer(element as React.ReactElement<DocumentProps>)
}
