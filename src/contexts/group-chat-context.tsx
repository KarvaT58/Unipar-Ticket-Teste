"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type {
  ChatGroup,
  ChatGroupWithPreview,
  ChatGroupMember,
  ChatGroupMessage,
} from "@/lib/chat/group-types"
import type { ChatMessageType } from "@/lib/chat/types"
import type { RealtimeChannel } from "@supabase/supabase-js"

const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"
const GROUP_TYPING_CHANNEL_PREFIX = "group-typing:"
const MESSAGES_PAGE_SIZE = 30

type GroupChatContextType = {
  groups: ChatGroupWithPreview[]
  activeGroupId: string | null
  setActiveGroupId: (id: string | null) => void
  membersByGroupId: Record<string, ChatGroupMember[]>
  messagesByGroupId: Record<string, ChatGroupMessage[]>
  isLoadingGroups: boolean
  isLoadingMessages: (groupId: string) => boolean
  refetchGroups: () => Promise<void>
  refetchMessages: (groupId: string) => Promise<void>
  refetchMembers: (groupId: string) => Promise<void>
  loadMoreMessages: (groupId: string) => Promise<void>
  hasMoreOldMessages: (groupId: string) => boolean
  isLoadingMoreMessages: (groupId: string) => boolean
  createGroup: (name: string | null, initialMemberIds: string[]) => Promise<string | null>
  updateGroup: (groupId: string, name: string | null) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  sendMessage: (
    groupId: string,
    payload: {
      content?: string | null
      message_type?: ChatMessageType
      file_path?: string | null
      file_name?: string | null
      is_priority?: boolean
    }
  ) => Promise<void>
  pinnedMessageIds: Set<string>
  pinMessage: (messageId: string) => Promise<void>
  unpinMessage: (messageId: string) => Promise<void>
  addMember: (groupId: string, userId: string) => Promise<void>
  removeMember: (groupId: string, userId: string) => Promise<void>
  setMemberRole: (groupId: string, userId: string, role: "admin" | "member") => Promise<void>
  setTyping: (groupId: string, typing: boolean) => void
  leaveTypingChannel: (groupId: string) => void
  typingUserIdsByGroupId: Record<string, string[]>
  getAttachmentUrl: (path: string) => Promise<string | null>
  canManageMembers: (group: ChatGroup) => boolean
  deleteMessage: (groupId: string, messageId: string) => Promise<void>
}

const GroupChatContext = React.createContext<GroupChatContextType | undefined>(undefined)

