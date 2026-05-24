import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { db: PrismaClient }

export const db = globalForPrisma.db ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.db = db
