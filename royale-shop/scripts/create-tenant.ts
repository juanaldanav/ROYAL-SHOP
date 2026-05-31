/**
 * create-tenant.ts — Onboarding de un negocio nuevo (tenant).
 *
 * Pregunta interactivamente y crea EN UNA SOLA TRANSACCIÓN:
 *   - Tenant   (tenantId = cuid() generado por Prisma)
 *   - Branch   (primera sucursal del negocio)
 *   - User     (OWNER con PIN — texto plano, consistente con el login actual)
 *
 * Uso:  npm run create-tenant
 *
 * Nota seguridad: el PIN se guarda en texto plano porque el login
 * (/api/auth/login) compara en texto plano. Migrar a hash es deuda
 * documentada en PROGRESS.md para post-MVP.
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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string): Promise<string> {
  return new Promise((res) => rl.question(question, (a) => res(a.trim())))
}

/** Pregunta hasta obtener un valor que pase la validación. */
async function askValid(
  label: string,
  validate: (v: string) => string | null
): Promise<string> {
  for (;;) {
    const value = await ask(label)
    const err = validate(value)
    if (!err) return value
    console.log(`  ⚠️  ${err}`)
  }
}

const required = (v: string) => (v.length ? null : "Requerido.")
const isPin = (v: string) => (/^\d{4}$/.test(v) ? null : "El PIN debe ser de 4 dígitos.")

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "negocio"
}

async function main() {
  console.log("\n🏪  Alta de negocio nuevo (tenant)\n")

  const businessName = await askValid("Nombre del negocio: ", required)
  const phoneRaw = await ask("Teléfono (opcional): ")
  const ownerName = await askValid("Nombre del usuario OWNER: ", required)
  const pin = await askValid("PIN del OWNER (4 dígitos): ", isPin)
  const branchName = await askValid("Nombre de la primera sucursal: ", required)

  rl.close()

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const db = new PrismaClient({ adapter })

  try {
    // slug único: base derivada del nombre; si choca, añade sufijo numérico
    const base = slugify(businessName)
    let slug = base
    for (let n = 2; await db.tenant.findUnique({ where: { slug } }); n++) {
      slug = `${base}-${n}`
    }

    // email OWNER único (User.email es @unique global)
    const emailBase = `${slug}-owner`
    let email = `${emailBase}@royal.shop`
    for (let n = 2; await db.user.findUnique({ where: { email } }); n++) {
      email = `${emailBase}-${n}@royal.shop`
    }

    const phone = phoneRaw.length ? phoneRaw : null

    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: businessName, slug, phone },
      })
      const branch = await tx.branch.create({
        data: { tenantId: tenant.id, name: branchName },
      })
      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          email,
          name: ownerName,
          role: "OWNER",
          pin, // texto plano — ver nota de seguridad arriba
        },
      })
      return { tenant, branch, owner }
    })

    console.log("\n✅ Negocio creado:\n")
    console.log(`   Tenant    : ${result.tenant.name}`)
    console.log(`   tenantId  : ${result.tenant.id}`)
    console.log(`   slug      : ${result.tenant.slug}`)
    console.log(`   Sucursal  : ${result.branch.name}  (${result.branch.id})`)
    console.log(`   OWNER     : ${result.owner.name}  <${result.owner.email}>`)
    console.log(`   PIN       : ${pin}`)
    console.log("\n👉 Entra en /login, elige la sucursal del negocio y teclea el PIN.\n")
  } catch (e) {
    console.error("\n❌ Error al crear el negocio:", e)
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
