"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Ticket } from "@/lib/atendimento/types"
import { Card } from "@/components/ui/card"
import { TicketSearchFilterBar, filterTicketsBySearchAndDate, type TicketSearchFilter } from "./ticket-search-filter-bar"

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
                          <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(t.created_at)}
                          </p>
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
    </div>
  )
}
