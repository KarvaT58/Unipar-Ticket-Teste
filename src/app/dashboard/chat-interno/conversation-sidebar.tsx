"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useChat } from "@/contexts/chat-context"
import { useNotifications } from "@/contexts/notification-context"
import { usePresence } from "@/contexts/presence-context"
import { IconPin, IconPinFilled, IconPlus } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ChatConversationWithPeer } from "@/lib/chat/types"

export function ConversationSidebar() {
  const supabase = createClient()
  const { profile } = useAuth()
  const {
    conversations,
    pinnedConversationIds,
    activeConversationId,
    setActiveConversationId,
    startConversation,
    pinConversation,
    unpinConversation,
    refetchConversations,
    isLoadingConversations,
  } = useChat()
  const { onlineUserIds } = usePresence()
  const { unreadByChatConversationId, markChatConversationAsRead } = useNotifications()
  const [search, setSearch] = React.useState("")
  const [startOpen, setStartOpen] = React.useState(false)
  const [teamSearch, setTeamSearch] = React.useState("")
  const [teamUsers, setTeamUsers] = React.useState<Array<{ id: string; name: string; avatar_url: string | null; department: string }>>([])
  const [startingWith, setStartingWith] = React.useState<string | null>(null)

  const filteredTeamUsers = React.useMemo(() => {
    const term = teamSearch.trim().toLowerCase()
    const list = term
      ? teamUsers.filter((u) => u.name.toLowerCase().includes(term))
      : [...teamUsers]
    return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [teamUsers, teamSearch])

  const filteredConversations = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = term
      ? conversations.filter(
          (c) =>
            c.other_name.toLowerCase().includes(term) ||
            c.other_id.toLowerCase().includes(term)
        )
      : [...conversations]
    return list.sort((a, b) => {
      const pinA = pinnedConversationIds.has(a.id)
      const pinB = pinnedConversationIds.has(b.id)
      if (pinA && !pinB) return -1
      if (!pinA && pinB) return 1
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return timeB - timeA
    })
  }, [conversations, pinnedConversationIds, search])

  React.useEffect(() => {
    if (!startOpen || !supabase || !profile?.id) return
    let cancelled = false
    supabase
      .from("profiles")
      .select("id, name, avatar_url, department")
      .neq("id", profile.id)
      .then(({ data }) => {
        if (!cancelled && data) setTeamUsers(data)
      })
    return () => { cancelled = true }
  }, [startOpen, supabase, profile?.id])

  const handleStartWith = React.useCallback(
    async (userId: string) => {
      if (!userId || startingWith === userId) return
      setStartingWith(userId)
      try {
        const id = await startConversation(userId)
        if (id) {
          setActiveConversationId(id)
          setStartOpen(false)
        }
      } finally {
        setStartingWith(null)
      }
    },
    [startConversation, setActiveConversationId]
  )

  const togglePin = React.useCallback(
    async (e: React.MouseEvent, conversationId: string) => {
      e.stopPropagation()
      if (pinnedConversationIds.has(conversationId)) {
        await unpinConversation(conversationId)
      } else {
        await pinConversation(conversationId)
      }
    },
    [pinnedConversationIds, pinConversation, unpinConversation]
  )

  return (
    <>
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30",
          "w-full md:w-72",
          activeConversationId ? "hidden md:flex" : "flex"
        )}
      >
        <div className="flex items-center gap-2 border-b p-2">
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <Button
            variant="outline"
            className="mb-2 w-full"
            onClick={() => setStartOpen(true)}
          >
            <IconPlus className="mr-2 size-4" />
            Iniciar conversa
          </Button>
          {isLoadingConversations ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : filteredConversations.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={activeConversationId === conv.id}
                  isPinned={pinnedConversationIds.has(conv.id)}
                  isOnline={onlineUserIds.has(conv.other_id)}
                  unreadCount={unreadByChatConversationId[conv.id] ?? 0}
                  onSelect={() => {
                    void markChatConversationAsRead(conv.id)
                    setActiveConversationId(conv.id)
                  }}
                  onTogglePin={(e) => togglePin(e, conv.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog
        open={startOpen}
        onOpenChange={(open) => {
          setStartOpen(open)
          if (!open) setTeamSearch("")
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-sm overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Escolher pessoa</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar por nome..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="h-9 shrink-0"
          />
          <div
            className="min-h-0 shrink overflow-y-auto"
            style={{ maxHeight: "29rem" }}
          >
            {teamUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : filteredTeamUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>
            ) : (
              <ul className="space-y-1 pr-1">
                {filteredTeamUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                      onClick={() => handleStartWith(user.id)}
                      disabled={startingWith !== null}
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.department}</p>
                      </div>
                      {startingWith === user.id && (
                        <span className="text-xs text-muted-foreground">Abrindo...</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConversationItem({
  conv,
  isActive,
  isPinned,
  isOnline,
  unreadCount,
  onSelect,
  onTogglePin,
}: {
  conv: ChatConversationWithPeer
  isActive: boolean
  isPinned: boolean
  isOnline: boolean
  unreadCount: number
  onSelect: () => void
  onTogglePin: (e: React.MouseEvent) => void
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect()
          }
        }}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left transition-colors ${
          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
        } ${unreadCount > 0 && !isActive ? "font-medium" : ""}`}
      >
        <div className="relative shrink-0">
          <Avatar className="size-10">
            <AvatarImage src={conv.other_avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {conv.other_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span
              className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-green-500"
              title="Online"
            />
          )}
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
              title={`${unreadCount} não lida(s)`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{conv.other_name}</p>
          {conv.last_message_preview && (
            <p className="truncate text-xs text-muted-foreground">{conv.last_message_preview}</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(e)
          }}
          className="shrink-0 rounded p-1 hover:bg-muted"
          title={isPinned ? "Desfixar" : "Fixar"}
        >
          {isPinned ? (
            <IconPinFilled className="size-4 text-primary" />
          ) : (
            <IconPin className="size-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </li>
  )
}
