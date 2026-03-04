"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotificationMute } from "@/contexts/notification-mute-context"
import { useNotifications } from "@/contexts/notification-context"
import { playNotificationSound } from "@/lib/notification-sound"
import type {
  ChatMessage,
  ChatConversationWithPeer,
  PriorityMessagePayload,
} from "@/lib/chat/types"
import type { RealtimeChannel } from "@supabase/supabase-js"

const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"
const TYPING_CHANNEL_PREFIX = "chat-typing:"
const MESSAGES_PAGE_SIZE = 30

type ChatContextType = {
  conversations: ChatConversationWithPeer[]
  pinnedConversationIds: Set<string>
  messagesByConversationId: Record<string, ChatMessage[]>
  pinnedMessageIds: Set<string>
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  priorityMessage: PriorityMessagePayload | null
  dismissPriorityMessage: () => void
  typingUserIdsByConversationId: Record<string, string[]>
  isLoadingConversations: boolean
  isLoadingMessages: (conversationId: string) => boolean
  refetchConversations: () => Promise<void>
  refetchMessages: (conversationId: string) => Promise<void>
  loadMoreMessages: (conversationId: string) => Promise<void>
  hasMoreOldMessages: (conversationId: string) => boolean
  isLoadingMoreMessages: (conversationId: string) => boolean
  startConversation: (otherUserId: string) => Promise<string | null>
  sendMessage: (
    conversationId: string,
    payload: {
      content?: string | null
      message_type?: ChatMessage["message_type"]
      file_path?: string | null
      file_name?: string | null
      is_priority?: boolean
    }
  ) => Promise<void>
  pinConversation: (conversationId: string) => Promise<void>
  unpinConversation: (conversationId: string) => Promise<void>
  pinMessage: (messageId: string) => Promise<void>
  unpinMessage: (messageId: string) => Promise<void>
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>
  setTyping: (conversationId: string, typing: boolean) => void
  leaveTypingChannel: (conversationId: string) => void
  getAttachmentUrl: (path: string) => Promise<string | null>
}

const ChatContext = React.createContext<ChatContextType | undefined>(undefined)

