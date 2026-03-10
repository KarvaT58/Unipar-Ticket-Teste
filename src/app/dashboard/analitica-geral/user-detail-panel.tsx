"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  IconTicket,
  IconClock,
  IconUserCheck,
  IconCircleCheck,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconPackage,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import type { Ticket } from "@/lib/atendimento/types"
import type { Loan } from "@/lib/emprestimos/types"
import { getUserStatusLabel } from "@/lib/user-status"
import { cn } from "@/lib/utils"
import type { Profile } from "@/contexts/auth-context"

const QUEUE_DELAY_DAYS = 3
const LOAN_OVERDUE_DAYS = 3

type UserDetailPanelProps = {
  selectedUser: Profile | null
}

const PAGE_SIZES = [10, 20, 30, 50]

const STATUS_LABELS: Record<string, string> = {
  queue: "Na fila",
  in_progress: "Em andamento",
  closed: "Encerrado",
}

const STATUS_CLASS: Record<string, string> = {
  queue: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  closed: "bg-green-500/15 text-green-700 dark:text-green-400",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
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

function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
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

function resolutionTime(createdAt: string, closedAt: string | null): string {
  if (!closedAt) return "—"
  const a = new Date(createdAt).getTime()
  const b = new Date(closedAt).getTime()
  const diffMs = b - a
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffM / 60)
  const d = Math.floor(diffH / 24)
  if (d > 0) return `${d}d ${diffH % 24}h`
  if (diffH > 0) return `${diffH}h ${diffM % 60}min`
  return `${diffM} min`
}

/** Days the ticket stayed in queue (created -> assigned or closed). > QUEUE_DELAY_DAYS = atraso */
function ticketQueueDelayDays(t: Ticket): number {
  const created = new Date(t.created_at).getTime()
  const leftQueue = t.assigned_at
    ? new Date(t.assigned_at).getTime()
    : t.closed_at
      ? new Date(t.closed_at).getTime()
      : Date.now()
  const days = (leftQueue - created) / (24 * 60 * 60 * 1000)
  return Math.floor(days)
}

function ticketHasQueueDelay(t: Ticket): boolean {
  return ticketQueueDelayDays(t) > QUEUE_DELAY_DAYS
}

function filterTicketsBySearch(tickets: Ticket[], search: string): Ticket[] {
  const q = search.trim().toLowerCase()
  if (!q) return tickets
  return tickets.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.target_sector.toLowerCase().includes(q)
  )
}

/** Loan is overdue by more than LOAN_OVERDUE_DAYS when return_date passed that many days ago and not returned */
function loanOverdueDays(loan: Loan): number {
  if (loan.returned_at) return 0
  const returnDate = new Date(loan.return_date + "T23:59:59").getTime()
  const now = Date.now()
  if (now <= returnDate) return 0
  return Math.floor((now - returnDate) / (24 * 60 * 60 * 1000))
}

function loanHasOverdueDelay(loan: Loan): boolean {
  return loanOverdueDays(loan) > LOAN_OVERDUE_DAYS
}

function filterLoansBySearch(
  loans: (Loan & { borrower_name?: string | null; lender_name?: string | null })[],
  search: string
): (Loan & { borrower_name?: string | null; lender_name?: string | null })[] {
  const q = search.trim().toLowerCase()
  if (!q) return loans
  return loans.filter(
    (l) =>
      l.title.toLowerCase().includes(q) ||
      (l.description && l.description.toLowerCase().includes(q)) ||
      (l.borrower_name && l.borrower_name.toLowerCase().includes(q)) ||
      (l.lender_name && l.lender_name.toLowerCase().includes(q))
  )
}

type TicketCounts = {
  createdByMe: number
  inProgress: number
  queueSector: number
  closedByMe: number
}

