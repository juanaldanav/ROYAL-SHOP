export function formatMXN(amount: number | string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function generateFolio(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `VTA-${y}${m}${d}-${rand}`
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function cartSubtotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0)
}