function getOtherUserId(conv: { user_a_id: string; user_b_id: string }, myId: string): string {
  return conv.user_a_id === myId ? conv.user_b_id : conv.user_a_id
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { profile } = useAuth()
  const { muted: notificationSoundMuted } = useNotificationMute()
  const { markChatConversationAsRead, markNotificationAsRead } = useNotifications()
  const [conversations, setConversations] = React.useState<ChatConversationWithPeer[]>([])
  const [pinnedConversationIds, setPinnedConversationIds] = React.useState<Set<string>>(new Set())
  const [messagesByConversationId, setMessagesByConversationId] = React.useState<
    Record<string, ChatMessage[]>
  >({})
  const [hasMoreOldMessagesByConversationId, setHasMoreOldMessagesByConversationId] = React.useState<
    Record<string, boolean>
  >({})
  const [pinnedMessageIds, setPinnedMessageIds] = React.useState<Set<string>>(new Set())
  const loadingMoreRef = React.useRef<Set<string>>(new Set())
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const activeConversationIdRef = React.useRef<string | null>(null)
  activeConversationIdRef.current = activeConversationId
  const [priorityMessage, setPriorityMessage] = React.useState<PriorityMessagePayload | null>(null)
  const priorityMessageRef = React.useRef<PriorityMessagePayload | null>(null)
  priorityMessageRef.current = priorityMessage
  const hasFetchedPriorityOnLoadRef = React.useRef(false)
  const [typingUserIdsByConversationId, setTypingUserIdsByConversationId] = React.useState<
    Record<string, string[]>
  >({})
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(true)
  const loadingMessagesRef = React.useRef<Set<string>>(new Set())
  const channelsRef = React.useRef<Map<string, RealtimeChannel>>(new Map())
  const messagesByConversationIdRef = React.useRef(messagesByConversationId)
  messagesByConversationIdRef.current = messagesByConversationId
  const pinnedConversationIdsRef = React.useRef(pinnedConversationIds)
  pinnedConversationIdsRef.current = pinnedConversationIds

  const fetchConversations = React.useCallback(async () => {
    if (!supabase || !profile?.id) {
      setConversations([])
      return
    }
    setIsLoadingConversations(true)
    try {
      const { data: convRows, error: convError } = await supabase
        .from("chat_conversations")
        .select("id, user_a_id, user_b_id, last_message_at, created_at")
        .or(`user_a_id.eq.${profile.id},user_b_id.eq.${profile.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false })

      if (convError) {
        setConversations([])
        return
      }

      const { data: pinnedRows } = await supabase
        .from("chat_pinned_conversations")
        .select("conversation_id")
        .eq("user_id", profile.id)
      const pinned = new Set((pinnedRows ?? []).map((r) => r.conversation_id))
      setPinnedConversationIds(pinned)

      const list = convRows ?? []
      const otherIds = list.map((c) => getOtherUserId(c, profile.id))
      const uniqueOtherIds = [...new Set(otherIds)]

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", uniqueOtherIds)
      const profileMap = new Map(
        (profilesData ?? []).map((p) => [p.id, { name: p.name ?? "", avatar_url: p.avatar_url ?? null }])
      )

      const { data: lastMessages } = await supabase
        .from("chat_messages")
        .select("conversation_id, content, message_type")
        .in(
          "conversation_id",
          list.map((c) => c.id)
        )
        .order("created_at", { ascending: false })

      const lastByConv = new Map<string | undefined, { content: string | null; message_type: string }>()
      for (const m of lastMessages ?? []) {
        if (m.conversation_id && !lastByConv.has(m.conversation_id)) {
          lastByConv.set(m.conversation_id, {
            content: m.content ?? null,
            message_type: m.message_type ?? "text",
          })
        }
      }

      const withPeer: ChatConversationWithPeer[] = list.map((c) => {
        const otherId = getOtherUserId(c, profile.id)
        const p = profileMap.get(otherId)
        const last = lastByConv.get(c.id)
        return {
          ...c,
          other_id: otherId,
          other_name: p?.name ?? "Usuário",
          other_avatar_url: p?.avatar_url ?? null,
          last_message_preview:
            last?.message_type === "text" ? last.content : last ? `[${last.message_type}]` : null,
        }
      })
      setConversations(withPeer)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [supabase, profile?.id])

  const fetchMessages = React.useCallback(
    async (conversationId: string) => {
      if (!supabase || !profile?.id) return
      loadingMessagesRef.current.add(conversationId)
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, conversation_id, sender_id, content, message_type, file_path, file_name, is_priority, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PAGE_SIZE)
        if (error) return
        const list = (data ?? []) as ChatMessage[]
        list.reverse()
        setMessagesByConversationId((prev) => ({ ...prev, [conversationId]: list }))
        setHasMoreOldMessagesByConversationId((prev) => ({
          ...prev,
          [conversationId]: list.length === MESSAGES_PAGE_SIZE,
        }))
      } finally {
        loadingMessagesRef.current.delete(conversationId)
      }
    },
    [supabase, profile?.id]
  )

  const loadMoreMessages = React.useCallback(
    async (conversationId: string) => {
      if (!supabase || !profile?.id) return
      const current = messagesByConversationIdRef.current[conversationId] ?? []
      if (current.length === 0) return
      const oldest = current[0]
      if (loadingMoreRef.current.has(conversationId)) return
      const hasMore = hasMoreOldMessagesByConversationId[conversationId]
      if (!hasMore) return
      loadingMoreRef.current.add(conversationId)
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, conversation_id, sender_id, content, message_type, file_path, file_name, is_priority, created_at")
          .eq("conversation_id", conversationId)
          .lt("created_at", oldest.created_at)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PAGE_SIZE)
        if (error) return
        const older = (data ?? []) as ChatMessage[]
        older.reverse()
        setMessagesByConversationId((prev) => {
          const list = prev[conversationId] ?? []
          const merged = [...older, ...list]
          return { ...prev, [conversationId]: merged }
        })
        setHasMoreOldMessagesByConversationId((prev) => ({
          ...prev,
          [conversationId]: older.length === MESSAGES_PAGE_SIZE,
        }))
      } finally {
        loadingMoreRef.current.delete(conversationId)
      }
    },
    [supabase, profile?.id, hasMoreOldMessagesByConversationId]
  )

  const hasMoreOldMessages = React.useCallback((conversationId: string) => {
    return hasMoreOldMessagesByConversationId[conversationId] === true
  }, [hasMoreOldMessagesByConversationId])

  const isLoadingMoreMessages = React.useCallback((conversationId: string) => {
    return loadingMoreRef.current.has(conversationId)
  }, [])

  const fetchPinnedMessageIds = React.useCallback(async () => {
    if (!supabase || !profile?.id) return
    const { data } = await supabase
      .from("chat_message_pins")
      .select("message_id")
      .eq("user_id", profile.id)
    setPinnedMessageIds(new Set((data ?? []).map((r) => r.message_id)))
  }, [supabase, profile?.id])

  const isLoadingMessages = React.useCallback((conversationId: string) => {
    return loadingMessagesRef.current.has(conversationId)
  }, [])

  React.useEffect(() => {
    if (!profile?.id) {
      setConversations([])
      setIsLoadingConversations(false)
      return
    }
    fetchConversations()
    fetchPinnedMessageIds()
  }, [profile?.id, fetchConversations, fetchPinnedMessageIds])

  React.useEffect(() => {
    if (!supabase || !profile?.id || hasFetchedPriorityOnLoadRef.current) return
    hasFetchedPriorityOnLoadRef.current = true
    let cancelled = false
    supabase
      .from("notifications")
      .select("id, chat_message_id, chat_sender_id, chat_conversation_id")
      .eq("user_id", profile.id)
      .eq("type", "chat_priority_message")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: notif }) => {
        if (cancelled || !notif?.chat_message_id) return
        const { data: msg } = await supabase
          .from("chat_messages")
          .select("id, conversation_id, sender_id, content, message_type, file_path, file_name, is_priority, created_at")
          .eq("id", notif.chat_message_id)
          .single()
        if (cancelled || !msg) return
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", notif.chat_sender_id ?? msg.sender_id)
          .single()
        if (cancelled) return
        setPriorityMessage({
          message: msg as ChatMessage,
          conversationId: notif.chat_conversation_id ?? msg.conversation_id,
          senderName: (senderProfile as { name?: string })?.name ?? "Alguém",
          notificationId: notif.id,
        })
      })
    return () => { cancelled = true }
  }, [supabase, profile?.id])

  React.useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("chat-messages-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as ChatMessage
          const isForMe = row.sender_id !== profile.id
          let recipientId: string | null = null
          const conv = conversations.find((c) => c.id === row.conversation_id)
          if (conv) {
            recipientId = getOtherUserId(conv, row.sender_id)
          } else {
            const { data: convRow } = await supabase
              .from("chat_conversations")
              .select("user_a_id, user_b_id")
              .eq("id", row.conversation_id)
              .single()
            if (convRow) recipientId = convRow.user_a_id === row.sender_id ? convRow.user_b_id : convRow.user_a_id
          }
          if (isForMe && activeConversationIdRef.current === row.conversation_id) {
            markChatConversationAsRead(row.conversation_id)
            if (!notificationSoundMuted) playNotificationSound()
          }
          if (row.is_priority && isForMe && recipientId === profile.id) {
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", row.sender_id)
              .single()
            setPriorityMessage({
              message: row,
              conversationId: row.conversation_id,
              senderName: (senderProfile as { name?: string })?.name ?? "Alguém",
            })
          }
          setMessagesByConversationId((prev) => {
            const list = prev[row.conversation_id] ?? []
            if (list.some((m) => m.id === row.id)) return prev
            return { ...prev, [row.conversation_id]: [...list, row] }
          })
          setConversations((prev) => {
            const conv = prev.find((c) => c.id === row.conversation_id)
            const preview =
              row.message_type === "text" ? (row.content ?? null) : `[${row.message_type}]`
            if (conv) {
              const pinned = pinnedConversationIdsRef.current
              const updated = prev.map((c) =>
                c.id === row.conversation_id
                  ? { ...c, last_message_at: row.created_at, last_message_preview: preview }
                  : c
              )
              return [...updated].sort((a, b) => {
                const pinA = pinned.has(a.id)
                const pinB = pinned.has(b.id)
                if (pinA && !pinB) return -1
                if (!pinA && pinB) return 1
                const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                return timeB - timeA
              })
            }
            void fetchConversations()
            return prev
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, conversations, fetchConversations, markChatConversationAsRead, notificationSoundMuted])

  const startConversation = React.useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!supabase || !profile?.id || otherUserId === profile.id) return null
      const [userA, userB] = profile.id < otherUserId ? [profile.id, otherUserId] : [otherUserId, profile.id]
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_a_id", userA)
        .eq("user_b_id", userB)
        .maybeSingle()
      if (existing?.id) {
        await fetchMessages(existing.id)
        return existing.id
      }
      const { data: inserted, error } = await supabase
        .from("chat_conversations")
        .insert({ user_a_id: userA, user_b_id: userB })
        .select("id")
        .single()
      if (error || !inserted?.id) return null
      await fetchConversations()
      await fetchMessages(inserted.id)
      return inserted.id
    },
    [supabase, profile?.id, fetchConversations, fetchMessages]
  )

  const sendMessage = React.useCallback(
    async (
      conversationId: string,
      payload: {
        content?: string | null
        message_type?: ChatMessage["message_type"]
        file_path?: string | null
        file_name?: string | null
        is_priority?: boolean
      }
    ) => {
      if (!supabase || !profile?.id) return
      await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        content: payload.content ?? null,
        message_type: payload.message_type ?? "text",
        file_path: payload.file_path ?? null,
        file_name: payload.file_name ?? null,
        is_priority: payload.is_priority ?? false,
      })
      await fetchMessages(conversationId)
    },
    [supabase, profile?.id, fetchMessages]
  )

  const pinConversation = React.useCallback(
    async (conversationId: string) => {
      if (!supabase || !profile?.id) return
      await supabase.from("chat_pinned_conversations").upsert(
        { user_id: profile.id, conversation_id: conversationId },
        { onConflict: "user_id,conversation_id" }
      )
      setPinnedConversationIds((prev) => new Set([...prev, conversationId]))
    },
    [supabase, profile?.id]
  )

  const unpinConversation = React.useCallback(
    async (conversationId: string) => {
      if (!supabase || !profile?.id) return
      await supabase
        .from("chat_pinned_conversations")
        .delete()
        .eq("user_id", profile.id)
        .eq("conversation_id", conversationId)
      setPinnedConversationIds((prev) => {
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
    },
    [supabase, profile?.id]
  )

  const pinMessage = React.useCallback(
    async (messageId: string) => {
      if (!supabase || !profile?.id) return
      await supabase.from("chat_message_pins").upsert(
        { user_id: profile.id, message_id: messageId },
        { onConflict: "user_id,message_id" }
      )
      setPinnedMessageIds((prev) => new Set([...prev, messageId]))
    },
    [supabase, profile?.id]
  )

  const unpinMessage = React.useCallback(
    async (messageId: string) => {
      if (!supabase || !profile?.id) return
      await supabase
        .from("chat_message_pins")
        .delete()
        .eq("user_id", profile.id)
        .eq("message_id", messageId)
      setPinnedMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    },
    [supabase, profile?.id]
  )

  const deleteMessage = React.useCallback(
    async (conversationId: string, messageId: string) => {
      if (!supabase || !profile?.id) return
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", profile.id)
      if (error) return
      setMessagesByConversationId((prev) => {
        const list = prev[conversationId] ?? []
        return {
          ...prev,
          [conversationId]: list.filter((m) => m.id !== messageId),
        }
      })
      setPinnedMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    },
    [supabase, profile?.id]
  )

  const setTyping = React.useCallback(
    (conversationId: string, typing: boolean) => {
      if (!supabase || !profile?.id) return
      const channelKey = `${TYPING_CHANNEL_PREFIX}${conversationId}`
      let channel = channelsRef.current.get(channelKey)
      if (!channel) {
        channel = supabase.channel(channelKey)
        channelsRef.current.set(channelKey, channel)
        channel
          .on("presence", { event: "sync" }, () => {
            const state = channel!.presenceState<{ user_id: string; typing?: boolean }>()
            const userIds = Object.values(state)
              .flat()
              .filter((p) => p?.user_id && p.user_id !== profile.id && p.typing)
              .map((p) => p!.user_id)
            setTypingUserIdsByConversationId((prev) => ({
              ...prev,
              [conversationId]: userIds,
            }))
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await channel!.track({ user_id: profile.id, typing })
            }
          })
      }
      channel.track({ user_id: profile.id, typing })
    },
    [supabase, profile?.id]
  )

  const leaveTypingChannel = React.useCallback((conversationId: string) => {
    const channelKey = `${TYPING_CHANNEL_PREFIX}${conversationId}`
    const channel = channelsRef.current.get(channelKey)
    if (channel) {
      supabase?.removeChannel(channel)
      channelsRef.current.delete(channelKey)
    }
    setTypingUserIdsByConversationId((prev) => {
      const next = { ...prev }
      delete next[conversationId]
      return next
    })
  }, [supabase])

  const getAttachmentUrl = React.useCallback(
    async (path: string): Promise<string | null> => {
      if (!supabase) return null
      const { data } = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).createSignedUrl(path, 3600)
      return data?.signedUrl ?? null
    },
    [supabase]
  )

  const dismissPriorityMessage = React.useCallback(() => {
    const notificationId = priorityMessageRef.current?.notificationId
    setPriorityMessage(null)
    if (notificationId) void markNotificationAsRead(notificationId)
  }, [markNotificationAsRead])

  const value: ChatContextType = {
    conversations,
    pinnedConversationIds,
    messagesByConversationId,
    pinnedMessageIds,
    activeConversationId,
    setActiveConversationId,
    priorityMessage,
    dismissPriorityMessage,
    typingUserIdsByConversationId,
    isLoadingConversations,
    isLoadingMessages,
    refetchConversations: fetchConversations,
    refetchMessages: fetchMessages,
    loadMoreMessages,
    hasMoreOldMessages,
    isLoadingMoreMessages,
    startConversation,
    sendMessage,
    pinConversation,
    unpinConversation,
  pinMessage,
  unpinMessage,
  deleteMessage,
  setTyping,
  leaveTypingChannel,
  getAttachmentUrl,
}

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = React.useContext(ChatContext)
  if (ctx === undefined) throw new Error("useChat must be used within ChatProvider")
  return ctx
}
