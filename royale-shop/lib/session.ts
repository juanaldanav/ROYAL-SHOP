import { DEV_TENANT_ID, DEV_BRANCH_ID, DEV_USER_ID } from "@/lib/constants"
import type { NextRequest } from "next/server"

export function getSession(req: NextRequest) {
  return {
    tenantId: req.headers.get("x-tenant-id") ?? DEV_TENANT_ID,
    branchId: req.headers.get("x-branch-id") ?? DEV_BRANCH_ID,
    userId: req.headers.get("x-user-id") ?? DEV_USER_ID,
  }
}
