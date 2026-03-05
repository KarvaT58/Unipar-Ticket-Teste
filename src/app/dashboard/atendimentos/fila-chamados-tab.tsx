"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconUserCheck,
  IconUsers,
  IconArrowRight,
} from "@tabler/icons-react"
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
import { toast } from "sonner"
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
    toast.success("Chamado transferido.")
    router.push("/dashboard/atendimentos?tab=andamento")
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
        <>
          <div className="overflow-hidden rounded-lg border">
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
                  <div className="grid gap-2">
                    {pageTickets.map((t) => (
                      <Card key={t.id} className="overflow-hidden transition-shadow hover:shadow-md py-2 px-4 border-0 shadow-none">
                        <div className="flex items-center justify-between gap-2 min-h-0">
                          <Link href={`/dashboard/atendimentos/${t.id}`} className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(t.created_at)}
                            </p>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={actionLoading}>
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
                    ))}
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
