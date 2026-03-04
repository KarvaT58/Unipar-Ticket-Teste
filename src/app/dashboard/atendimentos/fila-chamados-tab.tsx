"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import type { Ticket } from "@/lib/atendimento/types"
import type { Profile } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { IconDotsVertical, IconUserCheck, IconUsers, IconArrowRight } from "@tabler/icons-react"
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

export function FilaChamadosTab() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [queueTickets, setQueueTickets] = useState<Ticket[]>([])
  const [profilesInSector, setProfilesInSector] = useState<Profile[]>([])
  const [transferSectorOpen, setTransferSectorOpen] = useState(false)
  const [transferUserOpen, setTransferUserOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedSector, setSelectedSector] = useState<string>("")
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [filter, setFilter] = useState<TicketSearchFilter>({ search: "", dateFrom: "", dateTo: "" })

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

  async function handlePegar(ticket: Ticket) {
    if (!supabase || !profile) return
    await supabase
      .from("tickets")
      .update({
        assigned_to_user_id: profile.id,
        status: "in_progress",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
    fetchQueue()
  }

  async function handleTransferSector() {
    if (!supabase || !selectedTicket || !selectedSector) return
    await supabase
      .from("tickets")
      .update({ target_sector: selectedSector, assigned_to_user_id: null })
      .eq("id", selectedTicket.id)
    setTransferSectorOpen(false)
    setSelectedTicket(null)
    setSelectedSector("")
    fetchQueue()
  }

  async function handleTransferUser() {
    if (!supabase || !selectedTicket || !selectedUserId) return
    await supabase
      .from("tickets")
      .update({
        assigned_to_user_id: selectedUserId,
        status: "in_progress",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id)
    setTransferUserOpen(false)
    setSelectedTicket(null)
    setSelectedUserId("")
    fetchQueue()
  }

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver a fila do seu setor.</p>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fila de chamados</h2>
      <TicketSearchFilterBar
        value={filter}
        onChange={setFilter}
        dateLabel="Data de abertura"
      />
      {queueTickets.length === 0 ? (
        <p className="text-muted-foreground">Nenhum chamado na fila do seu setor.</p>
      ) : (
        <div className="grid gap-2">
          {(() => {
            const filtered = filterTicketsBySearchAndDate(queueTickets, filter, "created_at")
            return filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum chamado encontrado para os filtros.
              </p>
            ) : (
              filtered.map((t) => (
                    <Card key={t.id} className="overflow-hidden transition-shadow hover:shadow-md py-2 px-4">
                      <div className="flex items-center justify-between gap-2 min-h-0">
                        <Link href={`/dashboard/atendimentos/${t.id}`} className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(t.created_at)}
                          </p>
                        </Link>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <IconDotsVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePegar(t)}>
                            <IconUserCheck className="size-4" />
                            Pegar chamado
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTicket(t)
                              setTransferSectorOpen(true)
                            }}
                          >
                            <IconArrowRight className="size-4" />
                            Transferir para outro setor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTicket(t)
                              setTransferUserOpen(true)
                            }}
                          >
                            <IconUsers className="size-4" />
                            Transferir para funcionário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))
            )
          })()}
        </div>
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
