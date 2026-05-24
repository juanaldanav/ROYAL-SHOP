"use client"

import { SessionProvider } from "@/contexts/session-context"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
