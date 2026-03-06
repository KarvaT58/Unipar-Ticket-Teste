"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconUserCheck,
  IconUsers,
  IconArrowRight,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import type { Ticket } from "@/lib/atendimento/types"
import type { Profile } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { TicketSearchFilterBar, filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"
import {
  insertNotification,
  insertNotificationsForSector,
  NOTIFICATION_TYPES,
} from "@/lib/atendimento/notifications"

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

export function FilaChamadosTab() {
  const { profile } = useAuth()
  const { markTicketAsRead, unreadByTicketId } = useNotifications()
  const supabase = createClient()
  const [queueTickets, setQueueTickets] = useState<Ticket[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [profilesInSector, setProfilesInSector] = useState<Profile[]>([])
  const [transferSectorOpen, setTransferSectorOpen] = useState(false)
  const [transferUserOpen, setTransferUserOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedSector, setSelectedSector] = useState<string>("")
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [actionLoading, setActionLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setPageIndex(0)
  }, [filter.search, filter.dateFrom, filter.dateTo])

  const fetchQueue = useCallback(() => {
    if (!supabase || !profile?.department) return
    supabase
      .from("tickets")
      .select("*")
      .eq("target_sector", profile.department)
      .eq("status", "queue")
      .order("created_at", { ascending: false })
      .then(({ data }) => setQueueTickets((data as Ticket[]) ?? []))
  }, [supabase, profile?.department])

  const fetchProfilesInSector = useCallback(() => {
    if (!supabase || !profile?.department) return
    supabase
      .from("profiles")
      .select("id, name, email, department, role")
      .eq("department", profile.department)
      .then(({ data }) => setProfilesInSector((data as Profile[]) ?? []))
  }, [supabase, profile?.department])

  useEffect(() => {
    fetchQueue()
    fetchProfilesInSector()
  }, [fetchQueue, fetchProfilesInSector])

  useEffect(() => {
    if (!supabase || queueTickets.length === 0) {
      setCreatorNames({})
      return
    }
    const creatorIds = [...new Set(queueTickets.map((t) => t.created_by).filter(Boolean))]
    if (creatorIds.length === 0) {
      setCreatorNames({})
      return
    }
    supabase
      .from("profiles")
      .select("id, name")
      .in("id", creatorIds)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((p: { id: string; name: string | null }) => {
          map[p.id] = p.name ?? "—"
        })
        setCreatorNames(map)
      })
  }, [supabase, queueTickets])

  useEffect(() => {
    if (!supabase || !profile?.department) return
    const channel = supabase
      .channel("tickets-fila")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `target_sector=eq.${profile.department}`,
        },
        () => fetchQueue()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.department, fetchQueue])

  async function handlePegar(ticket: Ticket) {
    if (!supabase || !ticket?.id) return
    setActionLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      setActionLoading(false)
      toast.error("Faça login para pegar o chamado.")
      return
    }
    const payload: Record<string, string> = {
      assigned_to_user_id: String(user.id),
      status: "in_progress",
    }
    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", String(ticket.id))
    setActionLoading(false)
    if (error) {
      toast.error("Não foi possível pegar o chamado. Tente novamente.")
      console.error("[handlePegar]", error)
      return
    }
    if (ticket.created_by && ticket.created_by !== user.id) {
      await insertNotification(supabase, {
        userId: ticket.created_by,
        ticketId: ticket.id,
        type: NOTIFICATION_TYPES.TICKET_ASSIGNED,
        actorUserId: user.id,
      })
    }
    await markTicketAsRead(ticket.id)
    toast.success("Chamado atribuído a você.")
    router.push("/dashboard/atendimentos?tab=andamento")
  }

  async function handleTransferSector() {
    if (!supabase || !selectedTicket || !selectedSector) return
    setActionLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({ target_sector: selectedSector, assigned_to_user_id: null })
      .eq("id", selectedTicket.id)
    setActionLoading(false)
    setTransferSectorOpen(false)
    setSelectedTicket(null)
    setSelectedSector("")
    if (error) return
    if (selectedTicket.created_by && profile?.id) {
      await insertNotification(supabase, {
        userId: selectedTicket.created_by,
        ticketId: selectedTicket.id,
        type: NOTIFICATION_TYPES.TICKET_TRANSFERRED,
        actorUserId: profile.id,
      })
    }
    await insertNotificationsForSector(supabase, selectedSector, {
      ticketId: selectedTicket.id,
      type: NOTIFICATION_TYPES.NEW_TICKET,
      actorUserId: profile?.id ?? null,
    })
    fetchQueue()
  }

  async function handleTransferUser() {
    if (!supabase || !selectedTicket || !selectedUserId) return
    setActionLoading(true)
    const payload: Record<string, string | null> = {
      assigned_to_user_id: String(selectedUserId),
      status: "in_progress",
    }
    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", String(selectedTicket.id))
    setActionLoading(false)
    setTransferUserOpen(false)
    setSelectedTicket(null)
    setSelectedUserId("")
    if (error) {
      toast.error("Não foi possível transferir o chamado. Tente novamente.")
      console.error("[handleTransferUser]", error)
      return
    }
    if (profile?.id) {
      await insertNotification(supabase, {
        userId: selectedUserId,
        ticketId: selectedTicket.id,
        type: NOTIFICATION_TYPES.TICKET_TRANSFERRED,
        actorUserId: profile.id,
      })
      if (selectedTicket.created_by && selectedTicket.created_by !== selectedUserId) {
        await insertNotification(supabase, {
          userId: selectedTicket.created_by,
          ticketId: selectedTicket.id,
          type: NOTIFICATION_TYPES.TICKET_TRANSFERRED,
          actorUserId: profile.id,
        })
      }
    }
    toast.success("Chamado transferido.")
    router.push("/dashboard/atendimentos?tab=andamento")
  }

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver a fila do seu setor.</p>
    )
  }

  return (
    <div className="space-y-4">
      <TicketSearchFilterBar
        value={filter}
        onChange={setFilter}
        dateLabel="Data de abertura"
      />
      {queueTickets.length === 0 ? (
        <p className="text-muted-foreground">Nenhum chamado na fila do seu setor.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card/50">
            <div className="p-2">
              {(() => {
                const filtered = filterTicketsBySearchAndDate(queueTickets, filter, "created_at")
                const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
                const currentPage = Math.min(pageIndex, pageCount - 1)
                const start = currentPage * pageSize
                const pageTickets = filtered.slice(start, start + pageSize)
                if (filtered.length === 0) {
                  return (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                      Nenhum chamado encontrado para os filtros.
                    </div>
                  )
                }
                return (
                  <div className="grid gap-0">
                    {/* Cabeçalho: Aberto por | Título do chamado | Data | Horário | Ações */}
                    <div className="grid grid-cols-[minmax(100px,140px)_minmax(0,1fr)_90px_64px_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30 rounded-t-lg items-center">
                      <span>Aberto por</span>
                      <span>Título do chamado</span>
                      <span className="text-right">Data</span>
                      <span className="text-right">Horário</span>
                      <span className="text-right">Ações</span>
                    </div>
                    {pageTickets.map((t) => {
                      const hasUnread = (unreadByTicketId[t.id] ?? 0) > 0
                      return (
                      <Card key={t.id} className="overflow-hidden transition-colors hover:bg-muted/40 py-2.5 px-4 border-0 border-b border-border/50 shadow-none rounded-none first:rounded-t-none last:rounded-b-lg">
                        <div className="grid grid-cols-[minmax(100px,140px)_minmax(0,1fr)_90px_64px_auto] gap-3 items-center min-h-0">
                          <Link href={`/dashboard/atendimentos/${t.id}`} className="min-w-0 flex items-center">
                            <span className="text-sm text-foreground truncate underline decoration-muted-foreground/50 hover:decoration-foreground">
                              {creatorNames[t.created_by] ?? "—"}
                            </span>
                          </Link>
                          <Link href={`/dashboard/atendimentos/${t.id}`} className="min-w-0 flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {t.title}
                            </span>
                            {hasUnread && (
                              <Badge variant="default" className="shrink-0 text-[10px] px-1.5 py-0">
                                Novo
                              </Badge>
                            )}
                          </Link>
                          <Link href={`/dashboard/atendimentos/${t.id}`} className="text-xs text-muted-foreground text-right tabular-nums">
                            {formatDateOnly(t.created_at)}
                          </Link>
                          <Link href={`/dashboard/atendimentos/${t.id}`} className="text-xs text-muted-foreground text-right tabular-nums">
                            {formatTimeOnly(t.created_at)}
                          </Link>
                          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={actionLoading}
                              onClick={() => handlePegar(t)}
                            >
                              <IconUserCheck className="size-3.5 mr-1" />
                              Pegar Chamado
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={actionLoading}
                              onClick={() => {
                                setSelectedTicket(t)
                                setTransferUserOpen(true)
                              }}
                            >
                              <IconUsers className="size-3.5 mr-1" />
                              Transferir para funcionário
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={actionLoading}
                              onClick={() => {
                                setSelectedTicket(t)
                                setTransferSectorOpen(true)
                              }}
                            >
                              <IconArrowRight className="size-3.5 mr-1" />
                              Transferir para outro setor
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )})}
                  </div>
                )
              })()}
            </div>
          </div>
          {queueTickets.length > 0 && (() => {
            const filtered = filterTicketsBySearchAndDate(queueTickets, filter, "created_at")
            if (filtered.length === 0) return null
            const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
            const currentPage = Math.min(pageIndex, pageCount - 1)
            return (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-sm text-muted-foreground">
                  {filtered.length} chamado(s)
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden items-center gap-2 lg:flex">
                    <Label htmlFor="rows-per-page-fila" className="text-sm font-medium">
                      Por página
                    </Label>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPageIndex(0)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-20" id="rows-per-page-fila">
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
                  {SECTORS.filter((s) => s.value !== profile?.department).map((s) => (
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
                    .filter((p) => p.id !== profile?.id)
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
    </div>
  )
}
