"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Ticket, TicketMessage, MessageAttachment } from "@/lib/atendimento/types"
import type { Profile } from "@/contexts/auth-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  IconArrowLeft,
  IconArrowBack,
  IconArrowRight,
  IconCircleX,
  IconDotsVertical,
  IconFile,
  IconHeadset,
  IconLock,
  IconPaperclip,
  IconRefresh,
  IconUsers,
  IconX,
} from "@tabler/icons-react"

const ACCEPTED_FILE_TYPES =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"

const UPLOAD_LIST_SCROLL_AFTER = 5
const CLOSURE_DESCRIPTION_MAX_LENGTH = 700

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

/** Chip de anexo pendente: mostra preview de imagem ou ícone + nome */
function PendingAttachmentChip({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const image = isImageFile(file)

  useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, image])

  return (
    <li className="flex items-center gap-2 rounded-lg border bg-muted/50 p-1.5 pr-1">
      {image && objectUrl ? (
        <img
          src={objectUrl}
          alt={file.name}
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
          <IconFile className="size-6 text-muted-foreground" />
        </div>
      )}
      <span className="max-w-[140px] truncate text-xs font-medium" title={file.name}>
        {file.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Remover anexo"
      >
        <IconX className="size-4" />
      </button>
    </li>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Display name: use last path segment so we never show "C:\..." in the UI */
function getDisplayFileName(fileName: string): string {
  const segments = fileName.replace(/\\/g, "/").split("/")
  return segments[segments.length - 1] || fileName
}

function AttachmentLink({
  filePath,
  fileName,
  fileType,
  supabase,
}: {
  filePath: string
  fileName: string
  fileType: string
  supabase: NonNullable<ReturnType<typeof createClient>>
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.storage
      .from("ticket-attachments")
      .createSignedUrl(filePath, 60 * 60)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl)
        setLoading(false)
      })
  }, [supabase, filePath])

  const displayName = getDisplayFileName(fileName)
  const isImage = fileType.startsWith("image/")
  const isVideo = fileType.startsWith("video/")
  const isAudio = fileType.startsWith("audio/")

  if (loading)
    return (
      <div className="flex items-center gap-2 rounded-md bg-black/10 px-2 py-1.5 text-xs">
        <span className="animate-pulse">Carregando…</span>
      </div>
    )
  if (!url) return <span className="text-xs opacity-80">{displayName}</span>

  if (isImage)
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md ring-1 ring-black/10"
      >
        <img
          src={url}
          alt=""
          className="max-h-36 max-w-[240px] rounded-md object-cover"
        />
      </a>
    )

  if (isVideo)
    return (
      <video
        src={url}
        controls
        className="max-h-40 max-w-[280px] rounded-md bg-black object-contain"
        preload="metadata"
      >
        Seu navegador não suporta vídeo.
        <a href={url} target="_blank" rel="noopener noreferrer">
          Abrir vídeo
        </a>
      </video>
    )

  if (isAudio)
    return (
      <div className="rounded-md bg-black/5 p-2">
        <audio src={url} controls className="h-9 max-w-[220px]" preload="metadata">
          Seu navegador não suporta áudio.
        </audio>
      </div>
    )

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md bg-black/10 px-2 py-1.5 text-xs underline hover:bg-black/15"
    >
      <IconFile className="size-3.5 shrink-0" />
      {displayName}
    </a>
  )
}

