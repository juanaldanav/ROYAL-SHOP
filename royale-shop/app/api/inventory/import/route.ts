import { db } from "@/lib/db"
import { DEV_TENANT_ID } from "@/lib/constants"
import { NextRequest, NextResponse } from "next/server"

interface CsvRow {
  name: string
  sku: string
  barcode: string
  price: string
  cost: string
  stock: string
  minStock: string
  categoryName: string
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim())
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? ""
    })
    rows.push(row as unknown as CsvRow)
  }

  return rows
}

async function findOrCreateCategory(
  name: string
): Promise<string | null> {
  if (!name) return null

  const existing = await db.category.findFirst({
    where: {
      tenantId: DEV_TENANT_ID,
      name,
      type: "PRODUCT",
    },
  })

  if (existing) return existing.id

  const created = await db.category.create({
    data: {
      tenantId: DEV_TENANT_ID,
      name,
      type: "PRODUCT",
    },
  })

  return created.id
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Se requiere el campo 'file' con el CSV" },
        { status: 400 }
      )
    }

    const text = await (file as File).text()
    const rows = parseCsv(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "El CSV está vacío o no tiene filas de datos" },
        { status: 400 }
      )
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-based + header row

      try {
        if (!row.name) {
          errors.push(`Fila ${rowNum}: 'name' es requerido`)
          continue
        }

        const price = parseFloat(row.price)
        if (isNaN(price)) {
          errors.push(`Fila ${rowNum}: 'price' inválido ("${row.price}")`)
          continue
        }

        const cost = row.cost ? parseFloat(row.cost) : null
        const stock = row.stock ? parseInt(row.stock, 10) : 0
        const minStock = row.minStock ? parseInt(row.minStock, 10) : 0

        // Resolve category
        const categoryId = row.categoryName
          ? await findOrCreateCategory(row.categoryName)
          : null

        if (row.sku) {
          // Check if product with this SKU already exists for this tenant
          const existing = await db.product.findFirst({
            where: {
              tenantId: DEV_TENANT_ID,
              sku: row.sku,
            },
          })

          if (existing) {
            await db.product.update({
              where: { id: existing.id },
              data: {
                price,
                ...(cost !== null ? { cost } : {}),
                stock,
                minStock,
                ...(categoryId ? { categoryId } : {}),
              },
            })
            updated++
          } else {
            await db.product.create({
              data: {
                tenantId: DEV_TENANT_ID,
                name: row.name,
                sku: row.sku || null,
                barcode: row.barcode || null,
                price,
                cost: cost ?? null,
                stock,
                minStock,
                categoryId,
                active: true,
              },
            })
            created++
          }
        } else {
          // No SKU — always create
          await db.product.create({
            data: {
              tenantId: DEV_TENANT_ID,
              name: row.name,
              sku: null,
              barcode: row.barcode || null,
              price,
              cost: cost ?? null,
              stock,
              minStock,
              categoryId,
              active: true,
            },
          })
          created++
        }
      } catch (rowError) {
        const msg =
          rowError instanceof Error ? rowError.message : String(rowError)
        errors.push(`Fila ${rowNum}: ${msg}`)
      }
    }

    return NextResponse.json({ created, updated, errors }, { status: 200 })
  } catch (error) {
    console.error("[POST /api/inventory/import]", error)
    return NextResponse.json({ error: "Error al importar el CSV" }, { status: 500 })
  }
}
