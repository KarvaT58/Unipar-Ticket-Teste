"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotificationMute } from "@/contexts/notification-mute-context"
import { playNotificationSound } from "@/lib/notification-sound"
import type { Notification } from "@/lib/atendimento/notification-types"

type NotificationContextType = {
  totalUnread: number
  /** Total unread notifications for tickets (all ticket-related) */
  totalTicketUnread: number
  /** Unread count for sidebar "Atendimentos" page only (chamados que iniciei + em andamento + encerrados), excludes queue-only */
  atendimentosPageUnread: number
  iniciadosTabUnread: number
  atendimentosTabUnread: number
  filaTabUnread: number
  encerradosTabUnread: number
  historicoTabUnread: number
  unreadByTicketId: Record<string, number>
  /** Human-readable label for notifications on a ticket: "Novo chamado", "Nova mensagem", or both */
  getNotificationLabelForTicket: (ticketId: string) => string
  /** Ticket id -> title for notification list (e.g. header dropdown) */
  ticketTitleByTicketId: Record<string, string>
  /** Unread notifications grouped by ticket (for display) */
  notificationsByTicketId: Record<string, { count: number; types: string[] }>
  /** Full list of unread notifications (ticket, announcement, chat) for dropdown list */
  unreadNotificationItems: Array<{
    id: string
    ticket_id: string | null
    announcement_id: string | null
    chat_conversation_id: string | null
    task_id: string | null
    chat_sender_name: string | null
    actor_name: string | null
    type: string
    created_at: string
    ticketTitle: string
    announcementTitle: string | null
  }>
  /** First unread overdue (12h or 3d) notification for blocking popup */
  overduePopupNotification: {
    id: string
    ticket_id: string
    type: string
    ticketTitle: string
  } | null
  messageIdsWithNotification: Set<string>
  /** Unread count per chat conversation (for sidebar badge) */
  unreadByChatConversationId: Record<string, number>
  isLoading: boolean
  markTicketAsRead: (ticketId: string) => Promise<void>
  markNotificationAsRead: (notificationId: string) => Promise<void>
  markChatConversationAsRead: (conversationId: string) => Promise<void>
  dismissOverduePopup: (notificationId: string) => Promise<void>
  refetch: () => Promise<void>
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const { muted: notificationSoundMuted } = useNotificationMute()
  const supabase = createClient()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [myTicketIds, setMyTicketIds] = React.useState<Set<string>>(new Set())
  const [filaTicketIds, setFilaTicketIds] = React.useState<Set<string>>(new Set())
  const [encerradosTicketIds, setEncerradosTicketIds] = React.useState<Set<string>>(new Set())
  const [historicoTicketIds, setHistoricoTicketIds] = React.useState<Set<string>>(new Set())
  const [iniciadosTicketIds, setIniciadosTicketIds] = React.useState<Set<string>>(new Set())
  const [ticketTitleByTicketId, setTicketTitleByTicketId] = React.useState<Record<string, string>>({})
  const [announcementTitleByAnnouncementId, setAnnouncementTitleByAnnouncementId] = React.useState<Record<string, string>>({})
  const [chatSenderNameByUserId, setChatSenderNameByUserId] = React.useState<Record<string, string>>({})
  const [actorNameByUserId, setActorNameByUserId] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchUnread = React.useCallback(async () => {
    if (!supabase || !profile) {
      setNotifications([])
      setMyTicketIds(new Set())
      setFilaTicketIds(new Set())
      setEncerradosTicketIds(new Set())
      setHistoricoTicketIds(new Set())
      setIniciadosTicketIds(new Set())
      setTicketTitleByTicketId({})
      setAnnouncementTitleByAnnouncementId({})
      setIsLoading(false)
      return
    }
    const { data: unread } = await supabase
      .from("notifications")
      .select("id, ticket_id, ticket_message_id, announcement_id, chat_conversation_id, chat_sender_id, chat_message_id, task_id, type, created_at, actor_user_id")
      .eq("user_id", profile.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })

    const list = (unread ?? []) as Notification[]

    const [myRes, filaRes, encerradosRes, historicoRes, iniciadosRes] = await Promise.all([
      supabase.from("tickets").select("id").eq("assigned_to_user_id", profile.id).eq("status", "in_progress"),
      profile.department
        ? supabase.from("tickets").select("id").eq("target_sector", profile.department).eq("status", "queue")
        : { data: [] as { id: string }[] },
      supabase.from("tickets").select("id").eq("status", "closed").eq("created_by", profile.id),
      supabase
        .from("tickets")
        .select("id")
        .eq("status", "closed")
        .eq("assigned_to_user_id", profile.id)
        .neq("created_by", profile.id),
      supabase.from("tickets").select("id").eq("created_by", profile.id).neq("status", "closed"),
    ])

    setNotifications(list)
    setMyTicketIds(new Set((myRes.data ?? []).map((t: { id: string }) => t.id)))
    setFilaTicketIds(new Set((filaRes.data ?? []).map((t: { id: string }) => t.id)))
    setEncerradosTicketIds(new Set((encerradosRes.data ?? []).map((t: { id: string }) => t.id)))
    setHistoricoTicketIds(new Set((historicoRes.data ?? []).map((t: { id: string }) => t.id)))
    setIniciadosTicketIds(new Set((iniciadosRes.data ?? []).map((t: { id: string }) => t.id)))

    if (list.length > 0) {
      const ticketIds = [...new Set(list.map((n) => n.ticket_id).filter(Boolean))] as string[]
      const announcementIds = [...new Set(list.map((n) => n.announcement_id).filter(Boolean))] as string[]
      const chatSenderIds = [...new Set(list.map((n) => n.chat_sender_id).filter(Boolean))] as string[]
      const actorIds = [...new Set(list.map((n) => n.actor_user_id).filter(Boolean))] as string[]
      const [ticketsRes, announcementsRes, profilesRes, actorProfilesRes] = await Promise.all([
        ticketIds.length > 0
          ? supabase.from("tickets").select("id, title").in("id", ticketIds)
          : { data: [] as { id: string; title: string }[] },
        announcementIds.length > 0
          ? supabase.from("announcements").select("id, title").in("id", announcementIds)
          : { data: [] as { id: string; title: string }[] },
        chatSenderIds.length > 0
          ? supabase.from("profiles").select("id, name").in("id", chatSenderIds)
          : { data: [] as { id: string; name: string | null }[] },
        actorIds.length > 0
          ? supabase.from("profiles").select("id, name").in("id", actorIds)
          : { data: [] as { id: string; name: string | null }[] },
      ])
      const titleMap: Record<string, string> = {}
      ;(ticketsRes.data ?? []).forEach((row: { id: string; title: string }) => {
        titleMap[row.id] = row.title
      })
      setTicketTitleByTicketId(titleMap)
      const announcementTitleMap: Record<string, string> = {}
      ;(announcementsRes.data ?? []).forEach((row: { id: string; title: string }) => {
        announcementTitleMap[row.id] = row.title
      })
      setAnnouncementTitleByAnnouncementId(announcementTitleMap)
      const chatSenderNameMap: Record<string, string> = {}
      ;(profilesRes.data ?? []).forEach((row: { id: string; name: string | null }) => {
        chatSenderNameMap[row.id] = row.name ?? "Usuário"
      })
      setChatSenderNameByUserId(chatSenderNameMap)
      const actorNameMap: Record<string, string> = {}
      ;(actorProfilesRes.data ?? []).forEach((row: { id: string; name: string | null }) => {
        actorNameMap[row.id] = row.name ?? "Usuário"
      })
      setActorNameByUserId(actorNameMap)
    } else {
      setTicketTitleByTicketId({})
      setAnnouncementTitleByAnnouncementId({})
      setChatSenderNameByUserId({})
      setActorNameByUserId({})
    }

    setIsLoading(false)
  }, [supabase, profile])

  React.useEffect(() => {
    fetchUnread()
  }, [fetchUnread])

  React.useEffect(() => {
    if (!supabase || !profile) return
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnread()
          if (!notificationSoundMuted) playNotificationSound()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, fetchUnread, notificationSoundMuted])

  const totalUnread = notifications.length
  const totalTicketUnread = notifications.filter((n) => n.ticket_id != null).length
  const iniciadosTabUnread = notifications.filter((n) => n.ticket_id && iniciadosTicketIds.has(n.ticket_id)).length
  const atendimentosTabUnread = notifications.filter((n) => n.ticket_id && myTicketIds.has(n.ticket_id)).length
  const filaTabUnread = notifications.filter((n) => n.ticket_id && filaTicketIds.has(n.ticket_id)).length
  const encerradosTabUnread = notifications.filter((n) => n.ticket_id && encerradosTicketIds.has(n.ticket_id)).length
  const historicoTabUnread = notifications.filter((n) => n.ticket_id && historicoTicketIds.has(n.ticket_id)).length
  /** Notifications relevant only to the Atendimentos page tabs (excludes queue-only); used for sidebar "Atendimentos" badge */
  const atendimentosPageUnread = iniciadosTabUnread + atendimentosTabUnread + encerradosTabUnread
  const unreadByTicketId = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of notifications) {
      if (n.ticket_id) map[n.ticket_id] = (map[n.ticket_id] ?? 0) + 1
    }
    return map
  }, [notifications])
  const messageIdsWithNotification = React.useMemo(
    () => new Set(notifications.map((n) => n.ticket_message_id).filter(Boolean) as string[]),
    [notifications]
  )

  const getNotificationLabelForTicket = React.useCallback(
    (ticketId: string) => {
      const forTicket = notifications.filter((n) => n.ticket_id === ticketId)
      if (forTicket.length === 0) return ""
      const hasNewTicket = forTicket.some((n) => n.type === "new_ticket")
      const hasNewMessage = forTicket.some((n) => n.type === "new_message")
      if (hasNewTicket && hasNewMessage) return "Novo chamado e nova mensagem"
      if (hasNewTicket) return "Novo chamado"
      if (hasNewMessage) return "Nova mensagem"
      return "Notificação"
    },
    [notifications]
  )

  const notificationsByTicketId = React.useMemo(() => {
    const map: Record<string, { count: number; types: string[] }> = {}
    for (const n of notifications) {
      if (!n.ticket_id) continue
      if (!map[n.ticket_id]) map[n.ticket_id] = { count: 0, types: [] }
      map[n.ticket_id].count += 1
      if (!map[n.ticket_id].types.includes(n.type)) map[n.ticket_id].types.push(n.type)
    }
    return map
  }, [notifications])

  const unreadNotificationItems = React.useMemo(
    () =>
      notifications.map((n) => ({
        id: n.id,
        ticket_id: n.ticket_id ?? null,
        announcement_id: n.announcement_id ?? null,
        chat_conversation_id: n.chat_conversation_id ?? null,
        task_id: n.task_id ?? null,
        chat_sender_name: n.chat_sender_id ? (chatSenderNameByUserId[n.chat_sender_id] ?? "Usuário") : null,
        actor_name: n.actor_user_id ? (actorNameByUserId[n.actor_user_id] ?? "Usuário") : null,
        type: n.type,
        created_at: n.created_at ?? new Date().toISOString(),
        ticketTitle: n.ticket_id ? (ticketTitleByTicketId[n.ticket_id] ?? "Chamado") : "",
        announcementTitle: n.announcement_id ? (announcementTitleByAnnouncementId[n.announcement_id] ?? "Anúncio") : null,
      })),
    [notifications, ticketTitleByTicketId, announcementTitleByAnnouncementId, chatSenderNameByUserId, actorNameByUserId]
  )

  const overduePopupNotification = React.useMemo(() => {
    const item = unreadNotificationItems.find(
      (i) => i.type === "ticket_overdue_12h" || i.type === "ticket_overdue_3d"
    )
    if (!item || !item.ticket_id) return null
    return {
      id: item.id,
      ticket_id: item.ticket_id,
      type: item.type,
      ticketTitle: item.ticketTitle,
    }
  }, [unreadNotificationItems])

  const unreadByChatConversationId = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of notifications) {
      if (n.chat_conversation_id) map[n.chat_conversation_id] = (map[n.chat_conversation_id] ?? 0) + 1
    }
    return map
  }, [notifications])

  const markTicketAsRead = React.useCallback(
    async (ticketId: string) => {
      if (!supabase || !profile) return
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", profile.id)
        .eq("ticket_id", ticketId)
        .is("read_at", null)
      await fetchUnread()
    },
    [supabase, profile, fetchUnread]
  )

  const markNotificationAsRead = React.useCallback(
    async (notificationId: string) => {
      if (!supabase || !profile) return
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", profile.id)
      await fetchUnread()
    },
    [supabase, profile, fetchUnread]
  )

  const markChatConversationAsRead = React.useCallback(
    async (conversationId: string) => {
      if (!supabase || !profile) return
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", profile.id)
        .eq("chat_conversation_id", conversationId)
        .is("read_at", null)
      await fetchUnread()
    },
    [supabase, profile, fetchUnread]
  )

  const dismissOverduePopup = React.useCallback(
    async (notificationId: string) => {
      await markNotificationAsRead(notificationId)
    },
    [markNotificationAsRead]
  )

  const value: NotificationContextType = {
    totalUnread,
    totalTicketUnread,
    atendimentosPageUnread,
    iniciadosTabUnread,
    atendimentosTabUnread,
    filaTabUnread,
    encerradosTabUnread,
    historicoTabUnread,
    unreadByTicketId,
    getNotificationLabelForTicket,
    ticketTitleByTicketId,
    notificationsByTicketId,
    unreadNotificationItems,
    overduePopupNotification,
    messageIdsWithNotification,
    unreadByChatConversationId,
    isLoading,
    markTicketAsRead,
    markNotificationAsRead,
    markChatConversationAsRead,
    dismissOverduePopup,
    refetch: fetchUnread,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = React.useContext(NotificationContext)
  if (ctx === undefined) throw new Error("useNotifications must be used within NotificationProvider")
  return ctx
}
