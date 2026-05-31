"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react"

export type SessionUser = {
  id: string
  name: string
  role: "OWNER" | "MANAGER" | "CASHIER"
  tenantId: string
  branchId: string
  branchName: string
}

type SessionCtx = {
  user: SessionUser | null
  loaded: boolean
  login: (user: SessionUser) => void
  logout: () => void
  switchBranch: (branchId: string, branchName: string) => void
}

const SessionContext = createContext<SessionCtx>({
  user: null,
  loaded: false,
  login: () => {},
  logout: () => {},
  switchBranch: () => {},
})

const STORAGE_KEY = "royale_session"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch {}
    setLoaded(true)
  }, [])

  function login(u: SessionUser) {
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  function switchBranch(branchId: string, branchName: string) {
    if (!user) return
    const updated = { ...user, branchId, branchName }
    setUser(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    // Force full reload so all API calls, useEffects, and cached data reflect the new branch
    window.location.reload()
  }

  return (
    <SessionContext.Provider value={{ user, loaded, login, logout, switchBranch }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
