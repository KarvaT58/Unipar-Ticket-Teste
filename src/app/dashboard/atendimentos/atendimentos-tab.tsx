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

export function AtendimentosTab() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

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

  useEffect(() => {
    fetchMyTickets()
  }, [fetchMyTickets])

  useEffect(() => {
    setPageIndex(0)
  }, [filter.search, filter.dateFrom, filter.dateTo])

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
          <div className="overflow-hidden rounded-lg border">
            <div className="p-2">
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
                  <div className="grid gap-2">
                    {pageTickets.map((t) => (
                      <Link key={t.id} href={`/dashboard/atendimentos/${t.id}`}>
                        <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md py-2 px-4 border-0 shadow-none">
                          <div className="flex items-center justify-between gap-2 min-h-0">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(t.created_at)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
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
    </div>
  )
}
