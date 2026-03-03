"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useChat } from "@/contexts/chat-context"
import { usePresence } from "@/contexts/presence-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { IconArrowLeft } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MessageBubble } from "./message-bubble"
import { MessageInput } from "./message-input"
import { toast } from "sonner"
import type { ChatConversationWithPeer } from "@/lib/chat/types"

const MAX_PINNED_MESSAGES = 3

type ConversationViewProps = {
  conversation: ChatConversationWithPeer | null
}

export function ConversationView({ conversation }: ConversationViewProps) {
  const { profile } = useAuth()
  const { onlineUserIds } = usePresence()
  const {
    messagesByConversationId,
    pinnedMessageIds,
    typingUserIdsByConversationId,
    refetchMessages,
    loadMoreMessages,
    hasMoreOldMessages,
    isLoadingMoreMessages,
    sendMessage,
    pinMessage,
    unpinMessage,
    deleteMessage,
    setTyping,
    leaveTypingChannel,
    getAttachmentUrl,
    isLoadingMessages,
    setActiveConversationId,
  } = useChat()
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const loadMoreRequestedRef = React.useRef(false)
  const savedScrollRef = React.useRef<{ height: number; top: number }>({ height: 0, top: 0 })
  const skipScrollToEndRef = React.useRef(false)
  const prevMessagesLengthRef = React.useRef(0)
  const [deleteTarget, setDeleteTarget] = React.useState<{ conversationId: string; messageId: string } | null>(null)

  const messages = conversation ? messagesByConversationId[conversation.id] ?? [] : []
  const typingUserIds = conversation ? typingUserIdsByConversationId[conversation.id] ?? [] : []
  const pinnedInConversation = conversation
    ? messages.filter((m) => pinnedMessageIds.has(m.id))
    : []

  const scrollToPinnedMessage = React.useCallback((messageId: string) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  React.useEffect(() => {
    if (!conversation?.id) return
    prevMessagesLengthRef.current = 0
    refetchMessages(conversation.id)
    setTyping(conversation.id, false)
    return () => leaveTypingChannel(conversation.id)
  }, [conversation?.id, refetchMessages, setTyping, leaveTypingChannel])

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!conversation || !hasMoreOldMessages(conversation.id) || isLoadingMoreMessages(conversation.id)) return
      const el = e.currentTarget
      if (el.scrollTop < 80) {
        loadMoreRequestedRef.current = true
        savedScrollRef.current = { height: el.scrollHeight, top: el.scrollTop }
        void loadMoreMessages(conversation.id)
      }
    },
    [conversation, hasMoreOldMessages, isLoadingMoreMessages, loadMoreMessages]
  )

  React.useLayoutEffect(() => {
    if (!conversation || !loadMoreRequestedRef.current || !scrollContainerRef.current) return
    const list = messagesByConversationId[conversation.id] ?? []
    if (list.length <= prevMessagesLengthRef.current) return
    const container = scrollContainerRef.current
    const { height, top } = savedScrollRef.current
    const newHeight = container.scrollHeight
    container.scrollTop = top + (newHeight - height)
    loadMoreRequestedRef.current = false
    skipScrollToEndRef.current = true
    prevMessagesLengthRef.current = list.length
  }, [conversation?.id, messagesByConversationId])

  React.useEffect(() => {
    if (!conversation) return
    const list = messagesByConversationId[conversation.id] ?? []
    if (skipScrollToEndRef.current) {
      skipScrollToEndRef.current = false
      return
    }
    if (list.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = list.length
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [conversation?.id, messagesByConversationId])

  if (!conversation) {
    return (
      <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-muted-foreground md:flex">
        <p className="text-sm">Selecione uma conversa ou inicie uma nova.</p>
      </div>
    )
  }

  const loading = isLoadingMessages(conversation.id)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => setActiveConversationId(null)}
          aria-label="Voltar"
        >
          <IconArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-9 shrink-0 md:size-10">
          <AvatarImage src={conversation.other_avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {conversation.other_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{conversation.other_name}</p>
          <p className="text-xs text-muted-foreground">
            {onlineUserIds.has(conversation.other_id) ? "Online" : "Offline"}
          </p>
        </div>
      </header>

      {pinnedInConversation.length > 0 && (
        <div className="shrink-0 border-b bg-muted/20 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Mensagens fixadas</p>
          <ul className="mt-1 space-y-0.5">
            {pinnedInConversation.slice(0, MAX_PINNED_MESSAGES).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-xs">{m.content || "[Anexo]"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-xs"
                  onClick={() => scrollToPinnedMessage(m.id)}
                >
                  Ver
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4"
        onScroll={handleScroll}
      >
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Carregando mensagens...</p>
        ) : (
          <>
            {hasMoreOldMessages(conversation.id) && (
              <div className="flex justify-center py-2">
                {isLoadingMoreMessages(conversation.id) ? (
                  <p className="text-xs text-muted-foreground">Carregando mensagens antigas...</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Role para cima para carregar mais</p>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                id={`msg-${msg.id}`}
                message={msg}
                senderName={
                  msg.sender_id === profile?.id ? profile?.name ?? "Você" : conversation.other_name
                }
                isOwn={msg.sender_id === profile?.id}
                isPinned={pinnedMessageIds.has(msg.id)}
                canPin={pinnedMessageIds.has(msg.id) || pinnedInConversation.length < MAX_PINNED_MESSAGES}
                onTogglePin={() => {
                  if (pinnedMessageIds.has(msg.id)) {
                    unpinMessage(msg.id)
                  } else if (pinnedInConversation.length >= MAX_PINNED_MESSAGES) {
                    toast.error("Máximo de 3 mensagens fixadas. Desfixe uma para fixar outra.")
                  } else {
                    pinMessage(msg.id)
                  }
                }}
                onDelete={
                  msg.sender_id === profile?.id
                    ? () => setDeleteTarget({ conversationId: conversation.id, messageId: msg.id })
                    : undefined
                }
                getAttachmentUrl={getAttachmentUrl}
              />
            ))}
            <li>
              <div ref={messagesEndRef} aria-hidden />
            </li>
          </ul>
          </>
        )}
      </div>

      {typingUserIds.length > 0 && typingUserIds.includes(conversation.other_id) && (
        <div className="shrink-0 px-4 pb-1 text-xs text-muted-foreground">
          {conversation.other_name} está digitando...
        </div>
      )}

      <MessageInput
        conversationId={conversation.id}
        disabled={loading}
        onTyping={(typing) => setTyping(conversation.id, typing)}
        onSend={sendMessage}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void deleteMessage(deleteTarget.conversationId, deleteTarget.messageId)
                setDeleteTarget(null)
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