export function UserDetailPanel({ selectedUser }: UserDetailPanelProps) {
  const supabase = createClient()
  const [counts, setCounts] = useState<TicketCounts>({
    createdByMe: 0,
    inProgress: 0,
    queueSector: 0,
    closedByMe: 0,
  })
  const [createdTickets, setCreatedTickets] = useState<Ticket[]>([])
  const [inProgressTickets, setInProgressTickets] = useState<Ticket[]>([])
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([])
  const [historyTickets, setHistoryTickets] = useState<Ticket[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPageIndex, setHistoryPageIndex] = useState(0)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [loadingLists, setLoadingLists] = useState(false)
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({})
  const [searchCriados, setSearchCriados] = useState("")
  const [searchAndamento, setSearchAndamento] = useState("")
  const [searchEncerrados, setSearchEncerrados] = useState("")
  const [searchHistorico, setSearchHistorico] = useState("")
  const [searchEmprestimos, setSearchEmprestimos] = useState("")
  const [loans, setLoans] = useState<(Loan & { borrower_name?: string | null; lender_name?: string | null })[]>([])
  const [loadingLoans, setLoadingLoans] = useState(false)

  const userId = selectedUser?.id ?? null
  const userDept = selectedUser?.department ?? ""

  const fetchCounts = useCallback(async () => {
    if (!supabase || !userId) {
      setCounts({
        createdByMe: 0,
        inProgress: 0,
        queueSector: 0,
        closedByMe: 0,
      })
      setLoadingCounts(false)
      return
    }
    setLoadingCounts(true)
    const [createdRes, inProgressRes, queueRes, closedRes] = await Promise.all([
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to_user_id", userId)
        .eq("status", "in_progress"),
      userDept
        ? supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .eq("target_sector", userDept)
            .eq("status", "queue")
        : Promise.resolve({ count: 0 }),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("closed_by_user_id", userId),
    ])
    setCounts({
      createdByMe: createdRes.count ?? 0,
      inProgress: inProgressRes.count ?? 0,
      queueSector: queueRes.count ?? 0,
      closedByMe: closedRes.count ?? 0,
    })
    setLoadingCounts(false)
  }, [supabase, userId, userDept])

  const fetchCreated = useCallback(async () => {
    if (!supabase || !userId) {
      setCreatedTickets([])
      return
    }
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
    setCreatedTickets((data as Ticket[]) ?? [])
  }, [supabase, userId])

  const fetchInProgress = useCallback(async () => {
    if (!supabase || !userId) {
      setInProgressTickets([])
      return
    }
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("assigned_to_user_id", userId)
      .eq("status", "in_progress")
      .order("assigned_at", { ascending: false })
    setInProgressTickets((data as Ticket[]) ?? [])
  }, [supabase, userId])

  const fetchClosed = useCallback(async () => {
    if (!supabase || !userId) {
      setClosedTickets([])
      return
    }
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "closed")
      .or(`closed_by_user_id.eq.${userId},created_by.eq.${userId}`)
      .order("closed_at", { ascending: false })
    setClosedTickets((data as Ticket[]) ?? [])
  }, [supabase, userId])

  const fetchHistory = useCallback(async () => {
    if (!supabase || !userId) {
      setHistoryTickets([])
      setHistoryTotal(0)
      return
    }
    setLoadingLists(true)
    const from = historyPageIndex * historyPageSize
    const to = from + historyPageSize - 1
    const { data: listData, count } = await supabase
      .from("tickets")
      .select("*", { count: "exact" })
      .or(`created_by.eq.${userId},assigned_to_user_id.eq.${userId},closed_by_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .range(from, to)
    setHistoryTickets((listData as Ticket[]) ?? [])
    setHistoryTotal(count ?? 0)
    setLoadingLists(false)
  }, [supabase, userId, historyPageIndex, historyPageSize])

  const fetchLoans = useCallback(async () => {
    if (!supabase || !userId) {
      setLoans([])
      setLoadingLoans(false)
      return
    }
    setLoadingLoans(true)
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .or(`borrower_id.eq.${userId},lender_id.eq.${userId}`)
      .order("created_at", { ascending: false })
    if (error) {
      setLoans([])
      setLoadingLoans(false)
      return
    }
    const list = (data as Loan[]) ?? []
    if (list.length === 0) {
      setLoans([])
      setLoadingLoans(false)
      return
    }
    const profileIds = [
      ...new Set(list.flatMap((l) => [l.borrower_id, l.lender_id].filter(Boolean))),
    ] as string[]
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", profileIds)
    const nameById: Record<string, string> = {}
    ;(profilesData ?? []).forEach((p: { id: string; name: string | null }) => {
      nameById[p.id] = p.name ?? "—"
    })
    setLoans(
      list.map((l) => ({
        ...l,
        borrower_name: nameById[l.borrower_id] ?? null,
        lender_name: l.lender_id ? nameById[l.lender_id] ?? null : null,
      }))
    )
    setLoadingLoans(false)
  }, [supabase, userId])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  useEffect(() => {
    if (!userId) return
    fetchCreated()
    fetchInProgress()
    fetchClosed()
    fetchLoans()
  }, [userId, fetchCreated, fetchInProgress, fetchClosed, fetchLoans])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const allTicketIds = [
    ...createdTickets,
    ...inProgressTickets,
    ...closedTickets,
    ...historyTickets,
  ].reduce((acc, t) => {
    acc.add(t.created_by)
    if (t.assigned_to_user_id) acc.add(t.assigned_to_user_id)
    if (t.closed_by_user_id) acc.add(t.closed_by_user_id)
    return acc
  }, new Set<string>())
  const allTicketIdsKey = [...allTicketIds].sort().join(",")

  useEffect(() => {
    if (!supabase || allTicketIds.size === 0) {
      setCreatorNames({})
      setAssigneeNames({})
      return
    }
    const ids = [...allTicketIds]
    supabase
      .from("profiles")
      .select("id, name")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((p: { id: string; name: string | null }) => {
          map[p.id] = p.name ?? "—"
        })
        setCreatorNames(map)
        setAssigneeNames(map)
      })
  }, [supabase, allTicketIdsKey])

  const allTicketsForDelay = useMemo(
    () => [
      ...createdTickets,
      ...inProgressTickets,
      ...closedTickets,
      ...historyTickets,
    ],
    [createdTickets, inProgressTickets, closedTickets, historyTickets]
  )
  const ticketsWithDelayCount = useMemo(
    () => allTicketsForDelay.filter(ticketHasQueueDelay).length,
    [allTicketsForDelay]
  )
  const loansOverdue3Count = useMemo(
    () => loans.filter(loanHasOverdueDelay).length,
    [loans]
  )

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um colaborador na lista para ver o resumo de atendimentos.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-start gap-4 border-b pb-4">
        <Avatar className="h-14 w-14 shrink-0 rounded-full">
          <AvatarImage
            src={selectedUser.avatar_url ?? undefined}
            alt={selectedUser.name}
          />
          <AvatarFallback className="rounded-full">
            {getInitials(selectedUser.name ?? "?")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{selectedUser.name ?? "Sem nome"}</h2>
          <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline">{selectedUser.department || "—"}</Badge>
            {selectedUser.role && (
              <Badge variant="secondary">{selectedUser.role}</Badge>
            )}
            {selectedUser.user_status && (
              <Badge variant="outline">
                {getUserStatusLabel(selectedUser.user_status)}
              </Badge>
            )}
            {ticketsWithDelayCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <IconAlertTriangle className="size-3" />
                {ticketsWithDelayCount} chamado(s) com atraso (&gt;{QUEUE_DELAY_DAYS} dias na fila)
              </Badge>
            )}
            {loansOverdue3Count > 0 && (
              <Badge variant="destructive" className="gap-1">
                <IconAlertTriangle className="size-3" />
                {loansOverdue3Count} empréstimo(s) em atraso (&gt;{LOAN_OVERDUE_DAYS} dias)
              </Badge>
            )}
          </div>
        </div>
      </header>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Resumo</h3>
        {loadingCounts ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="mt-2 h-8 w-12 rounded bg-muted" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <IconTicket className="size-4" />
                  Criados
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {counts.createdByMe}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Chamados abertos por este colaborador
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <IconUserCheck className="size-4" />
                  Em andamento
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {counts.inProgress}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Atendimentos em curso
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <IconClock className="size-4" />
                  Fila do setor
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {counts.queueSector}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Chamados na fila do setor
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <IconCircleCheck className="size-4" />
                  Encerrados
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {counts.closedByMe}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Chamados encerrados por este colaborador
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section>
        <Tabs defaultValue="criados" className="w-full">
          <TabsList className="h-9 w-full flex-wrap justify-start gap-1 bg-muted/50">
            <TabsTrigger value="criados">Criados</TabsTrigger>
            <TabsTrigger value="andamento">Em andamento</TabsTrigger>
            <TabsTrigger value="encerrados">Encerrados</TabsTrigger>
            <TabsTrigger value="historico">Histórico completo</TabsTrigger>
            <TabsTrigger value="emprestimos">Empréstimos</TabsTrigger>
          </TabsList>
          <TabsContent value="criados" className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por título, descrição ou setor..."
                  value={searchCriados}
                  onChange={(e) => setSearchCriados(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <TicketList
              tickets={filterTicketsBySearch(createdTickets, searchCriados)}
              creatorNames={creatorNames}
              assigneeNames={assigneeNames}
              emptyMessage="Nenhum chamado criado por este colaborador."
            />
          </TabsContent>
          <TabsContent value="andamento" className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por título, descrição ou setor..."
                  value={searchAndamento}
                  onChange={(e) => setSearchAndamento(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <TicketList
              tickets={filterTicketsBySearch(inProgressTickets, searchAndamento)}
              creatorNames={creatorNames}
              assigneeNames={assigneeNames}
              emptyMessage="Nenhum atendimento em andamento."
            />
          </TabsContent>
          <TabsContent value="encerrados" className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por título, descrição ou setor..."
                  value={searchEncerrados}
                  onChange={(e) => setSearchEncerrados(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <TicketList
              tickets={filterTicketsBySearch(closedTickets, searchEncerrados)}
              creatorNames={creatorNames}
              assigneeNames={assigneeNames}
              emptyMessage="Nenhum chamado encerrado."
            />
          </TabsContent>
          <TabsContent value="historico" className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por título, descrição ou setor..."
                  value={searchHistorico}
                  onChange={(e) => setSearchHistorico(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            {loadingLists ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <>
                <TicketList
                  tickets={filterTicketsBySearch(historyTickets, searchHistorico)}
                  creatorNames={creatorNames}
                  assigneeNames={assigneeNames}
                  emptyMessage="Nenhum registro."
                />
                {historyTotal > historyPageSize && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Select
                      value={String(historyPageSize)}
                      onValueChange={(v) => {
                        setHistoryPageSize(Number(v))
                        setHistoryPageIndex(0)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s} por página
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={historyPageIndex === 0}
                        onClick={() => setHistoryPageIndex((i) => Math.max(0, i - 1))}
                      >
                        <IconChevronLeft className="size-4" />
                      </Button>
                      <span className="px-2 text-sm text-muted-foreground">
                        {historyPageIndex * historyPageSize + 1}–
                        {Math.min(
                          (historyPageIndex + 1) * historyPageSize,
                          historyTotal
                        )}{" "}
                        de {historyTotal}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={
                          (historyPageIndex + 1) * historyPageSize >= historyTotal
                        }
                        onClick={() =>
                          setHistoryPageIndex((i) => i + 1)
                        }
                      >
                        <IconChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="emprestimos" className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por título, descrição ou pessoa..."
                  value={searchEmprestimos}
                  onChange={(e) => setSearchEmprestimos(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            {loadingLoans ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando empréstimos...
              </div>
            ) : (
              <LoanList
                loans={filterLoansBySearch(loans, searchEmprestimos)}
                emptyMessage="Nenhum empréstimo encontrado."
              />
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}

function TicketList({
  tickets,
  creatorNames,
  assigneeNames,
  emptyMessage,
}: {
  tickets: Ticket[]
  creatorNames: Record<string, string>
  assigneeNames: Record<string, string>
  emptyMessage: string
}) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }
  return (
    <ul className="divide-y divide-border rounded-md border">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/dashboard/atendimentos/${ticket.id}`}
            className="block px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">Título:</span>{" "}
                <span className="font-medium">{ticket.title}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Setor:</span>{" "}
                {getSectorLabel(ticket.target_sector)}
              </span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                  STATUS_CLASS[ticket.status] ?? "bg-muted"
                )}
              >
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </span>
              <span>
                <span className="text-muted-foreground">Aberto por:</span>{" "}
                {creatorNames[ticket.created_by] ?? "—"}
              </span>
              <span>
                <span className="text-muted-foreground">Data:</span>{" "}
                {formatDateOnly(ticket.created_at)}
              </span>
              <span>
                <span className="text-muted-foreground">Horário:</span>{" "}
                {formatTimeOnly(ticket.created_at)}
              </span>
              {ticketHasQueueDelay(ticket) && (
                <Badge variant="destructive" className="text-[10px]">
                  Atraso &gt;{QUEUE_DELAY_DAYS} dias na fila
                </Badge>
              )}
              {ticket.closed_at && (
                <span>
                  <span className="text-muted-foreground">Resolução:</span>{" "}
                  {resolutionTime(ticket.created_at, ticket.closed_at)}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function formatLoanReturnDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function LoanList({
  loans,
  emptyMessage,
}: {
  loans: (Loan & { borrower_name?: string | null; lender_name?: string | null })[]
  emptyMessage: string
}) {
  if (loans.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }
  return (
    <ul className="divide-y divide-border rounded-md border">
      {loans.map((loan) => {
        const isReturned = !!loan.returned_at
        const overdueDays = loanOverdueDays(loan)
        const isOverdue3 = loanHasOverdueDelay(loan)
        const statusLabel = isReturned
          ? "Devolvido"
          : overdueDays > 0
            ? "Atrasado"
            : "Ativo"
        const statusClass = isReturned
          ? "bg-green-500/15 text-green-700 dark:text-green-400"
          : overdueDays > 0
            ? "bg-red-500/15 text-red-700 dark:text-red-400"
            : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
        return (
          <li
            key={loan.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm"
          >
            <span>
              <span className="text-muted-foreground">Título:</span>{" "}
              <span className="font-medium">{loan.title}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Devolução prevista:</span>{" "}
              {formatLoanReturnDate(loan.return_date)}
            </span>
            <span>
              <span className="text-muted-foreground">Solicitante:</span>{" "}
              {loan.borrower_name ?? "—"}
            </span>
            <span>
              <span className="text-muted-foreground">Emprestador:</span>{" "}
              {loan.lender_name ?? "—"}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusClass
              )}
            >
              {statusLabel}
            </span>
            {isOverdue3 && (
              <Badge variant="destructive" className="text-[10px]">
                Atraso &gt;{LOAN_OVERDUE_DAYS} dias
              </Badge>
            )}
          </li>
        )
      })}
    </ul>
  )
}
