"use client"

import { SessionProvider } from "@/contexts/session-context"
import { OpenShiftPrompt } from "@/components/open-shift-prompt"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <OpenShiftPrompt />
    </SessionProvider>
  )
}