export function GroupChatProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { profile } = useAuth()
  const [groups, setGroups] = React.useState<ChatGroupWithPreview[]>([])
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(null)
  const [membersByGroupId, setMembersByGroupId] = React.useState<Record<string, ChatGroupMember[]>>({})
  const [messagesByGroupId, setMessagesByGroupId] = React.useState<Record<string, ChatGroupMessage[]>>({})
  const [hasMoreOldMessagesByGroupId, setHasMoreOldMessagesByGroupId] = React.useState<Record<string, boolean>>({})
  const [typingUserIdsByGroupId, setTypingUserIdsByGroupId] = React.useState<Record<string, string[]>>({})
  const [pinnedMessageIds, setPinnedMessageIds] = React.useState<Set<string>>(new Set())
  const [isLoadingGroups, setIsLoadingGroups] = React.useState(true)
  const loadingMessagesRef = React.useRef<Set<string>>(new Set())
  const loadingMoreRef = React.useRef<Set<string>>(new Set())
  const channelsRef = React.useRef<Map<string, RealtimeChannel>>(new Map())
  const messagesByGroupIdRef = React.useRef(messagesByGroupId)
  messagesByGroupIdRef.current = messagesByGroupId

  const fetchGroups = React.useCallback(async () => {
    if (!supabase || !profile?.id) {
      setGroups([])
      return
    }
    setIsLoadingGroups(true)
    try {
      const { data: groupRows, error: groupError } = await supabase
        .from("chat_groups")
        .select("id, name, created_by, created_at, last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })

      if (groupError || !groupRows?.length) {
        setGroups(groupRows ?? [])
        setIsLoadingGroups(false)
        return
      }

      const groupIds = groupRows.map((g) => g.id)
      const { data: lastMessages } = await supabase
        .from("chat_group_messages")
        .select("group_id, content, message_type")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })

      const lastByGroup = new Map<string, { content: string | null; message_type: string }>()
      for (const m of lastMessages ?? []) {
        if (m.group_id && !lastByGroup.has(m.group_id)) {
          lastByGroup.set(m.group_id, {
            content: m.content ?? null,
            message_type: m.message_type ?? "text",
          })
        }
      }

      const withPreview: ChatGroupWithPreview[] = groupRows.map((g) => {
        const last = lastByGroup.get(g.id)
        return {
          ...g,
          last_message_preview: last?.message_type === "text" ? last.content : last ? `[${last.message_type}]` : null,
        }
      })
      setGroups(withPreview)
    } finally {
      setIsLoadingGroups(false)
    }
  }, [supabase, profile?.id])

  const fetchMembers = React.useCallback(
    async (groupId: string) => {
      if (!supabase || !profile?.id) return
      const { data: memberRows, error } = await supabase
        .from("chat_group_members")
        .select("group_id, user_id, role, joined_at")
        .eq("group_id", groupId)

      if (error) return

      const userIds = (memberRows ?? []).map((m) => m.user_id)
      if (userIds.length === 0) {
        setMembersByGroupId((prev) => ({ ...prev, [groupId]: [] }))
        return
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds)

      const profileMap = new Map(
        (profilesData ?? []).map((p) => [p.id, { name: p.name ?? "", avatar_url: p.avatar_url ?? null }])
      )

      const members: ChatGroupMember[] = (memberRows ?? []).map((m) => {
        const p = profileMap.get(m.user_id)
        return {
          ...m,
          name: p?.name,
          avatar_url: p?.avatar_url,
        }
      })
      setMembersByGroupId((prev) => ({ ...prev, [groupId]: members }))
    },
    [supabase, profile?.id]
  )

  const fetchMessages = React.useCallback(
    async (groupId: string) => {
      if (!supabase || !profile?.id) return
      loadingMessagesRef.current.add(groupId)
      try {
        const { data, error } = await supabase
          .from("chat_group_messages")
          .select("id, group_id, sender_id, content, message_type, file_path, file_name, is_priority, created_at")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PAGE_SIZE)
        if (error) return
        const list = (data ?? []) as ChatGroupMessage[]
        list.reverse()
        setMessagesByGroupId((prev) => ({ ...prev, [groupId]: list }))
        setHasMoreOldMessagesByGroupId((prev) => ({
          ...prev,
          [groupId]: list.length === MESSAGES_PAGE_SIZE,
        }))
      } finally {
        loadingMessagesRef.current.delete(groupId)
      }
    },
    [supabase, profile?.id]
  )

  const loadMoreMessages = React.useCallback(
    async (groupId: string) => {
      if (!supabase || !profile?.id) return
      const current = messagesByGroupIdRef.current[groupId] ?? []
      if (current.length === 0) return
      const oldest = current[0]
      if (loadingMoreRef.current.has(groupId)) return
      const hasMore = hasMoreOldMessagesByGroupId[groupId]
      if (!hasMore) return
      loadingMoreRef.current.add(groupId)
      try {
        const { data, error } = await supabase
          .from("chat_group_messages")
          .select("id, group_id, sender_id, content, message_type, file_path, file_name, is_priority, created_at")
          .eq("group_id", groupId)
          .lt("created_at", oldest.created_at)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PAGE_SIZE)
        if (error) return
        const older = (data ?? []) as ChatGroupMessage[]
        older.reverse()
        setMessagesByGroupId((prev) => {
          const list = prev[groupId] ?? []
          const merged = [...older, ...list]
          return { ...prev, [groupId]: merged }
        })
        setHasMoreOldMessagesByGroupId((prev) => ({
          ...prev,
          [groupId]: older.length === MESSAGES_PAGE_SIZE,
        }))
      } finally {
        loadingMoreRef.current.delete(groupId)
      }
    },
    [supabase, profile?.id, hasMoreOldMessagesByGroupId]
  )

  const hasMoreOldMessages = React.useCallback((groupId: string) => {
    return hasMoreOldMessagesByGroupId[groupId] === true
  }, [hasMoreOldMessagesByGroupId])

  const isLoadingMoreMessages = React.useCallback((groupId: string) => {
    return loadingMoreRef.current.has(groupId)
  }, [])

  const isLoadingMessages = React.useCallback((groupId: string) => {
    return loadingMessagesRef.current.has(groupId)
  }, [])

  const fetchPinnedMessageIds = React.useCallback(async () => {
    if (!supabase || !profile?.id) return
    const { data } = await supabase
      .from("chat_message_pins")
      .select("message_id")
      .eq("user_id", profile.id)
    setPinnedMessageIds(new Set((data ?? []).map((r) => r.message_id)))
  }, [supabase, profile?.id])

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

  React.useEffect(() => {
    if (!profile?.id) {
      setGroups([])
      setIsLoadingGroups(false)
      return
    }
    fetchGroups()
    fetchPinnedMessageIds()
  }, [profile?.id, fetchGroups, fetchPinnedMessageIds])

  React.useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("chat-group-messages-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_group_messages" },
        (payload) => {
          const row = payload.new as ChatGroupMessage
          setMessagesByGroupId((prev) => {
            const list = prev[row.group_id] ?? []
            if (list.some((m) => m.id === row.id)) return prev
            return { ...prev, [row.group_id]: [...list, row] }
          })
          setGroups((prev) => {
            const g = prev.find((x) => x.id === row.group_id)
            if (!g) return prev
            const preview = row.message_type === "text" ? row.content : `[${row.message_type}]`
            return prev
              .map((x) =>
                x.id === row.group_id
                  ? { ...x, last_message_at: row.created_at, last_message_preview: preview }
                  : x
              )
              .sort((a, b) => {
                const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                return timeB - timeA
              })
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id])

  const createGroup = React.useCallback(
    async (name: string | null, initialMemberIds: string[]): Promise<string | null> => {
      if (!supabase || !profile?.id) return null
      const { data: group, error: groupError } = await supabase
        .from("chat_groups")
        .insert({ name: name ?? null, created_by: profile.id })
        .select("id")
        .single()
      if (groupError || !group?.id) return null

      const membersToInsert: { group_id: string; user_id: string; role: string }[] = [
        { group_id: group.id, user_id: profile.id, role: "admin" },
        ...initialMemberIds.filter((id) => id !== profile.id).map((id) => ({ group_id: group.id, user_id: id, role: "member" })),
      ]
      const { error: membersError } = await supabase.from("chat_group_members").insert(membersToInsert)
      if (membersError) return null

      await fetchGroups()
      await fetchMessages(group.id)
      await fetchMembers(group.id)
      setActiveGroupId(group.id)
      return group.id
    },
    [supabase, profile?.id, fetchGroups, fetchMessages, fetchMembers]
  )

  const canManageMembers = React.useCallback(
    (group: ChatGroup): boolean => {
      if (!profile?.id) return false
      if (group.created_by === profile.id) return true
      const members = membersByGroupId[group.id] ?? []
      const me = members.find((m) => m.user_id === profile.id)
      return me?.role === "admin"
    },
    [profile?.id, membersByGroupId]
  )

  const updateGroup = React.useCallback(
    async (groupId: string, name: string | null) => {
      if (!supabase || !profile?.id) return
      const group = groups.find((g) => g.id === groupId)
      if (!group || !canManageMembers(group)) return
      await supabase.from("chat_groups").update({ name }).eq("id", groupId)
      await fetchGroups()
    },
    [supabase, profile?.id, groups, canManageMembers, fetchGroups]
  )

  const deleteGroup = React.useCallback(
    async (groupId: string) => {
      if (!supabase || !profile?.id) return
      const group = groups.find((g) => g.id === groupId)
      if (!group || !canManageMembers(group)) return
      await supabase.from("chat_group_messages").delete().eq("group_id", groupId)
      await supabase.from("chat_group_members").delete().eq("group_id", groupId)
      await supabase.from("chat_groups").delete().eq("id", groupId)
      setMessagesByGroupId((prev) => {
        const next = { ...prev }
        delete next[groupId]
        return next
      })
      setMembersByGroupId((prev) => {
        const next = { ...prev }
        delete next[groupId]
        return next
      })
      if (activeGroupId === groupId) setActiveGroupId(null)
      await fetchGroups()
    },
    [supabase, profile?.id, groups, canManageMembers, activeGroupId, fetchGroups]
  )

  const sendMessage = React.useCallback(
    async (
      groupId: string,
      payload: {
        content?: string | null
        message_type?: ChatMessageType
        file_path?: string | null
        file_name?: string | null
        is_priority?: boolean
      }
    ) => {
      if (!supabase || !profile?.id) return
      await supabase.from("chat_group_messages").insert({
        group_id: groupId,
        sender_id: profile.id,
        content: payload.content ?? null,
        message_type: payload.message_type ?? "text",
        file_path: payload.file_path ?? null,
        file_name: payload.file_name ?? null,
        is_priority: false,
      })
      await fetchMessages(groupId)
    },
    [supabase, profile?.id, fetchMessages]
  )

  const addMember = React.useCallback(
    async (groupId: string, userId: string) => {
      if (!supabase || !profile?.id) return
      await supabase.from("chat_group_members").insert({
        group_id: groupId,
        user_id: userId,
        role: "member",
      })
      await fetchMembers(groupId)
    },
    [supabase, profile?.id, fetchMembers]
  )

  const removeMember = React.useCallback(
    async (groupId: string, userId: string) => {
      if (!supabase || !profile?.id) return
      await supabase.from("chat_group_members").delete().eq("group_id", groupId).eq("user_id", userId)
      await fetchMembers(groupId)
    },
    [supabase, profile?.id, fetchMembers]
  )

  const setMemberRole = React.useCallback(
    async (groupId: string, userId: string, role: "admin" | "member") => {
      if (!supabase || !profile?.id) return
      await supabase
        .from("chat_group_members")
        .update({ role })
        .eq("group_id", groupId)
        .eq("user_id", userId)
      await fetchMembers(groupId)
    },
    [supabase, profile?.id, fetchMembers]
  )

  const setTyping = React.useCallback(
    (groupId: string, typing: boolean) => {
      if (!supabase || !profile?.id) return
      const channelKey = `${GROUP_TYPING_CHANNEL_PREFIX}${groupId}`
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
            setTypingUserIdsByGroupId((prev) => ({ ...prev, [groupId]: userIds }))
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

  const leaveTypingChannel = React.useCallback((groupId: string) => {
    const channelKey = `${GROUP_TYPING_CHANNEL_PREFIX}${groupId}`
    const channel = channelsRef.current.get(channelKey)
    if (channel) {
      supabase?.removeChannel(channel)
      channelsRef.current.delete(channelKey)
    }
    setTypingUserIdsByGroupId((prev) => {
      const next = { ...prev }
      delete next[groupId]
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

  const deleteMessage = React.useCallback(
    async (groupId: string, messageId: string) => {
      if (!supabase || !profile?.id) return
      await supabase
        .from("chat_group_messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", profile.id)
      setMessagesByGroupId((prev) => {
        const list = prev[groupId] ?? []
        return { ...prev, [groupId]: list.filter((m) => m.id !== messageId) }
      })
      setPinnedMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    },
    [supabase, profile?.id]
  )

  const value: GroupChatContextType = {
    groups,
    activeGroupId,
    setActiveGroupId,
    membersByGroupId,
    messagesByGroupId,
    isLoadingGroups,
    isLoadingMessages,
    refetchGroups: fetchGroups,
    refetchMessages: fetchMessages,
    refetchMembers: fetchMembers,
    loadMoreMessages,
    hasMoreOldMessages,
    isLoadingMoreMessages,
    createGroup,
    updateGroup,
    deleteGroup,
    sendMessage,
    pinnedMessageIds,
    pinMessage,
    unpinMessage,
    addMember,
    removeMember,
    setMemberRole,
    setTyping,
    leaveTypingChannel,
    typingUserIdsByGroupId,
    getAttachmentUrl,
    canManageMembers,
    deleteMessage,
  }

  return <GroupChatContext.Provider value={value}>{children}</GroupChatContext.Provider>
}

export function useGroupChat() {
  const ctx = React.useContext(GroupChatContext)
  if (ctx === undefined) throw new Error("useGroupChat must be used within GroupChatProvider")
  return ctx
}