function MessageBubble({
  message,
  attachments,
  isOwn,
  profileName,
  supabase,
  isOpeningDescription,
  isInternalNote,
}: {
  message: TicketMessage
  attachments: MessageAttachment[]
  isOwn: boolean
  profileName?: string
  supabase: NonNullable<ReturnType<typeof createClient>>
  isOpeningDescription?: boolean
  isInternalNote?: boolean
}) {
  const [name, setName] = useState(profileName ?? "…")
  useEffect(() => {
    if (profileName) return
    supabase
      .from("profiles")
      .select("name")
      .eq("id", message.user_id)
      .single()
      .then(({ data }) => data && setName((data as { name: string }).name))
  }, [message.user_id, profileName, supabase])

  const imageAttachments = attachments.filter((a) => a.file_type.startsWith("image/"))
  const videoAttachments = attachments.filter((a) => a.file_type.startsWith("video/"))
  const audioAttachments = attachments.filter((a) => a.file_type.startsWith("audio/"))
  const docAttachments = attachments.filter(
    (a) =>
      !a.file_type.startsWith("image/") &&
      !a.file_type.startsWith("video/") &&
      !a.file_type.startsWith("audio/")
  )

  return (
    <div
      className={
        isOpeningDescription
          ? "max-w-[85%] sm:max-w-[320px] rounded-lg bg-transparent px-0 py-0 text-sm"
          : isInternalNote
            ? "max-w-[85%] sm:max-w-[320px] rounded-xl border border-dashed border-muted-foreground/40 bg-muted/60 px-3 py-2 text-sm dark:bg-muted/40"
            : isOwn
              ? "ml-auto max-w-[85%] sm:max-w-[320px] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm"
              : "max-w-[85%] sm:max-w-[320px] rounded-xl bg-muted px-3 py-2 text-sm shadow-sm"
      }
    >
      {isInternalNote && (
        <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <IconLock className="size-3.5" />
          Anotação interna (só seu setor)
        </p>
      )}
      {!isOwn && !isOpeningDescription && !isInternalNote && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{name}</p>
      )}
      {message.content.trim() ? (
        <p className="whitespace-pre-wrap">{message.content}</p>
      ) : null}
      {attachments.length > 0 && (
        <div className="mt-2 space-y-3">
          {imageAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageAttachments.map((a) => (
                <AttachmentLink
                  key={a.id}
                  filePath={a.file_path}
                  fileName={a.file_name}
                  fileType={a.file_type}
                  supabase={supabase}
                />
              ))}
            </div>
          )}
          {videoAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {videoAttachments.map((a) => (
                <AttachmentLink
                  key={a.id}
                  filePath={a.file_path}
                  fileName={a.file_name}
                  fileType={a.file_type}
                  supabase={supabase}
                />
              ))}
            </div>
          )}
          {audioAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {audioAttachments.map((a) => (
                <AttachmentLink
                  key={a.id}
                  filePath={a.file_path}
                  fileName={a.file_name}
                  fileType={a.file_type}
                  supabase={supabase}
                />
              ))}
            </div>
          )}
          {docAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {docAttachments.map((a) => (
                <AttachmentLink
                  key={a.id}
                  filePath={a.file_path}
                  fileName={a.file_name}
                  fileType={a.file_type}
                  supabase={supabase}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-1.5 text-xs opacity-80">{formatDate(message.created_at)}</p>
    </div>
  )
}

export default function AtendimentoTicketPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.ticketId as string
  const { profile } = useAuth()
  const supabase = createClient()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(new Set())
  const didMarkReadRef = useRef(false)
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<Record<string, MessageAttachment[]>>({})
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [profilesInSector, setProfilesInSector] = useState<Profile[]>([])
  const [transferSectorOpen, setTransferSectorOpen] = useState(false)
  const [transferUserOpen, setTransferUserOpen] = useState(false)
  const [selectedSector, setSelectedSector] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closingDescription, setClosingDescription] = useState("")
  const [closingLoading, setClosingLoading] = useState(false)
  const [closerName, setCloserName] = useState<string | null>(null)
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [reopenLoading, setReopenLoading] = useState(false)

  const fetchTicket = useCallback(() => {
    if (!supabase || !ticketId) return
    supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single()
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) setTicket(null)
        else setTicket(data as Ticket)
      })
  }, [supabase, ticketId])

  const fetchMessages = useCallback(() => {
    if (!supabase || !ticketId) return
    supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const msgs = (data as TicketMessage[]) ?? []
        setMessages(msgs)
        if (msgs.length === 0) {
          setAttachmentsByMessageId({})
          return
        }
        const ids = msgs.map((m) => m.id)
        supabase
          .from("message_attachments")
          .select("*")
          .in("message_id", ids)
          .then(({ data: attData }) => {
            const list = (attData as MessageAttachment[]) ?? []
            const byMessage: Record<string, MessageAttachment[]> = {}
            ids.forEach((id) => (byMessage[id] = []))
            list.forEach((a) => {
              if (byMessage[a.message_id]) byMessage[a.message_id].push(a)
            })
            setAttachmentsByMessageId(byMessage)
          })
      })
  }, [supabase, ticketId])

  const fetchProfilesInSector = useCallback(() => {
    if (!supabase || !ticket?.target_sector) return
    supabase
      .from("profiles")
      .select("id, name, email, department, role")
      .eq("department", ticket.target_sector)
      .then(({ data }) => setProfilesInSector((data as Profile[]) ?? []))
  }, [supabase, ticket?.target_sector])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  useEffect(() => {
    if (ticketId) fetchMessages()
  }, [ticketId, fetchMessages])

  useEffect(() => {
    setHighlightedMessageIds(new Set())
    didMarkReadRef.current = false
  }, [ticketId])

  useEffect(() => {
    if (!ticketId || !profile || messages.length === 0 || didMarkReadRef.current) return
    didMarkReadRef.current = true
  }, [ticketId, profile?.id, messages])

  useEffect(() => {
    if (ticket?.target_sector) fetchProfilesInSector()
  }, [ticket?.target_sector, fetchProfilesInSector])

  useEffect(() => {
    if (!supabase || !ticket || ticket.status !== "closed" || !ticket.closed_by_user_id) {
      setCloserName(null)
      return
    }
    supabase
      .from("profiles")
      .select("name")
      .eq("id", ticket.closed_by_user_id)
      .single()
      .then(({ data }) => setCloserName((data as { name: string } | null)?.name ?? null))
  }, [supabase, ticket?.status, ticket?.closed_by_user_id])

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!supabase || !profile || !ticketId) return
    const hasText = newMessage.trim().length > 0
    const hasFiles = files.length > 0
    if (!hasText && !hasFiles) return

    setSending(true)

    const canSendInternalNote = ticket && profile.department === ticket.target_sector
    const { data: insertedMsg, error: msgError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        user_id: profile.id,
        content: hasText ? newMessage.trim() : " ",
        is_internal_note: canSendInternalNote && isInternalNote,
      })
      .select("id")
      .single()

    if (msgError || !insertedMsg) {
      setSending(false)
      return
    }

    const messageId = (insertedMsg as { id: string }).id

    if (files.length > 0) {
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
    }

    setNewMessage("")
    setFiles([])
    setIsInternalNote(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
    fetchMessages()
    setSending(false)
  }

  async function handleEncerrar(description: string) {
    if (!supabase || !ticketId || !description.trim() || !profile || !ticket) return
    setClosingLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_description: description.trim(),
        closed_by_user_id: profile.id,
      })
      .eq("id", ticketId)
    setClosingLoading(false)
    setCloseDialogOpen(false)
    setClosingDescription("")
    if (!error) {
      const isAuthor = ticket.created_by === profile.id
      router.push(isAuthor ? "/dashboard/atendimentos?tab=encerrados" : "/dashboard/historico-atendimentos")
    }
  }

  async function handleDevolverFila() {
    if (!supabase || !ticketId) return
    await supabase
      .from("tickets")
      .update({ assigned_to_user_id: null, status: "queue" })
      .eq("id", ticketId)
    router.push("/dashboard/atendimentos")
  }

  async function handleReabrir() {
    if (!supabase || !ticketId || !ticket) return
    setReopenLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "queue",
        closed_at: null,
        closed_description: null,
        closed_by_user_id: null,
        assigned_to_user_id: null,
      })
      .eq("id", ticketId)
    setReopenLoading(false)
    if (!error) {
      fetchTicket()
      fetchMessages()
      router.push("/dashboard/atendimentos?tab=iniciados")
    }
  }

  async function handleTransferSector() {
    if (!supabase || !ticketId || !selectedSector) return
    await supabase
      .from("tickets")
      .update({ target_sector: selectedSector, assigned_to_user_id: null })
      .eq("id", ticketId)
    setTransferSectorOpen(false)
    setSelectedSector("")
    router.push("/dashboard/atendimentos")
  }

  async function handleTransferUser() {
    if (!supabase || !ticketId || !selectedUserId) return
    await supabase
      .from("tickets")
      .update({
        assigned_to_user_id: selectedUserId,
        status: "in_progress",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
    setTransferUserOpen(false)
    setSelectedUserId("")
    router.push("/dashboard/atendimentos")
  }

  if (loading) {
    const sidebarStyle = {
      "--sidebar-width": "calc(var(--spacing) * 72)",
      "--header-height": "calc(var(--spacing) * 12)",
    } as React.CSSProperties
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col p-4 lg:p-6">
            <p className="text-muted-foreground">Carregando…</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!ticket || !profile) {
    const sidebarStyle = {
      "--sidebar-width": "calc(var(--spacing) * 72)",
      "--header-height": "calc(var(--spacing) * 12)",
    } as React.CSSProperties
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col p-4 lg:p-6">
            <p className="text-muted-foreground">Chamado não encontrado ou você não tem acesso.</p>
            <Button asChild variant="link" className="mt-2">
              <Link href="/dashboard/atendimentos">Voltar para Atendimentos</Link>
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const canAttend = ticket.assigned_to_user_id === profile.id && ticket.status === "in_progress"
  const isAuthor = ticket.created_by === profile.id
  const showActionsMenu =
    (isAuthor || canAttend) && ticket.status !== "closed"
  const canSendMessages =
    (ticket.created_by === profile.id || ticket.assigned_to_user_id === profile.id) &&
    ticket.status !== "closed"

  const sidebarStyle = {
    "--sidebar-width": "calc(var(--spacing) * 72)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as React.CSSProperties

  return (
    <SidebarProvider style={sidebarStyle} className="h-svh max-h-svh overflow-hidden">
      <AppSidebar variant="inset" />
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader
            title="Chamado"
            description="Detalhes e mensagens do atendimento."
            icon={<IconHeadset className="size-5" />}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-6 lg:px-6">
          {/* Top bar: back + title + actions */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-4 mt-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button variant="ghost" size="sm" className="shrink-0" asChild>
                <Link
                  href={
                    isAuthor
                      ? ticket.status === "closed"
                        ? "/dashboard/atendimentos?tab=encerrados"
                        : "/dashboard/atendimentos?tab=iniciados"
                      : "/dashboard/atendimentos?tab=andamento"
                  }
                >
                  <IconArrowLeft className="size-4" />
                  Voltar
                </Link>
              </Button>
              <h1 className="truncate text-xl font-semibold">{ticket.title}</h1>
            </div>
            {showActionsMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <IconDotsVertical className="size-4" />
                    Ações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTransferSectorOpen(true)}>
                    <IconArrowRight className="size-4" />
                    Transferir para outro setor
                  </DropdownMenuItem>
                  {canAttend && (
                    <>
                      <DropdownMenuItem onClick={() => setTransferUserOpen(true)}>
                        <IconUsers className="size-4" />
                        Transferir para outro funcionário
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDevolverFila}>
                        <IconArrowBack className="size-4" />
                        Devolver à fila
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setCloseDialogOpen(true)}
                  >
                    <IconCircleX className="size-4" />
                    Encerrar atendimento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {ticket.status === "closed" && isAuthor && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleReabrir}
                disabled={reopenLoading}
              >
                <IconRefresh className="size-4" />
                {reopenLoading ? "Reabrindo…" : "Reabrir chamado"}
              </Button>
            )}
          </div>

          {/* Full-height chat area: scroll only inside the messages box */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-4">
            <div
              ref={chatScrollRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-muted/20 p-4 overscroll-y-contain"
            >
              {messages.length === 0 && ticket.status !== "closed" ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem ainda. Envie a primeira.
                </p>
              ) : (
                <>
                  {messages.map((m, index) => {
                    const isOpening = index === 0
                    const isHighlighted = highlightedMessageIds.has(m.id)
                    const highlightClass = isHighlighted
                      ? "rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-3 dark:border-amber-400/50 dark:bg-amber-500/15"
                      : ""
                    const bubble = (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        attachments={attachmentsByMessageId[m.id] ?? []}
                        isOwn={m.user_id === profile.id}
                        profileName={m.user_id === profile.id ? profile.name : undefined}
                        supabase={supabase!}
                        isInternalNote={!!m.is_internal_note}
                      />
                    )
                    if (isOpening) {
                      return (
                        <div
                          key={m.id}
                          className={
                            isHighlighted
                              ? highlightClass
                              : "rounded-xl border-2 border-blue-500/40 bg-blue-500/10 p-4 dark:border-blue-400/30 dark:bg-blue-500/15"
                          }
                        >
                          <p className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                            Descrição da abertura do chamado
                          </p>
                          <MessageBubble
                            message={m}
                            attachments={attachmentsByMessageId[m.id] ?? []}
                            isOwn={m.user_id === profile.id}
                            profileName={m.user_id === profile.id ? profile.name : undefined}
                            supabase={supabase!}
                            isOpeningDescription
                          />
                        </div>
                      )
                    }
                    return isHighlighted ? (
                      <div key={m.id} className={highlightClass}>
                        <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          Nova mensagem
                        </p>
                        {bubble}
                      </div>
                    ) : (
                      bubble
                    )
                  })}
                  {ticket.status === "closed" && (
                    <div className="rounded-xl border-2 border-red-500/40 bg-red-500/10 p-4 dark:border-red-400/30 dark:bg-red-500/15">
                      <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                        Encerrado por {closerName ?? "…"}
                      </p>
                      {ticket.closed_description?.trim() ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-red-900/90 dark:text-red-100/90">
                          {ticket.closed_description}
                        </p>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </div>

            {canSendMessages && (
              <div className="flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-sm">
                {profile.department === ticket.target_sector && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={isInternalNote}
                      onCheckedChange={(checked) => setIsInternalNote(checked === true)}
                      aria-label="Anotação interna (só seu setor)"
                    />
                    <span>Anotação interna (só seu setor vê)</span>
                  </label>
                )}
                {files.length > 0 && (
                  <div
                    className={
                      files.length > UPLOAD_LIST_SCROLL_AFTER
                        ? "max-h-[200px] overflow-y-auto overflow-x-hidden"
                        : ""
                    }
                  >
                    <ul className="flex flex-wrap gap-2">
                      {files.map((file, i) => (
                        <PendingAttachmentChip
                          key={`${file.name}-${i}`}
                          file={file}
                          onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    className="sr-only"
                    onChange={(e) => {
                      const chosen = e.target.files
                      if (chosen) setFiles((prev) => [...prev, ...Array.from(chosen)])
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Anexar fotos, vídeos, áudios ou documentos"
                  >
                    <IconPaperclip className="size-5" />
                  </Button>
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    rows={2}
                    className="min-h-0 flex-1 resize-none"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={sending || (!newMessage.trim() && files.length === 0)}
                    className="shrink-0"
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            )}

            {!canSendMessages && ticket.status === "closed" && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Este atendimento foi encerrado.</p>
              </div>
            )}
          </div>
          </div>
        </div>
      </SidebarInset>

      <Dialog open={transferSectorOpen} onOpenChange={setTransferSectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir para outro setor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Novo setor</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.filter((s) => s.value !== ticket.target_sector).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferSectorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTransferSector} disabled={!selectedSector}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferUserOpen} onOpenChange={setTransferUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir para funcionário do setor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Funcionário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {profilesInSector
                    .filter((p) => p.id !== profile.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferUserOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTransferUser} disabled={!selectedUserId}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closeDialogOpen}
        onOpenChange={(open) => {
          if (!open) setClosingDescription("")
          setCloseDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar atendimento</DialogTitle>
          </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="close-desc">Descrição do encerramento (obrigatório)</Label>
              <Textarea
                id="close-desc"
                value={closingDescription}
                onChange={(e) =>
                  setClosingDescription(e.target.value.slice(0, CLOSURE_DESCRIPTION_MAX_LENGTH))
                }
                placeholder="Descreva o motivo ou resumo do encerramento..."
                rows={4}
                maxLength={CLOSURE_DESCRIPTION_MAX_LENGTH}
                className="resize-none overflow-y-auto max-h-[180px]"
                required
              />
              <p className="text-right text-xs text-muted-foreground">
                {closingDescription.length}/{CLOSURE_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setClosingDescription("")
                setCloseDialogOpen(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleEncerrar(closingDescription)}
              disabled={!closingDescription.trim() || closingLoading}
            >
              {closingLoading ? "Encerrando…" : "Encerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
