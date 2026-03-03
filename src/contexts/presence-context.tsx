"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { RealtimeChannel } from "@supabase/supabase-js"

const PRESENCE_CHANNEL = "online-users"

type PresenceContextType = {
  /** Set of user ids that are currently online (tracked via Realtime presence). */
  onlineUserIds: Set<string>
}

const PresenceContext = React.createContext<PresenceContextType | undefined>(undefined)

function collectOnlineUserIds(state: Record<string, Array<{ user_id?: string }>>): Set<string> {
  const ids = new Set<string>()
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p?.user_id) ids.add(p.user_id)
    }
  }
  return ids
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [onlineUserIds, setOnlineUserIds] = React.useState<Set<string>>(new Set())
  const channelRef = React.useRef<RealtimeChannel | null>(null)

  React.useEffect(() => {
    if (!supabase || !profile?.id) {
      setOnlineUserIds(new Set())
      return
    }

    const channel = supabase.channel(PRESENCE_CHANNEL)
    channelRef.current = channel

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>()
        setOnlineUserIds(collectOnlineUserIds(state))
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev)
          for (const p of newPresences as Array<{ user_id?: string }>) {
            if (p?.user_id) next.add(p.user_id)
          }
          return next
        })
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev)
          for (const p of leftPresences as Array<{ user_id?: string }>) {
            if (p?.user_id) next.delete(p.user_id)
          }
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: profile.id })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
      setOnlineUserIds(new Set())
    }
  }, [supabase, profile?.id])

  const value = React.useMemo(() => ({ onlineUserIds }), [onlineUserIds])

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const ctx = React.useContext(PresenceContext)
  if (ctx === undefined) throw new Error("usePresence must be used within PresenceProvider")
  return ctx
}
