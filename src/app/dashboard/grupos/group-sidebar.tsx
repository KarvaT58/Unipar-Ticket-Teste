"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useGroupChat } from "@/contexts/group-chat-context"
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from "@tabler/icons-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import type { ChatGroupWithPreview } from "@/lib/chat/group-types"

export function GroupSidebar({
  createOpen: controlledCreateOpen,
  onOpenChange: onControlledOpenChange,
}: {
  createOpen?: boolean
  onOpenChange?: (open: boolean) => void
} = {}) {
  const supabase = createClient()
  const { profile } = useAuth()
  const {
    groups,
    activeGroupId,
    setActiveGroupId,
    createGroup,
    updateGroup,
    deleteGroup,
    canManageMembers,
    isLoadingGroups,
  } = useGroupChat()
  const [search, setSearch] = React.useState("")
  const [internalCreateOpen, setInternalCreateOpen] = React.useState(false)
  const createOpen = onControlledOpenChange ? (controlledCreateOpen ?? false) : internalCreateOpen
  const setCreateOpen = onControlledOpenChange ?? setInternalCreateOpen
  const [groupName, setGroupName] = React.useState("")
  const [teamUsers, setTeamUsers] = React.useState<
    Array<{ id: string; name: string; avatar_url: string | null; department: string | null }>
  >([])
  const [teamSearch, setTeamSearch] = React.useState("")
  const [selectedUserIds, setSelectedUserIds] = React.useState<Set<string>>(new Set())
  const [creating, setCreating] = React.useState(false)

  const filteredGroups = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = term
      ? groups.filter(
          (g) =>
            (g.name ?? "").toLowerCase().includes(term) ||
            g.id.toLowerCase().includes(term)
        )
      : [...groups]
    return list.sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return timeB - timeA
    })
  }, [groups, search])

  const filteredTeamUsers = React.useMemo(() => {
    const term = teamSearch.trim().toLowerCase()
    const list = term
      ? teamUsers.filter((u) => u.name.toLowerCase().includes(term))
      : [...teamUsers]
    return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [teamUsers, teamSearch])

  React.useEffect(() => {
    if (!createOpen || !supabase || !profile?.id) return
    let cancelled = false
    supabase
      .from("profiles")
      .select("id, name, avatar_url, department")
      .neq("id", profile.id)
      .then(({ data }) => {
        if (!cancelled && data) setTeamUsers(data)
      })
    return () => {
      cancelled = true
    }
  }, [createOpen, supabase, profile?.id])

  const handleCreateGroup = React.useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const id = await createGroup(
        groupName.trim() || null,
        Array.from(selectedUserIds)
      )
      if (id) {
        setCreateOpen(false)
        setGroupName("")
        setSelectedUserIds(new Set())
      }
    } finally {
      setCreating(false)
    }
  }, [createGroup, groupName, selectedUserIds, creating])

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30",
          "w-full md:w-72",
          activeGroupId ? "hidden md:flex" : "flex"
        )}
      >
        <div className="flex items-center gap-2 border-b p-2">
          <Input
            placeholder="Buscar grupos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <Button
            variant="outline"
            className="mb-2 w-full"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus className="mr-2 size-4" />
            Criar grupo
          </Button>
          {isLoadingGroups ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : filteredGroups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search ? "Nenhum grupo encontrado." : "Nenhum grupo ainda."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filteredGroups.map((group) => (
                <GroupItem
                  key={group.id}
                  group={group}
                  isActive={activeGroupId === group.id}
                  onSelect={() => setActiveGroupId(group.id)}
                  canManage={canManageMembers(group)}
                  onUpdateName={updateGroup}
                  onDelete={deleteGroup}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setGroupName("")
            setTeamSearch("")
            setSelectedUserIds(new Set())
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-sm flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Criar grupo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do grupo (opcional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="h-9 shrink-0"
          />
          <Input
            placeholder="Buscar pessoas para adicionar..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="h-9 shrink-0"
          />
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            style={{ maxHeight: "20rem" }}
          >
            {teamUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Carregando...
              </p>
            ) : filteredTeamUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma pessoa encontrada.
              </p>
            ) : (
              <ul className="space-y-1 pr-1">
                {filteredTeamUsers.map((user) => (
                  <li key={user.id}>
                    <label className="flex cursor-pointer select-none items-center gap-3 rounded-md p-2 hover:bg-muted">
                      <Checkbox
                        checked={selectedUserIds.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                      <Avatar className="size-9">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{user.name}</p>
                        {user.department && (
                          <p className="truncate text-xs text-muted-foreground">
                            {user.department}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            className="mt-2 shrink-0"
            onClick={handleCreateGroup}
            disabled={creating}
          >
            {creating ? "Criando..." : "Criar grupo"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function GroupItem({
  group,
  isActive,
  onSelect,
  canManage,
  onUpdateName,
  onDelete,
}: {
  group: ChatGroupWithPreview
  isActive: boolean
  onSelect: () => void
  canManage: boolean
  onUpdateName: (groupId: string, name: string | null) => Promise<void>
  onDelete: (groupId: string) => Promise<void>
}) {
  const displayName = group.name || "Sem nome"
  const [editOpen, setEditOpen] = React.useState(false)
  const [editName, setEditName] = React.useState(group.name ?? "")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const handleOpenEdit = () => {
    setEditName(group.name ?? "")
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onUpdateName(group.id, editName.trim() || null)
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onDelete(group.id)
      setDeleteOpen(false)
    } finally {
      setSaving(false)
    }
  }

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
        className={cn(
          "group/item flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left transition-colors",
          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
        )}
      >
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName}</p>
          {group.last_message_preview && (
            <p className="truncate text-xs text-muted-foreground">
              {group.last_message_preview}
            </p>
          )}
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Opções do grupo"
              >
                <IconDotsVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit() }}>
                <IconPencil className="mr-2 size-4" />
                Editar nome
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteOpen(true) }}
              >
                <IconTrash className="mr-2 size-4" />
                Apagar grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Editar nome do grupo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do grupo"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-9"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja apagar o grupo &quot;{displayName}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDelete() }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
