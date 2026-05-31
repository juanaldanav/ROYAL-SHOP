"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/contexts/session-context"

/** Redirige al dashboard si el usuario no tiene el rol requerido.
 *  Mientras carga la sesión devuelve allowed=false para evitar flash de botones. */
export function useOwnerGuard() {
  const { user, loaded } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (loaded && user && user.role !== "OWNER") router.replace("/dashboard")
  }, [loaded, user, router])

  // false mientras carga (no renderiza nada) → true solo cuando es OWNER seguro
  return { allowed: loaded && !!user && user.role === "OWNER" }
}
