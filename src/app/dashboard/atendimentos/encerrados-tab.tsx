"use client"

import { useCallback, useEffect, useState } from "react"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import type { Ticket } from "@/lib/atendimento/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TicketSearchFilterBar, filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"
import { TicketListItem } from "./ticket-list-item"

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

export function EncerradosTab() {
  const { profile } = useAuth()
  const { unreadByTicketId } = useNotifications()
  const supabase = createClient()
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [closedByNames, setClosedByNames] = useState<Record<string, string>>({})
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const fetchClosedTickets = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("tickets")
      .select("*")
      .eq("status", "closed")
      .eq("created_by", profile.id)
      .order("closed_at", { ascending: false })
      .then(({ data }) => setClosedTickets((data as Ticket[]) ?? []))
  }, [supabase, profile])

  useEffect(() => {
    fetchClosedTickets()
  }, [fetchClosedTickets])

  useEffect(() => {
    if (!supabase || closedTickets.length === 0) {
      setCreatorNames({})
      setClosedByNames({})
      return
    }
    const creatorIds = [...new Set(closedTickets.map((t) => t.created_by).filter(Boolean))]
    const closedByIds = [...new Set(closedTickets.map((t) => t.closed_by_user_id).filter(Boolean))]
    const allIds = [...new Set([...creatorIds, ...closedByIds])]
    if (allIds.length === 0) {
      setCreatorNames({})
      setClosedByNames({})
      return
    }
    supabase
      .from("profiles")
      .select("id, name")
      .in("id", allIds)
      .then(({ data }) => {
        const creatorMap: Record<string, string> = {}
        const closedByMap: Record<string, string> = {}
        ;(data ?? []).forEach((p: { id: string; name: string | null }) => {
          const name = p.name ?? "—"
          if (creatorIds.includes(p.id)) creatorMap[p.id] = name
          if (closedByIds.includes(p.id)) closedByMap[p.id] = name
        })
        setCreatorNames(creatorMap)
        setClosedByNames(closedByMap)
      })
  }, [supabase, closedTickets])

  useEffect(() => {
    if (!supabase || closedTickets.length === 0) {
      setAssigneeNames({})
      return
    }
    const assigneeIds = [...new Set(closedTickets.map((t) => t.assigned_to_user_id).filter(Boolean))] as string[]
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
  }, [supabase, closedTickets])

  useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("tickets-encerrados")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `created_by=eq.${profile.id}`,
        },
        () => fetchClosedTickets()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, fetchClosedTickets])

  useEffect(() => {
    setPageIndex(0)
  }, [filter.search, filter.dateFrom, filter.dateTo])

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver seus chamados encerrados.</p>
    )
  }

  return (
    <div className="space-y-4">
      <TicketSearchFilterBar
        value={filter}
        onChange={setFilter}
        dateLabel="Data de encerramento"
      />
      {closedTickets.length === 0 ? (
        <p className="text-muted-foreground">Nenhum chamado que você iniciou foi encerrado ainda.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card/50">
            <div className="p-0">
              {(() => {
                const filtered = filterTicketsBySearchAndDate(closedTickets, filter, "closed_at")
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
                      const dateIso = t.closed_at ?? t.created_at
                      return (
                        <TicketListItem
                          key={t.id}
                          ticket={t}
                          href={`/dashboard/atendimentos/${t.id}`}
                          creatorName={creatorNames[t.created_by] ?? "—"}
                          assigneeName={assigneeNames[t.assigned_to_user_id ?? ""] ?? "—"}
                          statusLabel="Encerrado"
                          statusClassName="bg-muted text-foreground/90"
                          dateDisplay={formatDateOnly(dateIso)}
                          timeDisplay={formatTimeOnly(dateIso)}
                          badge={
                            hasUnread ? (
                              <Badge variant="default" className="ml-1.5 shrink-0 text-[10px] px-1.5 py-0">
                                Novo
                              </Badge>
                            ) : undefined
                          }
                        />
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
          {closedTickets.length > 0 && (() => {
            const filtered = filterTicketsBySearchAndDate(closedTickets, filter, "closed_at")
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
                    <Label htmlFor="rows-per-page-encerrados" className="text-sm font-medium">
                      Por página
                    </Label>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPageIndex(0)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-20" id="rows-per-page-encerrados">
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
    </div>
  )
}
