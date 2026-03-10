"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Announcement } from "@/lib/announcements/types"

export type PopupPhase = "publish" | "event_day"

type PopupAnnouncement = Announcement & { popupPhase: PopupPhase }

type AnnouncementContextType = {
  anunciosEventosUnread: number
  markAnnouncementsAsRead: () => Promise<void>
  popupAnnouncement: PopupAnnouncement | null
  dismissPopup: (announcementId: string, phase: PopupPhase) => Promise<void>
  refetchUnread: () => Promise<void>
  isLoading: boolean
}

const AnnouncementContext = React.createContext<AnnouncementContextType | undefined>(undefined)

function todayLocalYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [anunciosEventosUnread, setAnunciosEventosUnread] = React.useState(0)
  const [popupAnnouncement, setPopupAnnouncement] = React.useState<PopupAnnouncement | null>(null)
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
    const todayStr = todayLocalYYYYMMDD()

    const tryNewSchema = async (): Promise<boolean> => {
      const { data: views, error: viewsError } = await supabase
        .from("announcement_popup_views")
        .select("announcement_id, phase")
        .eq("user_id", profile.id)
      if (viewsError != null) return false
      const viewedSet = new Set((views ?? []).map((v) => `${v.announcement_id}:${v.phase}`))

      const { data: list, error: listError } = await supabase
        .from("announcements")
        .select("id, title, description, event_date, created_by, created_at, updated_at, show_as_popup")
        .eq("show_as_popup", true)
        .order("created_at", { ascending: false })
      if (listError != null) return false

      const publishPending: Array<{ a: (NonNullable<typeof list>[number]) & { event_date?: string | null }; phase: "publish" }> = []
      const eventDayPending: Array<{ a: (NonNullable<typeof list>[number]) & { event_date?: string | null }; phase: "event_day" }> = []

      for (const a of list ?? []) {
        const keyPublish = `${a.id}:publish`
        const keyEventDay = `${a.id}:event_day`
        const eventDateStr = a.event_date ? String(a.event_date).slice(0, 10) : null
        if (!viewedSet.has(keyPublish)) {
          publishPending.push({ a, phase: "publish" })
        }
        if (eventDateStr === todayStr && !viewedSet.has(keyEventDay)) {
          eventDayPending.push({ a, phase: "event_day" })
        }
      }

      const ordered = [...publishPending.map(({ a, phase }) => ({ a, phase })), ...eventDayPending.map(({ a, phase }) => ({ a, phase }))]
      if (ordered.length === 0) {
        setPopupAnnouncement(null)
        return true
      }
      const first = ordered[0]!
      const { data: creator } = await supabase.from("profiles").select("name").eq("id", first.a.created_by).single()
      setPopupAnnouncement({
        ...first.a,
        creator_name: (creator as { name?: string })?.name ?? "Equipe",
        popupPhase: first.phase,
      } as PopupAnnouncement)
      return true
    }

    const ok = await tryNewSchema()
    if (ok) return

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
    const pending = (list ?? []).filter((a) => !dismissedIds.has(a.id))
    if (pending.length === 0) {
      setPopupAnnouncement(null)
      return
    }
    const first = pending[0]!
    const { data: creator } = await supabase.from("profiles").select("name").eq("id", first.created_by).single()
    setPopupAnnouncement({
      ...first,
      creator_name: (creator as { name?: string })?.name ?? "Equipe",
      popupPhase: "publish",
    } as PopupAnnouncement)
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
    async (announcementId: string, phase: PopupPhase) => {
      if (!supabase || !profile) return
      const announcement = popupAnnouncement?.id === announcementId ? popupAnnouncement : null

      const { error: viewsError } = await supabase.from("announcement_popup_views").upsert(
        {
          announcement_id: announcementId,
          user_id: profile.id,
          phase,
          viewed_at: new Date().toISOString(),
          event_date_ref:
            phase === "event_day" && announcement?.event_date
              ? String(announcement.event_date).slice(0, 10)
              : null,
        },
        { onConflict: "announcement_id,user_id,phase" }
      )
      if (viewsError != null) {
        await supabase.from("announcement_popup_dismissed").upsert(
          { user_id: profile.id, announcement_id: announcementId, dismissed_at: new Date().toISOString() },
          { onConflict: "user_id,announcement_id" }
        )
      }
      await fetchPopupPending()
    },
    [supabase, profile?.id, popupAnnouncement, fetchPopupPending]
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
        async () => {
          await fetchUnreadCount()
          await fetchPopupPending()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, fetchUnreadCount, fetchPopupPending])

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
