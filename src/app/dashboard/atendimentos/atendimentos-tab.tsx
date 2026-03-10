"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowBack,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleX,
  IconUsers,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import type { Ticket } from "@/lib/atendimento/types"
import type { Profile } from "@/contexts/auth-context"
import {
  insertNotification,
  insertNotificationsForSector,
  NOTIFICATION_TYPES,
} from "@/lib/atendimento/notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TicketSearchFilterBar, filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"
import { TicketListItem } from "./ticket-list-item"
import { toast } from "sonner"

const CLOSURE_DESCRIPTION_MAX_LENGTH = 700

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

export function AtendimentosTab() {
  const { profile } = useAuth()
  const { unreadByTicketId, getNotificationLabelForTicket } = useNotifications()
  const supabase = createClient()
  const router = useRouter()
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({})
  const [profilesInSector, setProfilesInSector] = useState<Profile[]>([])
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [transferSectorOpen, setTransferSectorOpen] = useState(false)
  const [transferUserOpen, setTransferUserOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closingDescription, setClosingDescription] = useState("")
  const [closingLoading, setClosingLoading] = useState(false)
  const [selectedSector, setSelectedSector] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const fetchMyTickets = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("tickets")
      .select("*")
      .eq("assigned_to_user_id", profile.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyTickets((data as Ticket[]) ?? []))
  }, [supabase, profile])

  const fetchProfilesInSector = useCallback(() => {
    if (!supabase || !profile?.department) return
    supabase
      .from("profiles")
      .select("id, name, email, department, role")
      .eq("department", profile.department)
      .then(({ data }) => setProfilesInSector((data as Profile[]) ?? []))
  }, [supabase, profile?.department])

  useEffect(() => {
    fetchMyTickets()
    fetchProfilesInSector()
  }, [fetchMyTickets, fetchProfilesInSector])

  useEffect(() => {
    if (!supabase || myTickets.length === 0) {
      setCreatorNames({})
      return
    }
    const creatorIds = [...new Set(myTickets.map((t) => t.created_by).filter(Boolean))]
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
  }, [supabase, myTickets])

  useEffect(() => {
    if (!supabase || myTickets.length === 0) {
      setAssigneeNames({})
      return
    }
    const assigneeIds = [...new Set(myTickets.map((t) => t.assigned_to_user_id).filter(Boolean))] as string[]
    if (assigneeIds.length === 0) {
      setAssigneeNames({})
      return
    }
    supabase
      .from("profiles")
      .select("id, name")
      .in("id", assigneeIds)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((p: { id: string; name: string | null }) => {
          map[p.id] = p.name ?? "—"
        })
        setAssigneeNames(map)
      })
  }, [supabase, myTickets])

  useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("tickets-andamento")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `assigned_to_user_id=eq.${profile.id}`,
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
  }, [filter.search, filter.dateFrom, filter.dateTo])

  async function handleTransferSector() {
    if (!supabase || !selectedTicket || !selectedSector || !profile) return
    setActionLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({ target_sector: selectedSector, assigned_to_user_id: null })
      .eq("id", selectedTicket.id)
    setActionLoading(false)
    setTransferSectorOpen(false)
    setSelectedTicket(null)
    setSelectedSector("")
    if (error) {
      toast.error("Não foi possível transferir.")
      return
    }
    if (selectedTicket.created_by) {
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
      actorUserId: profile.id,
    })
    toast.success("Chamado transferido para outro setor.")
    fetchMyTickets()
  }

  async function handleTransferUser() {
    if (!supabase || !selectedTicket || !selectedUserId || !profile) return
    setActionLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to_user_id: selectedUserId, status: "in_progress" })
      .eq("id", selectedTicket.id)
    setActionLoading(false)
    setTransferUserOpen(false)
    setSelectedTicket(null)
    setSelectedUserId("")
    if (error) {
      toast.error("Não foi possível transferir.")
      return
    }
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
    toast.success("Chamado transferido.")
    fetchMyTickets()
  }

  async function handleDevolverFila(t: Ticket) {
    if (!supabase || !t?.id || !profile) return
    setActionLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to_user_id: null, status: "queue" })
      .eq("id", t.id)
    setActionLoading(false)
    if (error) {
      toast.error("Não foi possível devolver à fila.")
      return
    }
    if (t.created_by !== profile.id) {
      await insertNotification(supabase, {
        userId: t.created_by,
        ticketId: t.id,
        type: NOTIFICATION_TYPES.TICKET_RETURNED_TO_QUEUE,
        actorUserId: profile.id,
      })
    }
    await insertNotificationsForSector(supabase, t.target_sector, {
      ticketId: t.id,
      type: NOTIFICATION_TYPES.NEW_TICKET,
      actorUserId: profile.id,
    })
    toast.success("Chamado devolvido à fila.")
    fetchMyTickets()
  }

  async function handleEncerrar(t: Ticket, description: string) {
    if (!supabase || !t?.id || !description.trim() || !profile) return
    setClosingLoading(true)
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_description: description.trim(),
        closed_by_user_id: profile.id,
      })
      .eq("id", t.id)
    setClosingLoading(false)
    setCloseDialogOpen(false)
    setClosingDescription("")
    setSelectedTicket(null)
    if (error) {
      toast.error("Não foi possível encerrar.")
      return
    }
    if (t.created_by !== profile.id) {
      await insertNotification(supabase, {
        userId: t.created_by,
        ticketId: t.id,
        type: NOTIFICATION_TYPES.TICKET_CLOSED,
        actorUserId: profile.id,
      })
    }
    toast.success("Atendimento encerrado.")
    fetchMyTickets()
    router.push("/dashboard/atendimentos?tab=andamento")
  }

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver seus atendimentos.</p>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Meus atendimentos</h2>
      <TicketSearchFilterBar
        value={filter}
        onChange={setFilter}
        dateLabel="Data"
      />
      {myTickets.length === 0 ? (
        <p className="text-muted-foreground">Nenhum chamado em atendimento.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card/50">
            <div className="p-0">
              {(() => {
                const filtered = filterTicketsBySearchAndDate(myTickets, filter, "created_at")
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
                  <div>
                    {pageTickets.map((t) => {
                      const hasUnread = (unreadByTicketId[t.id] ?? 0) > 0
                      const notificationLabel = getNotificationLabelForTicket(t.id)
                      return (
                        <TicketListItem
                          key={t.id}
                          ticket={t}
                          href={`/dashboard/atendimentos/${t.id}`}
                          creatorName={creatorNames[t.created_by] ?? "—"}
                          assigneeName={assigneeNames[t.assigned_to_user_id ?? ""] ?? "—"}
                          statusLabel="Em andamento"
                          statusClassName="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                          dateDisplay={formatDateOnly(t.created_at)}
                          timeDisplay={formatTimeOnly(t.created_at)}
                          badge={
                            hasUnread ? (
                              <Badge variant="default" className="ml-1.5 shrink-0 text-[10px] px-1.5 py-0">
                                {notificationLabel || "Nova mensagem"}
                              </Badge>
                            ) : undefined
                          }
                          actions={
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={actionLoading}
                                onClick={(e) => {
                                  e.preventDefault()
                                  setSelectedTicket(t)
                                  setTransferSectorOpen(true)
                                }}
                              >
                                <IconArrowRight className="size-3.5 mr-1" />
                                Transferir setor
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={actionLoading}
                                onClick={(e) => {
                                  e.preventDefault()
                                  setSelectedTicket(t)
                                  setTransferUserOpen(true)
                                }}
                              >
                                <IconUsers className="size-3.5 mr-1" />
                                Transferir funcionário
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={actionLoading}
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleDevolverFila(t)
                                }}
                              >
                                <IconArrowBack className="size-3.5 mr-1" />
                                Devolver à fila
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={actionLoading}
                                onClick={(e) => {
                                  e.preventDefault()
                                  setSelectedTicket(t)
                                  setCloseDialogOpen(true)
                                }}
                              >
                                <IconCircleX className="size-3.5 mr-1" />
                                Encerrar
                              </Button>
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
          {myTickets.length > 0 && (() => {
            const filtered = filterTicketsBySearchAndDate(myTickets, filter, "created_at")
            if (filtered.length === 0) return null
            const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
            const currentPage = Math.min(pageIndex, pageCount - 1)
            return (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-sm text-muted-foreground">
                  {filtered.length} atendimento(s)
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden items-center gap-2 lg:flex">
                    <Label htmlFor="rows-per-page-andamento" className="text-sm font-medium">
                      Por página
                    </Label>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPageIndex(0)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-20" id="rows-per-page-andamento">
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
                      onClick={() =>
                        setPageIndex((i) => Math.min(pageCount - 1, i + 1))
                      }
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
                className="resize-none"
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
              onClick={() => selectedTicket && handleEncerrar(selectedTicket, closingDescription)}
              disabled={!closingDescription.trim() || closingLoading}
            >
              {closingLoading ? "Encerrando…" : "Encerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
