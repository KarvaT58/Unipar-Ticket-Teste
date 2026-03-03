"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Announcement } from "@/lib/announcements/types"

type AnnouncementContextType = {
  anunciosEventosUnread: number
  markAnnouncementsAsRead: () => Promise<void>
  popupAnnouncement: Announcement | null
  dismissPopup: (announcementId: string) => Promise<void>
  refetchUnread: () => Promise<void>
  isLoading: boolean
}

const AnnouncementContext = React.createContext<AnnouncementContextType | undefined>(undefined)

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [anunciosEventosUnread, setAnunciosEventosUnread] = React.useState(0)
  const [popupAnnouncement, setPopupAnnouncement] = React.useState<Announcement | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchUnreadCount = React.useCallback(async () => {
    if (!supabase || !profile) {
      setAnunciosEventosUnread(0)
      return
    }
    const { data: lastRead } = await supabase
      .from("user_announcement_last_read")
      .select("last_read_at")
      .eq("user_id", profile.id)
      .single()
    const after = lastRead?.last_read_at ?? "1970-01-01T00:00:00Z"
    const { count, error } = await supabase
      .from("announcements")
      .select("*", { count: "exact", head: true })
      .gt("created_at", after)
    if (error) {
      setAnunciosEventosUnread(0)
      return
    }
    setAnunciosEventosUnread(count ?? 0)
  }, [supabase, profile?.id])

  const fetchPopupPending = React.useCallback(async () => {
    if (!supabase || !profile) {
      setPopupAnnouncement(null)
      return
    }
    const { data: dismissed } = await supabase
      .from("announcement_popup_dismissed")
      .select("announcement_id")
      .eq("user_id", profile.id)
    const dismissedIds = new Set((dismissed ?? []).map((r) => r.announcement_id))
    const { data: list } = await supabase
      .from("announcements")
      .select("id, title, description, event_date, created_by, created_at, updated_at, show_as_popup")
      .eq("show_as_popup", true)
      .order("created_at", { ascending: false })
    const pending = (list ?? []).filter((a) => !dismissedIds.has(a.id)) as Announcement[]
    if (pending.length > 0) {
      const first = pending[0]
      const { data: creator } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", first.created_by)
        .single()
      setPopupAnnouncement({ ...first, creator_name: (creator as { name?: string })?.name ?? "Equipe" })
    } else {
      setPopupAnnouncement(null)
    }
  }, [supabase, profile?.id])

  const markAnnouncementsAsRead = React.useCallback(async () => {
    if (!supabase || !profile) return
    await supabase.from("user_announcement_last_read").upsert(
      { user_id: profile.id, last_read_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    setAnunciosEventosUnread(0)
  }, [supabase, profile?.id])

  const dismissPopup = React.useCallback(
    async (announcementId: string) => {
      if (!supabase || !profile) return
      await supabase.from("announcement_popup_dismissed").upsert(
        { user_id: profile.id, announcement_id: announcementId, dismissed_at: new Date().toISOString() },
        { onConflict: "user_id,announcement_id" }
      )
      setPopupAnnouncement((prev) => (prev?.id === announcementId ? null : prev))
    },
    [supabase, profile?.id]
  )

  const refetchUnread = React.useCallback(async () => {
    await fetchUnreadCount()
  }, [fetchUnreadCount])

  React.useEffect(() => {
    if (!profile) {
      setAnunciosEventosUnread(0)
      setPopupAnnouncement(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all([fetchUnreadCount(), fetchPopupPending()]).finally(() => setIsLoading(false))
  }, [profile?.id, fetchUnreadCount, fetchPopupPending])

  React.useEffect(() => {
    if (!supabase || !profile) return
    const channel = supabase
      .channel("announcements-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        async (payload) => {
          const row = payload.new as { id: string; show_as_popup?: boolean; title: string; description?: string; event_date?: string; created_by: string; created_at: string; updated_at: string }
          await fetchUnreadCount()
          if (row.show_as_popup) {
            const { data: creator } = await supabase.from("profiles").select("name").eq("id", row.created_by).single()
            setPopupAnnouncement({
              id: row.id,
              title: row.title,
              description: row.description ?? null,
              event_date: row.event_date ?? null,
              created_by: row.created_by,
              created_at: row.created_at,
              updated_at: row.updated_at,
              show_as_popup: true,
              creator_name: (creator as { name?: string })?.name ?? "Equipe",
            })
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, fetchUnreadCount])

  const value: AnnouncementContextType = {
    anunciosEventosUnread,
    markAnnouncementsAsRead,
    popupAnnouncement,
    dismissPopup,
    refetchUnread,
    isLoading,
  }

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
    </AnnouncementContext.Provider>
  )
}

export function useAnnouncements() {
  const ctx = React.useContext(AnnouncementContext)
  if (ctx === undefined) throw new Error("useAnnouncements must be used within AnnouncementProvider")
  return ctx
}
