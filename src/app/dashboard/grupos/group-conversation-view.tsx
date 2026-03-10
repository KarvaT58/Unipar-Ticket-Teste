"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useGroupChat } from "@/contexts/group-chat-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { IconArrowLeft, IconUsers, IconDotsVertical, IconPencil, IconTrash, IconPlus } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MessageBubble } from "@/app/dashboard/chat-interno/message-bubble"
import { MessageInput } from "@/app/dashboard/chat-interno/message-input"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { ChatGroup, ChatGroupMember } from "@/lib/chat/group-types"
import type { ChatMessage } from "@/lib/chat/types"

const MAX_PINNED_MESSAGES = 3

type GroupConversationViewProps = {
  group: ChatGroup | null
  onOpenCreateGroup?: () => void
}

export function GroupConversationView({ group, onOpenCreateGroup }: GroupConversationViewProps) {
  const supabase = createClient()
  const { profile } = useAuth()
  const {
    membersByGroupId,
    messagesByGroupId,
    typingUserIdsByGroupId,
    refetchMessages,
    refetchMembers,
    loadMoreMessages,
    hasMoreOldMessages,
    isLoadingMoreMessages,
    sendMessage,
    setTyping,
    leaveTypingChannel,
    getAttachmentUrl,
    isLoadingMessages,
    setActiveGroupId,
    addMember,
    removeMember,
    setMemberRole,
    canManageMembers,
    deleteMessage,
    pinnedMessageIds,
    pinMessage,
    unpinMessage,
    editMessage,
    updateGroup,
    deleteGroup,
  } = useGroupChat()

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const loadMoreRequestedRef = React.useRef(false)
  const savedScrollRef = React.useRef<{ height: number; top: number }>({ height: 0, top: 0 })
  const skipScrollToEndRef = React.useRef(false)
  const prevMessagesLengthRef = React.useRef(0)

  const [membersOpen, setMembersOpen] = React.useState(false)
  const [addMemberOpen, setAddMemberOpen] = React.useState(false)
  const [teamSearch, setTeamSearch] = React.useState("")
  const [teamUsers, setTeamUsers] = React.useState<
    Array<{ id: string; name: string; avatar_url: string | null; department: string | null }>
  >([])
  const [deleteTarget, setDeleteTarget] = React.useState<{ groupId: string; messageId: string } | null>(null)
  const [editTarget, setEditTarget] = React.useState<{ groupId: string; messageId: string; content: string } | null>(null)
  const [removeMemberTarget, setRemoveMemberTarget] = React.useState<{ groupId: string; userId: string; name: string } | null>(null)
  const [editGroupOpen, setEditGroupOpen] = React.useState(false)
  const [editGroupName, setEditGroupName] = React.useState("")
  const [deleteGroupTarget, setDeleteGroupTarget] = React.useState<ChatGroup | null>(null)
  const [savingGroup, setSavingGroup] = React.useState(false)
  const [isLoadingMembersDialog, setIsLoadingMembersDialog] = React.useState(false)

  const messages = group ? messagesByGroupId[group.id] ?? [] : []
  const members = group ? membersByGroupId[group.id] ?? [] : []
  const typingUserIds = group ? typingUserIdsByGroupId[group.id] ?? [] : []
  const memberNames = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members) {
      map.set(m.user_id, m.name ?? "Usuário")
    }
    return map
  }, [members])

  const pinnedInConversation = group
    ? messages.filter((m) => pinnedMessageIds.has(m.id))
    : []

  const scrollToPinnedMessage = React.useCallback((messageId: string) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  React.useEffect(() => {
    if (!group?.id) return
    prevMessagesLengthRef.current = 0
    refetchMessages(group.id)
    refetchMembers(group.id)
    setTyping(group.id, false)
    return () => leaveTypingChannel(group.id)
  }, [group?.id, refetchMessages, refetchMembers, setTyping, leaveTypingChannel])

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!group || !hasMoreOldMessages(group.id) || isLoadingMoreMessages(group.id)) return
      const el = e.currentTarget
      if (el.scrollTop < 80) {
        loadMoreRequestedRef.current = true
        savedScrollRef.current = { height: el.scrollHeight, top: el.scrollTop }
        void loadMoreMessages(group.id)
      }
    },
    [group, hasMoreOldMessages, isLoadingMoreMessages, loadMoreMessages]
  )

  React.useLayoutEffect(() => {
    if (!group || !loadMoreRequestedRef.current || !scrollContainerRef.current) return
    const list = messagesByGroupId[group.id] ?? []
    if (list.length <= prevMessagesLengthRef.current) return
    const container = scrollContainerRef.current
    const { height, top } = savedScrollRef.current
    const newHeight = container.scrollHeight
    container.scrollTop = top + (newHeight - height)
    loadMoreRequestedRef.current = false
    skipScrollToEndRef.current = true
    prevMessagesLengthRef.current = list.length
  }, [group?.id, messagesByGroupId])

  React.useEffect(() => {
    if (!group) return
    const list = messagesByGroupId[group.id] ?? []
    if (skipScrollToEndRef.current) {
      skipScrollToEndRef.current = false
      return
    }
    if (list.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = list.length
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [group?.id, messagesByGroupId])

  React.useEffect(() => {
    if (!addMemberOpen || !supabase || !profile?.id) return
    let cancelled = false
    const existingIds = new Set(members.map((m) => m.user_id))
    supabase
      .from("profiles")
      .select("id, name, avatar_url, department")
      .neq("id", profile.id)
      .then(({ data }) => {
        if (!cancelled && data) {
          setTeamUsers(data.filter((u) => !existingIds.has(u.id)))
        }
      })
    return () => {
      cancelled = true
    }
  }, [addMemberOpen, supabase, profile?.id, members])

  const filteredTeamUsers = React.useMemo(() => {
    const term = teamSearch.trim().toLowerCase()
    const list = term ? teamUsers.filter((u) => u.name.toLowerCase().includes(term)) : [...teamUsers]
    return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [teamUsers, teamSearch])

  const canManage = group ? canManageMembers(group) : false
  const loading = group ? isLoadingMessages(group.id) : false
  const groupDisplayName = group?.name || "Sem nome"

  const handleOpenMembers = React.useCallback(() => {
    if (!group?.id) return
    setMembersOpen(true)
    setIsLoadingMembersDialog(true)
    refetchMembers(group.id).finally(() => setIsLoadingMembersDialog(false))
  }, [group?.id, refetchMembers])

  const handleOpenAddMember = React.useCallback(() => {
    setMembersOpen(false)
    setAddMemberOpen(true)
  }, [])

  if (!group) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 md:flex">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border bg-muted/30 p-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <IconUsers className="size-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Selecione um grupo ou crie um novo</p>
            <p className="text-sm text-muted-foreground">
              Escolha um grupo na lista ou crie um novo para começar a conversar.
            </p>
          </div>
          <Button
            variant="default"
            className="w-full"
            onClick={() => onOpenCreateGroup?.()}
          >
            <IconPlus className="mr-2 size-4" />
            Criar grupo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => setActiveGroupId(null)}
          aria-label="Voltar"
        >
          <IconArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-9 shrink-0 md:size-10">
          <AvatarFallback className="text-xs">{groupDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{groupDisplayName}</p>
          <p className="text-xs text-muted-foreground">{members.length} membro(s)</p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Opções do grupo"
              >
                <IconDotsVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenMembers}>
                <IconUsers className="mr-2 size-4" />
                Ver membros
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditGroupName(group.name ?? "")
                  setEditGroupOpen(true)
                }}
              >
                <IconPencil className="mr-2 size-4" />
                Editar grupo
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteGroupTarget(group)}
              >
                <IconTrash className="mr-2 size-4" />
                Apagar grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!canManage && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleOpenMembers}
            aria-label="Membros"
          >
            <IconUsers className="size-5" />
          </Button>
        )}
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
            {hasMoreOldMessages(group.id) && (
              <div className="flex justify-center py-2">
                {isLoadingMoreMessages(group.id) ? (
                  <p className="text-xs text-muted-foreground">Carregando mensagens antigas...</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Role para cima para carregar mais</p>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {messages.map((msg) => {
                const messageForBubble: ChatMessage = {
                  ...msg,
                  conversation_id: msg.group_id,
                  is_priority: false,
                }
                const senderName = msg.sender_id === profile?.id ? profile?.name ?? "Você" : memberNames.get(msg.sender_id) ?? "Usuário"
                return (
                  <MessageBubble
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    message={messageForBubble}
                    senderName={senderName}
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
                        ? () => setDeleteTarget({ groupId: group.id, messageId: msg.id })
                        : undefined
                    }
                    onEdit={
                      msg.sender_id === profile?.id &&
                      msg.message_type === "text" &&
                      !msg.deleted_at
                        ? () => setEditTarget({ groupId: group.id, messageId: msg.id, content: msg.content ?? "" })
                        : undefined
                    }
                    getAttachmentUrl={getAttachmentUrl}
                  />
                )
              })}
              <li>
                <div ref={messagesEndRef} aria-hidden />
              </li>
            </ul>
          </>
        )}
      </div>

      {typingUserIds.length > 0 && (
        <div className="shrink-0 px-4 pb-1 text-xs text-muted-foreground">
          Algum membro está digitando...
        </div>
      )}

      <MessageInput
        conversationId={group.id}
        uploadPathPrefix="groups"
        showPriority={false}
        disabled={loading}
        onTyping={(typing) => setTyping(group.id, typing)}
        onSend={(_, payload) => sendMessage(group.id, payload)}
      />

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-sm flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Membros do grupo</DialogTitle>
          </DialogHeader>
          {canManage && (
            <Button
              variant="outline"
              className="shrink-0"
              onClick={handleOpenAddMember}
            >
              Adicionar pessoa
            </Button>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: "24rem" }}>
            {isLoadingMembersDialog ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando membros...</p>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum membro no grupo.</p>
            ) : (
              <ul className="space-y-2 pr-1">
                {members.map((m) => (
                  <MemberRow
                    key={m.user_id}
                    member={m}
                    isCreator={group.created_by === m.user_id}
                    canManage={Boolean(canManage)}
                    onRemove={() =>
                      setRemoveMemberTarget({
                        groupId: group.id,
                        userId: m.user_id,
                        name: m.name ?? "Usuário",
                      })
                    }
                    onSetAdmin={() => setMemberRole(group.id, m.user_id, "admin")}
                    onRemoveAdmin={() => setMemberRole(group.id, m.user_id, "member")}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-sm flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Adicionar pessoa</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar por nome..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="h-9 shrink-0"
          />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ maxHeight: "24rem" }}>
            {filteredTeamUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {teamUsers.length === 0 ? "Carregando..." : "Nenhuma pessoa encontrada."}
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredTeamUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                      onClick={async () => {
                        await addMember(group.id, user.id)
                        setAddMemberOpen(false)
                        setTeamSearch("")
                      }}
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{user.name}</p>
                        {user.department && (
                          <p className="truncate text-xs text-muted-foreground">{user.department}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                if (deleteTarget) void deleteMessage(deleteTarget.groupId, deleteTarget.messageId)
                setDeleteTarget(null)
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <Textarea
              value={editTarget.content}
              onChange={(e) => setEditTarget((prev) => prev ? { ...prev, content: e.target.value } : null)}
              placeholder="Texto da mensagem"
              className="min-h-24"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editTarget && editTarget.content.trim()) {
                  void editMessage(editTarget.groupId, editTarget.messageId, editTarget.content.trim())
                  setEditTarget(null)
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeMemberTarget} onOpenChange={(open) => { if (!open) setRemoveMemberTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {removeMemberTarget?.name} do grupo? Essa pessoa não poderá mais ver as mensagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveMemberTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (removeMemberTarget) {
                  await removeMember(removeMemberTarget.groupId, removeMemberTarget.userId)
                  setRemoveMemberTarget(null)
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do grupo"
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
            className="h-9"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={savingGroup}
              onClick={async () => {
                if (!group || savingGroup) return
                setSavingGroup(true)
                try {
                  await updateGroup(group.id, editGroupName.trim() || null)
                  setEditGroupOpen(false)
                } finally {
                  setSavingGroup(false)
                }
              }}
            >
              {savingGroup ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => { if (!open) setDeleteGroupTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar o grupo &quot;{deleteGroupTarget?.name || "Sem nome"}&quot;? Todas as mensagens e membros serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteGroupTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteGroupTarget) {
                  await deleteGroup(deleteGroupTarget.id)
                  setDeleteGroupTarget(null)
                }
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

function MemberRow({
  member,
  isCreator,
  canManage,
  onRemove,
  onSetAdmin,
  onRemoveAdmin,
}: {
  member: ChatGroupMember
  isCreator: boolean
  canManage: boolean
  onRemove: () => void
  onSetAdmin: () => void
  onRemoveAdmin: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={member.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {(member.name ?? "U").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{member.name ?? "Usuário"}</p>
          <p className="text-xs text-muted-foreground">
            {isCreator ? "Criador" : member.role === "admin" ? "Admin" : "Membro"}
          </p>
        </div>
      </div>
      {canManage && !isCreator && (
        <div className="flex shrink-0 gap-1 flex-wrap justify-end">
          {member.role === "member" ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onSetAdmin}>
              Tornar admin
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onRemoveAdmin}>
              Remover admin
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            Remover
          </Button>
        </div>
      )}
    </li>
  )
}
