"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

function canViewIdeas(profile: { department: string; role: string } | null): boolean {
  if (!profile) return false
  return (
    profile.department === "TI" ||
    profile.department === "ADMINISTRAÇÃO" ||
    profile.role === "admin"
  )
}

type IdeasContextType = {
  ideasPendingCount: number
  refetchPendingCount: () => Promise<void>
}

const IdeasContext = React.createContext<IdeasContextType | undefined>(undefined)

export function IdeasProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [ideasPendingCount, setIdeasPendingCount] = React.useState(0)

  const refetchPendingCount = React.useCallback(async () => {
    if (!supabase || !canViewIdeas(profile)) {
      setIdeasPendingCount(0)
      return
    }
    const { count, error } = await supabase
      .from("ideas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
    if (error) {
      setIdeasPendingCount(0)
      return
    }
    setIdeasPendingCount(count ?? 0)
  }, [supabase, profile])

  React.useEffect(() => {
    refetchPendingCount()
  }, [refetchPendingCount])

  const value = React.useMemo(
    () => ({ ideasPendingCount, refetchPendingCount }),
    [ideasPendingCount, refetchPendingCount]
  )

  return <IdeasContext.Provider value={value}>{children}</IdeasContext.Provider>
}

export function useIdeas() {
  const ctx = React.useContext(IdeasContext)
  if (ctx === undefined) {
    return { ideasPendingCount: 0, refetchPendingCount: async () => {} }
  }
  return ctx
}
