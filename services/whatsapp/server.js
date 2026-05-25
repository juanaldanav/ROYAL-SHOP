"use strict"

const express = require("express")
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const QRCode = require("qrcode")

const PORT = parseInt(process.env.PORT ?? "3001", 10)
const app = express()
app.use(express.json())

// ── State ──────────────────────────────────────────────────────────────────
let qrData = null       // raw QR string
let qrImage = null      // base64 PNG
let ready = false
let lastError = null

// ── WhatsApp client ────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "/app/.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  },
})

client.on("qr", async (qr) => {
  qrData = qr
  ready = false
  try {
    qrImage = await QRCode.toDataURL(qr)
    console.log("[whatsapp] QR generado — abre GET /qr para escanearlo")
  } catch (e) {
    console.error("[whatsapp] Error generando QR image:", e)
  }
})

client.on("authenticated", () => {
  console.log("[whatsapp] Sesión autenticada")
  qrData = null
  qrImage = null
})

client.on("ready", () => {
  ready = true
  lastError = null
  console.log("[whatsapp] Cliente listo — número:", client.info?.wid?.user)
})

client.on("disconnected", (reason) => {
  ready = false
  lastError = reason
  console.warn("[whatsapp] Desconectado:", reason)
})

client.on("auth_failure", (msg) => {
  ready = false
  lastError = msg
  console.error("[whatsapp] Auth failure:", msg)
})

client.initialize()

// ── Routes ─────────────────────────────────────────────────────────────────

// Health / estado del cliente
app.get("/status", (_req, res) => {
  res.json({
    ready,
    hasQR: !!qrData,
    number: ready ? client.info?.wid?.user : null,
    error: lastError,
  })
})

// QR para escanear en el primer login
app.get("/qr", (req, res) => {
  if (ready) return res.json({ message: "Ya conectado, no necesitas QR" })
  if (!qrImage) return res.status(503).json({ error: "QR aún no disponible, espera unos segundos" })

  const accept = req.headers["accept"] ?? ""
  if (accept.includes("text/html")) {
    res.send(`<html><body style="background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh">
      <img src="${qrImage}" style="max-width:320px;border-radius:12px"/>
    </body></html>`)
  } else {
    res.json({ qr: qrImage })
  }
})

// Enviar mensaje
// Body: { phone: "521XXXXXXXXXX", message: "Hola..." }
app.post("/send", async (req, res) => {
  if (!ready) {
    return res.status(503).json({ error: "WhatsApp no está conectado" })
  }

  const { phone, message } = req.body
  if (!phone || !message) {
    return res.status(400).json({ error: "phone y message son requeridos" })
  }

  // Normalizar número: solo dígitos, agregar @c.us
  const digits = String(phone).replace(/\D/g, "")
  if (digits.length < 10) {
    return res.status(400).json({ error: "Número inválido" })
  }
  const chatId = `${digits}@c.us`

  try {
    const result = await client.sendMessage(chatId, message)
    res.json({ ok: true, messageId: result.id._serialized })
  } catch (err) {
    console.error("[whatsapp] Error enviando mensaje:", err)
    res.status(500).json({ error: "No se pudo enviar el mensaje" })
  }
})

// Enviar archivo (PDF, imagen, etc.)
// Body: { phone, data: base64, mimetype, filename, caption? }
app.post("/send-file", async (req, res) => {
  if (!ready) {
    return res.status(503).json({ error: "WhatsApp no está conectado" })
  }

  const { phone, data, mimetype, filename, caption } = req.body
  if (!phone || !data || !mimetype) {
    return res.status(400).json({ error: "phone, data y mimetype son requeridos" })
  }

  const digits = String(phone).replace(/\D/g, "")
  if (digits.length < 10) {
    return res.status(400).json({ error: "Número inválido" })
  }
  const chatId = `${digits}@c.us`

  try {
    const media = new MessageMedia(mimetype, data, filename ?? "documento")
    const opts = caption ? { caption } : undefined
    const result = await client.sendMessage(chatId, media, opts)
    res.json({ ok: true, messageId: result.id._serialized })
  } catch (err) {
    console.error("[whatsapp] Error enviando archivo:", err)
    res.status(500).json({ error: "No se pudo enviar el archivo" })
  }
})

app.listen(PORT, () => {
  console.log(`[whatsapp-svc] Escuchando en :${PORT}`)
})
