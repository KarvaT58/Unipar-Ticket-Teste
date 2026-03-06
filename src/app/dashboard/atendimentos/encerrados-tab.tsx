"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TicketSearchFilterBar, filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"

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
            <div className="p-2">
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
                const gridCols = "minmax(110px,140px) minmax(150px,240px) 105px 88px 68px"
                return (
                  <div className="grid gap-0">
                    <div
                      className="grid gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30 rounded-t-lg items-center"
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <span>Aberto por</span>
                      <span>Título do chamado</span>
                      <span>Status</span>
                      <span className="tabular-nums">Data</span>
                      <span className="tabular-nums">Horário</span>
                    </div>
                    {pageTickets.map((t, idx) => {
                      const hasUnread = (unreadByTicketId[t.id] ?? 0) > 0
                      const dateIso = t.closed_at ?? t.created_at
                      const isLast = idx === pageTickets.length - 1
                      return (
                      <Link key={t.id} href={`/dashboard/atendimentos/${t.id}`} className="contents">
                        <Card className={`cursor-pointer overflow-hidden transition-colors hover:bg-muted/40 py-2.5 px-4 border-0 border-b border-border/50 shadow-none rounded-none ${idx === 0 ? "first:rounded-t-none" : ""} ${isLast ? "rounded-b-lg border-b-0" : ""}`}>
                          <div className="grid gap-3 items-center min-h-0" style={{ gridTemplateColumns: gridCols }}>
                            <span className="text-sm text-foreground truncate">
                              {creatorNames[t.created_by] ?? "—"}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">
                              {t.title}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 bg-muted text-foreground/90">
                                Encerrado
                              </span>
                              {hasUnread && (
                                <Badge variant="default" className="shrink-0 text-[10px] px-1.5 py-0">
                                  Novo
                                </Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {formatDateOnly(dateIso)}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {formatTimeOnly(dateIso)}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    )})}
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
