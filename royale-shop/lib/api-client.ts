const STORAGE_KEY = "royale_session"

export function getSessionHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const s = JSON.parse(raw)
    const h: Record<string, string> = {}
    if (s.id) h["x-user-id"] = s.id
    if (s.branchId) h["x-branch-id"] = s.branchId
    if (s.tenantId) h["x-tenant-id"] = s.tenantId
    return h
  } catch {
    return {}
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...getSessionHeaders(),
    },
  })
}
