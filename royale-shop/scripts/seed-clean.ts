/**
 * seed-clean.ts — Purga datos transaccionales de prueba.
 *
 * ELIMINA:  Sale, SaleItem, Payment, CashCut, CashMovement, Transfer, TransferItem
 * CONSERVA: User, Branch, Tenant, Product, BranchStock, Category, Service
 *
 * Uso:  npx tsx scripts/seed-clean.ts
 * Con confirmación automática:  npx tsx scripts/seed-clean.ts --yes
 */

import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { config } from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, "../.env") })

import { PrismaClient } from "../app/generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import * as readline from "readline"

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close()
      res(answer.trim().toLowerCase() === "s")
    })
  })
}

async function main() {
  const autoYes = process.argv.includes("--yes")

  if (!autoYes) {
    console.log("\n⚠️  Este script borrará TODOS los datos transaccionales:")
    console.log("   Sale, SaleItem, Payment, CashCut, CashMovement, Transfer, TransferItem\n")
    const ok = await confirm("¿Continuar? (s/N): ")
    if (!ok) {
      console.log("Cancelado.")
      process.exit(0)
    }
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const db = new PrismaClient({ adapter })

  try {
    console.log("\n🧹 Limpiando datos transaccionales...\n")

    // Step 1 — CashMovement references CashCut + Sale; must go first
    const cm = await db.cashMovement.deleteMany({})
    console.log(`  ✓ CashMovement:  ${cm.count}`)

    // Step 2 — Payment + SaleItem reference Sale (cascade, but explicit is safer)
    const [pm, si] = await Promise.all([
      db.payment.deleteMany({}),
      db.saleItem.deleteMany({}),
    ])
    console.log(`  ✓ Payment:       ${pm.count}`)
    console.log(`  ✓ SaleItem:      ${si.count}`)

    // Step 3 — Sale references CashCut (nullable FK)
    const sa = await db.sale.deleteMany({})
    console.log(`  ✓ Sale:          ${sa.count}`)

    // Step 4 — CashCut (no more Sale refs)
    const cc = await db.cashCut.deleteMany({})
    console.log(`  ✓ CashCut:       ${cc.count}`)

    // Step 5 — TransferItem must precede Transfer (cascade, but explicit)
    const ti = await db.transferItem.deleteMany({})
    console.log(`  ✓ TransferItem:  ${ti.count}`)

    const tr = await db.transfer.deleteMany({})
    console.log(`  ✓ Transfer:      ${tr.count}`)

    console.log("\n✅ Listo. Se conservaron:")
    console.log("   User · Branch · Tenant · Product · BranchStock · Category · Service\n")
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
