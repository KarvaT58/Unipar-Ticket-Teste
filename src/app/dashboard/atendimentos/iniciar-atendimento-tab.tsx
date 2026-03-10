"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconBuilding,
  IconCalendar,
  IconPlus,
  IconTrash,
  IconUpload,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import type { Ticket } from "@/lib/atendimento/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { IconPencil } from "@tabler/icons-react"
import { filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"
import { TicketListItem } from "./ticket-list-item"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ACCEPTED_FILE_TYPES =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"

const TITLE_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 700
const UPLOAD_LIST_SCROLL_AFTER = 5
const PAGE_SIZES = [10, 20, 30, 50]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function IniciarAtendimentoTab() {
  const { profile } = useAuth()
  const { unreadByTicketId, getNotificationLabelForTicket } = useNotifications()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [sector, setSector] = useState<string>("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [messageCountByTicket, setMessageCountByTicket] = useState<Record<string, number>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editSector, setEditSector] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null)
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sectorFilter, setSectorFilter] = useState<string>("")
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const fetchMyTickets = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("tickets")
      .select("*")
      .eq("created_by", profile.id)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyTickets((data as Ticket[]) ?? []))
  }, [supabase, profile])

  useEffect(() => {
    fetchMyTickets()
  }, [fetchMyTickets])

  useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("tickets-iniciados")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `created_by=eq.${profile.id}`,
        },
        () => fetchMyTickets()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, fetchMyTickets])

  useEffect(() => {
    setPageIndex(0)
  }, [filter.search, filter.dateFrom, filter.dateTo, statusFilter, sectorFilter])

  useEffect(() => {
    if (!supabase || myTickets.length === 0) {
      setAssigneeNames({})
      return
    }
    const userIds = [...new Set(myTickets.map((t) => t.assigned_to_user_id).filter(Boolean))] as string[]
    if (userIds.length === 0) {
      setAssigneeNames({})
      return
    }
    supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((r: { id: string; name: string }) => {
          map[r.id] = r.name ?? ""
        })
        setAssigneeNames(map)
      })
  }, [supabase, myTickets])

  useEffect(() => {
    if (!supabase || myTickets.length === 0) {
      setMessageCountByTicket({})
      return
    }
    const ids = myTickets.map((t) => t.id)
    supabase
      .from("ticket_messages")
      .select("ticket_id")
      .in("ticket_id", ids)
      .then(({ data }) => {
        const count: Record<string, number> = {}
        ids.forEach((id) => (count[id] = 0))
        ;(data ?? []).forEach((row: { ticket_id: string }) => {
          count[row.ticket_id] = (count[row.ticket_id] ?? 0) + 1
        })
        setMessageCountByTicket(count)
      })
  }, [supabase, myTickets])

  function canDeleteTicket(t: Ticket): boolean {
    const count = messageCountByTicket[t.id] ?? 0
    return count <= 1 && !t.assigned_to_user_id && t.status === "queue"
  }

  async function handleDelete(ticket: Ticket) {
    if (!supabase || !canDeleteTicket(ticket)) return
    setDeleteLoading(ticket.id)
    const { error } = await supabase.from("tickets").delete().eq("id", ticket.id)
    setTicketToDelete(null)
    fetchMyTickets()
    setDeleteLoading(null)
    if (error) toast.error("Não foi possível excluir o chamado.")
    else toast.success("Chamado excluído.")
  }

  function openEdit(t: Ticket) {
    setEditingTicket(t)
    setEditTitle(t.title.slice(0, TITLE_MAX_LENGTH))
    setEditDescription(t.description.slice(0, DESCRIPTION_MAX_LENGTH))
    setEditSector(t.target_sector)
    setEditOpen(true)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !editingTicket || !profile) return
    setEditLoading(true)
    await supabase
      .from("tickets")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim(),
        target_sector: editSector,
      })
      .eq("id", editingTicket.id)
    const { data: firstMsg } = await supabase
      .from("ticket_messages")
      .select("id")
      .eq("ticket_id", editingTicket.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single()
    if (firstMsg?.id) {
      await supabase
        .from("ticket_messages")
        .update({ content: editDescription.trim() })
        .eq("id", (firstMsg as { id: string }).id)
    }
    const { data: sectorProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("department", editSector)
      .neq("id", profile.id)
    const userIds = (sectorProfiles ?? []).map((r: { id: string }) => r.id)
    if (editingTicket.assigned_to_user_id && !userIds.includes(editingTicket.assigned_to_user_id)) {
      userIds.push(editingTicket.assigned_to_user_id)
    }
    if (userIds.length > 0) {
      await supabase.from("notifications").insert(
        userIds.map((userId) => ({
          user_id: userId,
          ticket_id: editingTicket.id,
          type: "ticket_edited",
        }))
      )
    }
    setEditOpen(false)
    setEditingTicket(null)
    fetchMyTickets()
    setEditLoading(false)
    toast.success("Chamado atualizado.")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !profile) return
    if (!sector?.trim()) {
      setError("Selecione o setor destino antes de abrir o chamado.")
      return
    }
    setError(null)
    setLoading(true)
    const { data: inserted, error: insertError } = await supabase
      .from("tickets")
      .insert({
        title: title.trim(),
        description: description.trim(),
        created_by: profile.id,
        target_sector: sector,
        status: "queue",
      })
      .select("id")
      .single()
    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }
    const ticketId = (inserted as { id: string }).id
    const { data: firstMsg, error: msgError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        user_id: profile.id,
        content: description.trim(),
      })
      .select("id")
      .single()
    if (msgError || !firstMsg) {
      setError(msgError?.message ?? "Erro ao criar mensagem.")
      setLoading(false)
      return
    }
    const messageId = (firstMsg as { id: string }).id
    if (files.length > 0) {
      setUploading(true)
      for (const file of files) {
        const path = `${ticketId}/messages/${messageId}/${crypto.randomUUID()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(path, file, { upsert: false, contentType: file.type })
        if (!uploadError) {
          await supabase.from("message_attachments").insert({
            message_id: messageId,
            uploaded_by: profile.id,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
          })
        }
      }
      setUploading(false)
    }
    setTitle("")
    setSector("")
    setDescription("")
    setFiles([])
    setOpen(false)
    fetchMyTickets()
    setLoading(false)
  }

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para criar e ver seus chamados.</p>
    )
  }

  const filteredBySearchAndDate = filterTicketsBySearchAndDate(myTickets, filter, "created_at")
  const filteredTickets = filteredBySearchAndDate.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false
    if (sectorFilter && t.target_sector !== sectorFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header: title, subtitle, Novo Chamado */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Chamados que eu abri
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Chamados que você criou e pode transferir ou acompanhar
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" size="default">
              <IconPlus className="size-4" />
              Novo Chamado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Criar chamado</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="ticket-title">Título</Label>
                  <Input
                    id="ticket-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
                    placeholder="Ex: Problema no acesso ao sistema"
                    maxLength={TITLE_MAX_LENGTH}
                    required
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {title.length}/{TITLE_MAX_LENGTH}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Setor destino <span className="text-destructive">*</span></Label>
                  <Select value={sector} onValueChange={setSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ticket-desc">Descrição</Label>
                  <Textarea
                    id="ticket-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                    placeholder="Descreva o problema ou solicitação..."
                    rows={4}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    className="resize-none overflow-y-auto max-h-[180px]"
                    required
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {description.length}/{DESCRIPTION_MAX_LENGTH}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Anexos (imagens, vídeos, áudios, documentos)</Label>
                  <div
                    className={cn(
                      "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                      "border-muted-foreground/25 hover:border-muted-foreground/50"
                    )}
                  >
                    <input
                      type="file"
                      id="ticket-files"
                      multiple
                      accept={ACCEPTED_FILE_TYPES}
                      className="sr-only"
                      onChange={(e) => {
                        const chosen = e.target.files
                        if (!chosen) return
                        setFiles((prev) => [...prev, ...Array.from(chosen)])
                      }}
                    />
                    <label
                      htmlFor="ticket-files"
                      className="flex cursor-pointer flex-col items-center gap-2"
                    >
                      <IconUpload className="size-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Clique ou arraste arquivos aqui
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Imagens, vídeos, áudios, PDF, Word, Excel, etc.
                      </span>
                    </label>
                  </div>
                  {files.length > 0 && (
                    <ul
                      className={cn(
                        "space-y-1",
                        files.length > UPLOAD_LIST_SCROLL_AFTER &&
                          "max-h-[200px] overflow-y-auto"
                      )}
                    >
                      {files.map((file, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                        >
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFiles((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <IconX className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || uploading}>
                  {loading || uploading ? "Criando…" : "Criar chamado"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter bar: search, status, setor */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Buscar por título ou descrição..."
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            className="h-9 bg-background border-muted-foreground/20"
          />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Todos os Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="queue">Na fila</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sectorFilter || "all"} onValueChange={(v) => setSectorFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Todos os Setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Setores</SelectItem>
            {SECTORS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTickets.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {myTickets.length === 0 ? "Você ainda não abriu nenhum chamado." : "Nenhum chamado encontrado para os filtros."}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card/50">
            <div className="p-0">
              {(() => {
                const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize))
                const currentPage = Math.min(pageIndex, pageCount - 1)
                const start = currentPage * pageSize
                const pageTickets = filteredTickets.slice(start, start + pageSize)
                return (
                  <div>
                    {pageTickets.map((t) => {
                      const statusLabel = t.status === "queue" ? "Aberto" : t.status === "in_progress" ? "Em andamento" : "Encerrado"
                      const canDelete = canDeleteTicket(t)
                      const hasUnread = (unreadByTicketId[t.id] ?? 0) > 0
                      const notificationLabel = getNotificationLabelForTicket(t.id)
                      const statusClassName =
                        t.status === "queue"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          : t.status === "in_progress"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            : "bg-muted text-foreground/90"
                      return (
                        <TicketListItem
                          key={t.id}
                          ticket={t}
                          href={`/dashboard/atendimentos/${t.id}`}
                          creatorName={profile?.name ?? "—"}
                          assigneeName={assigneeNames[t.assigned_to_user_id ?? ""] ?? "—"}
                          statusLabel={statusLabel}
                          statusClassName={statusClassName}
                          dateDisplay={formatDateOnly(t.created_at)}
                          timeDisplay={formatTimeOnly(t.created_at)}
                          badge={
                            hasUnread ? (
                              <Badge variant="destructive" className="ml-1.5 shrink-0 text-[10px] px-1.5 py-0">
                                {notificationLabel || "Nova mensagem"}
                              </Badge>
                            ) : undefined
                          }
                          actions={
                            <>
                              {t.status === "queue" && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(t)}>
                                  <IconPencil className="size-3.5 mr-1" />
                                  Editar
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={deleteLoading === t.id}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setTicketToDelete(t)
                                  }}
                                >
                                  <IconTrash className="size-3.5 mr-1" />
                                  {deleteLoading === t.id ? "Excluindo…" : "Apagar"}
                                </Button>
                              )}
                            </>
                          }
                        />
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
          {filteredTickets.length > 0 && (() => {
            const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize))
            const currentPage = Math.min(pageIndex, pageCount - 1)
            return (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-sm text-muted-foreground">
                  {filteredTickets.length} chamado(s)
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden items-center gap-2 lg:flex">
                    <Label htmlFor="rows-per-page-iniciados" className="text-sm font-medium">
                      Por página
                    </Label>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPageIndex(0)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-20" id="rows-per-page-iniciados">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {PAGE_SIZES.map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm font-medium">
                    Página {currentPage + 1} de {pageCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPageIndex(0)}
                      disabled={currentPage <= 0}
                      aria-label="Primeira página"
                    >
                      <IconChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                      disabled={currentPage <= 0}
                      aria-label="Página anterior"
                    >
                      <IconChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                      disabled={currentPage >= pageCount - 1}
                      aria-label="Próxima página"
                    >
                      <IconChevronRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPageIndex(pageCount - 1)}
                      disabled={currentPage >= pageCount - 1}
                      aria-label="Última página"
                    >
                      <IconChevronsRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      <AlertDialog open={!!ticketToDelete} onOpenChange={(open) => { if (!open) setTicketToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir este chamado? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!ticketToDelete) return
                const ticket = ticketToDelete
                await handleDelete(ticket)
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Editar chamado</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
                  maxLength={TITLE_MAX_LENGTH}
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {editTitle.length}/{TITLE_MAX_LENGTH}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Setor destino</Label>
                <Select value={editSector} onValueChange={setEditSector}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-desc">Descrição</Label>
                <Textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) =>
                    setEditDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))
                  }
                  rows={4}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  className="resize-none overflow-y-auto max-h-[180px]"
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {editDescription.length}/{DESCRIPTION_MAX_LENGTH}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
