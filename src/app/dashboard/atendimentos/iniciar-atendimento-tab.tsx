"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import type { Ticket } from "@/lib/atendimento/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { IconPlus, IconUpload, IconX, IconPencil, IconTrash, IconDotsVertical } from "@tabler/icons-react"
import { TicketSearchFilterBar, filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ACCEPTED_FILE_TYPES =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"

const TITLE_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 700
const UPLOAD_LIST_SCROLL_AFTER = 5

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function IniciarAtendimentoTab() {
  const { profile } = useAuth()
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Meus chamados abertos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus className="size-4" />
              Iniciar atendimento
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
                  <Label>Setor destino</Label>
                  <Select value={sector} onValueChange={setSector} required>
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

      <TicketSearchFilterBar
        value={filter}
        onChange={setFilter}
        dateLabel="Data de abertura"
      />
      {myTickets.length === 0 ? (
        <p className="text-muted-foreground">Você ainda não abriu nenhum chamado.</p>
      ) : (
        <>
          <div className="grid gap-2">
            {(() => {
              const filtered = filterTicketsBySearchAndDate(myTickets, filter, "created_at")
              return filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum chamado encontrado para os filtros.
                </p>
              ) : (
                filtered.map((t) => (
            <Link key={t.id} href={`/dashboard/atendimentos/${t.id}`}>
              <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md py-2 px-4">
                <div className="flex items-center justify-between gap-2 min-h-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">
                      {t.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(t.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        t.status === "queue" && "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                        t.status === "in_progress" && "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                        t.status === "closed" && "text-muted-foreground"
                      )}
                    >
                      {t.status === "queue"
                        ? "Na fila"
                        : t.status === "in_progress"
                          ? "Em atendimento"
                          : "Encerrado"}
                    </Badge>
                    {t.status === "queue" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDotsVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); openEdit(t) }}>
                            <IconPencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          {canDeleteTicket(t) && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.preventDefault()
                                setTicketToDelete(t)
                              }}
                              disabled={deleteLoading === t.id}
                            >
                              <IconTrash className="size-4" />
                              {deleteLoading === t.id ? "Excluindo…" : "Excluir"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
                ))
              )
            })()}
          </div>
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
