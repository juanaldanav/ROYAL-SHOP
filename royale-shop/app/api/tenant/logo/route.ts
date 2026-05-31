import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { assertOwner } from "@/lib/rbac"

export async function POST(req: NextRequest) {
  const denied = await assertOwner(req)
  if (denied) return denied

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const allowed = ["image/jpeg", "image/png", "image/webp"]
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Formato no soportado. Usa JPG, PNG o WebP." }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen no puede superar 5MB" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const filename = `tenant-logo-${Date.now()}.${ext}`
  const uploadDir = path.join(process.cwd(), "public", "uploads", "tenant")
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({ url: `/api/uploads/tenant/${filename}` })
}
