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
import type { Ticket } from "@/lib/atendimento/types"
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

export function HistoricoTab() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const fetchClosedTickets = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("tickets")
      .select("*")
      .eq("status", "closed")
      .eq("assigned_to_user_id", profile.id)
      .neq("created_by", profile.id)
      .order("closed_at", { ascending: false })
      .then(({ data }) => setClosedTickets((data as Ticket[]) ?? []))
  }, [supabase, profile])

  useEffect(() => {
    fetchClosedTickets()
  }, [fetchClosedTickets])

  useEffect(() => {
    if (!supabase || closedTickets.length === 0) {
      setCreatorNames({})
      return
    }
    const creatorIds = [...new Set(closedTickets.map((t) => t.created_by).filter(Boolean))]
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
  }, [supabase, closedTickets])

  useEffect(() => {
    setPageIndex(0)
  }, [filter.search, filter.dateFrom, filter.dateTo])

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver o histórico.</p>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Histórico de chamados</h2>
      <TicketSearchFilterBar
        value={filter}
        onChange={setFilter}
        dateLabel="Data de encerramento"
      />
      {closedTickets.length === 0 ? (
        <p className="text-muted-foreground">Nenhum atendimento de outro setor encerrado por você.</p>
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
                return (
                  <div className="grid gap-0">
                    <div className="grid grid-cols-[minmax(100px,140px)_minmax(0,1fr)_90px_64px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30 rounded-t-lg items-center">
                      <span>Aberto por</span>
                      <span>Título do chamado</span>
                      <span className="text-right">Data</span>
                      <span className="text-right">Horário</span>
                    </div>
                    {pageTickets.map((t, idx) => {
                      const dateIso = t.closed_at ?? t.created_at
                      const isLast = idx === pageTickets.length - 1
                      return (
                      <Link key={t.id} href={`/dashboard/atendimentos/${t.id}`} className="contents">
                        <Card className={`cursor-pointer overflow-hidden transition-colors hover:bg-muted/40 py-2.5 px-4 border-0 border-b border-border/50 shadow-none rounded-none ${idx === 0 ? "first:rounded-t-none" : ""} ${isLast ? "rounded-b-lg border-b-0" : ""}`}>
                          <div className="grid grid-cols-[minmax(100px,140px)_minmax(0,1fr)_90px_64px] gap-3 items-center min-h-0">
                            <span className="text-sm text-foreground truncate">
                              {creatorNames[t.created_by] ?? "—"}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">{t.title}</span>
                            <span className="text-xs text-muted-foreground text-right tabular-nums">
                              {formatDateOnly(dateIso)}
                            </span>
                            <span className="text-xs text-muted-foreground text-right tabular-nums">
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
                    <Label htmlFor="rows-per-page-historico" className="text-sm font-medium">
                      Por página
                    </Label>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPageIndex(0)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-20" id="rows-per-page-historico">
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
