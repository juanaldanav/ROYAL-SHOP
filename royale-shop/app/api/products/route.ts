import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { tenantId } = getSession(req)
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")
  const active = searchParams.get("active")

  const products = await db.product.findMany({
    where: {
      tenantId,
      ...(categoryId ? { categoryId } : {}),
      ...(active !== null ? { active: active === "true" } : {}),
    },
    include: {
      category: true,
      branchStocks: {
        include: {
          branch: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const { tenantId } = getSession(req)
  const body = await req.json()
  const {
    name,
    sku,
    barcode,
    price,
    cost,
    stock,
    minStock,
    categoryId,
    description,
    imageUrl,
    branchId,
    allBranches,
  } = body

  if (!name || !price) {
    return NextResponse.json({ error: "name y price son requeridos" }, { status: 400 })
  }

  const { branchId: sessionBranchId } = getSession(req)
  const targetBranchId = branchId || sessionBranchId

  const product = await db.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        tenantId,
        name,
        sku: sku || null,
        barcode: barcode || null,
        price,
        cost: cost || null,
        categoryId: categoryId || null,
        description: description || null,
        imageUrl: imageUrl || null,
      },
      include: {
        category: true,
        branchStocks: {
          include: {
            branch: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (allBranches === true) {
      // Create a branchStock entry for every active branch in this tenant
      const branches = await db.branch.findMany({
        where: { tenantId, active: true },
      })
      if (branches.length > 0) {
        await tx.branchStock.createMany({
          data: branches.map((b) => ({
            tenantId,
            branchId: b.id,
            productId: p.id,
            stock: stock ?? 0,
            minStock: minStock ?? 0,
          })),
          skipDuplicates: true,
        })
      }
    } else if (stock !== undefined || minStock !== undefined) {
      // Single branch stock
      await tx.branchStock.create({
        data: {
          tenantId,
          branchId: targetBranchId,
          productId: p.id,
          stock: stock ?? 0,
          minStock: minStock ?? 0,
        },
      })
    }

    return p
  })

  return NextResponse.json(product, { status: 201 })
}
