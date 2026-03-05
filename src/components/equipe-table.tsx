"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconSearch,
  IconDotsVertical,
  IconMessageCircle,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { usePresence } from "@/contexts/presence-context"
import { useChat } from "@/contexts/chat-context"
import { useAuth } from "@/contexts/auth-context"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import { getUserStatusLabel } from "@/lib/user-status"
import { StatusPill } from "@/components/status-pill"
import type { Ticket } from "@/lib/atendimento/types"

type TeamMember = {
  id: string
  name: string
  email: string
  department: string
  role: string
  avatar_url: string | null
  user_status: string | null
}

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

function isDateInRange(dateIso: string | null, from: string, to: string): boolean {
  if (!dateIso) return false
  const d = new Date(dateIso)
  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null
  if (fromDate && d < fromDate) return false
  if (toDate) {
    const endOfDay = new Date(toDate)
    endOfDay.setHours(23, 59, 59, 999)
    if (d > endOfDay) return false
  }
  return true
}

export function EquipeTable() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuth()
  const { onlineUserIds } = usePresence()
  const { startConversation } = useChat()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [startingWith, setStartingWith] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("equipe")

  const handleStartChat = useCallback(async (userId: string) => {
    if (!userId || startingWith === userId) return
    setStartingWith(userId)
    try {
      const conversationId = await startConversation(userId)
      if (conversationId) {
        router.push(`/dashboard/chat-interno?conversation=${conversationId}`)
      }
    } finally {
      setStartingWith(null)
    }
  }, [startConversation, router, startingWith])

  /** Current user first, then rest ordered by name (from API). Realtime updates keep this order. */
  const membersWithMeFirst = useMemo(() => {
    if (!profile?.id || members.length === 0) return members
    const meIndex = members.findIndex((m) => m.id === profile.id)
    if (meIndex <= 0) return members
    const me = members[meIndex]
    const rest = [...members.slice(0, meIndex), ...members.slice(meIndex + 1)]
    return [me, ...rest]
  }, [profile?.id, members])

  const filteredMembers = membersWithMeFirst.filter((m) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q))
    )
  })

  const filteredMyTickets = myTickets.filter((t) => {
    const q = searchQuery.trim().toLowerCase()
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    const matchDate = isDateInRange(t.created_at, dateFrom, dateTo)
    return matchSearch && matchDate
  })

  const filteredClosedTickets = closedTickets.filter((t) => {
    const q = searchQuery.trim().toLowerCase()
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    const dateToCheck = t.closed_at ?? t.created_at
    const matchDate = isDateInRange(dateToCheck, dateFrom, dateTo)
    return matchSearch && matchDate
  })

  const fetchTeam = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, department, role, avatar_url, user_status")
      .order("name")
    setMembers((data as TeamMember[]) ?? [])
    setLoading(false)
  }, [supabase])

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
    fetchTeam()
  }, [fetchTeam])

  useEffect(() => {
    fetchMyTickets()
  }, [fetchMyTickets])

  useEffect(() => {
    fetchClosedTickets()
  }, [fetchClosedTickets])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel("equipe-profiles-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as Partial<TeamMember> & { id: string }
          if (!row?.id) return
          setMembers((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    name: row.name ?? m.name,
                    email: row.email ?? m.email,
                    department: row.department ?? m.department,
                    role: row.role ?? m.role,
                    avatar_url: row.avatar_url !== undefined ? row.avatar_url : m.avatar_url,
                    user_status: row.user_status !== undefined ? row.user_status : m.user_status,
                  }
                : m
            )
          )
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const start = currentPage * pageSize
  const pageRows = filteredMembers.slice(start, start + pageSize)

  const getAvatarUrl = (avatarUrl: string | null) => {
    if (!avatarUrl?.trim()) return undefined
    // Perfil salva a URL completa; usar direto. Se for só o path do storage, montar a URL.
    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://"))
      return avatarUrl.trim()
    if (!supabase) return undefined
    const { data } = supabase.storage.from("avatars").getPublicUrl(avatarUrl)
    return data?.publicUrl
  }

  const searchPlaceholder =
    activeTab === "equipe"
      ? "Buscar por nome ou e-mail..."
      : "Buscar por título ou descrição do chamado..."

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v)
          setPageIndex(0)
        }}
        className="w-full"
      >
        <div className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9 w-full sm:w-auto">
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="em-atendimentos" className="relative">
              Em atendimentos
              {myTickets.length > 0 && (
                <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-medium text-foreground">
                  {myTickets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="relative">
              Histórico
              {closedTickets.length > 0 && (
                <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-medium text-foreground">
                  {closedTickets.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative w-full sm:w-72">
              <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPageIndex(0)
                }}
                className="pl-9"
                aria-label={activeTab === "equipe" ? "Buscar por nome ou e-mail" : "Buscar chamado"}
              />
            </div>
            {(activeTab === "em-atendimentos" || activeTab === "historico") && (
              <DateRangePicker
                dateLabel={activeTab === "historico" ? "Data de encerramento" : "Data de abertura"}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                compact
              />
            )}
          </div>
        </div>

        <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
          <TabsContent value="equipe" className="mt-0">
            <div className="overflow-hidden rounded-lg border">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[56px]">Foto</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[52px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="w-[56px]">
                            <Avatar className="h-9 w-9">
                              <AvatarImage
                                src={getAvatarUrl(user.avatar_url ?? null)}
                                alt={user.name}
                              />
                              <AvatarFallback className="text-xs">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {user.department ? getSectorLabel(user.department) : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.user_status ? (
                              <StatusPill
                                label={getUserStatusLabel(user.user_status)}
                                variant="custom"
                              />
                            ) : (
                              <StatusPill
                                label={onlineUserIds.has(user.id) ? "Online" : "Offline"}
                                variant={onlineUserIds.has(user.id) ? "online" : "offline"}
                              />
                            )}
                          </TableCell>
                          <TableCell className="w-[52px]">
                            {profile?.id !== user.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <IconDotsVertical className="size-4" />
                                    <span className="sr-only">Ações</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleStartChat(user.id)}
                                    disabled={startingWith === user.id}
                                  >
                                    <IconMessageCircle className="size-4" />
                                    {startingWith === user.id ? "Abrindo..." : "Iniciar conversa"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {!loading && members.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-sm text-muted-foreground">
                  {filteredMembers.length === members.length
                    ? `${members.length} usuário(s)`
                    : `${filteredMembers.length} de ${members.length} usuário(s)`}
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden items-center gap-2 lg:flex">
                    <Label htmlFor="rows-per-page" className="text-sm font-medium">
                      Por página
                    </Label>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPageIndex(0)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-20" id="rows-per-page">
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
            )}
          </TabsContent>

          <TabsContent value="em-atendimentos" className="mt-0">
            {!profile ? (
              <p className="text-muted-foreground py-6">Faça login para ver seus atendimentos.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Chamados em andamento atribuídos a você.
                </p>
                <div className="overflow-hidden rounded-lg border">
                  {filteredMyTickets.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-muted-foreground px-4">
                      {myTickets.length === 0
                        ? "Nenhum chamado em atendimento."
                        : "Nenhum chamado encontrado para a busca ou filtro de data."}
                    </div>
                  ) : (
                    <div className="divide-y p-2">
                      {(() => {
                        const pageCountAtend = Math.max(1, Math.ceil(filteredMyTickets.length / pageSize))
                        const currentPageAtend = Math.min(pageIndex, pageCountAtend - 1)
                        const startAtend = currentPageAtend * pageSize
                        const pageTicketsAtend = filteredMyTickets.slice(startAtend, startAtend + pageSize)
                        return pageTicketsAtend.map((t) => (
                          <Link key={t.id} href={`/dashboard/atendimentos/${t.id}`}>
                            <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md py-2 px-4 border-0 shadow-none rounded-md">
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
                      })()}
                    </div>
                  )}
                </div>
                {profile && filteredMyTickets.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="text-sm text-muted-foreground">
                      {filteredMyTickets.length === myTickets.length
                        ? `${myTickets.length} atendimento(s)`
                        : `${filteredMyTickets.length} de ${myTickets.length} atendimento(s)`}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden items-center gap-2 lg:flex">
                        <Label htmlFor="rows-per-page-atend" className="text-sm font-medium">
                          Por página
                        </Label>
                        <Select
                          value={`${pageSize}`}
                          onValueChange={(v) => {
                            setPageSize(Number(v))
                            setPageIndex(0)
                          }}
                        >
                          <SelectTrigger size="sm" className="w-20" id="rows-per-page-atend">
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
                      {(() => {
                        const pageCountAtend = Math.max(1, Math.ceil(filteredMyTickets.length / pageSize))
                        const currentPageAtend = Math.min(pageIndex, pageCountAtend - 1)
                        return (
                          <>
                            <div className="text-sm font-medium">
                              Página {currentPageAtend + 1} de {pageCountAtend}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPageIndex(0)}
                                disabled={currentPageAtend <= 0}
                                aria-label="Primeira página"
                              >
                                <IconChevronsLeft className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                                disabled={currentPageAtend <= 0}
                                aria-label="Página anterior"
                              >
                                <IconChevronLeft className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setPageIndex((i) => Math.min(pageCountAtend - 1, i + 1))
                                }
                                disabled={currentPageAtend >= pageCountAtend - 1}
                                aria-label="Próxima página"
                              >
                                <IconChevronRight className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPageIndex(pageCountAtend - 1)}
                                disabled={currentPageAtend >= pageCountAtend - 1}
                                aria-label="Última página"
                              >
                                <IconChevronsRight className="size-4" />
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            {!profile ? (
              <p className="text-muted-foreground py-6">Faça login para ver o histórico.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Chamados de outros setores que você atendeu e encerrou.
                </p>
                <div className="overflow-hidden rounded-lg border">
                  {filteredClosedTickets.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-muted-foreground px-4">
                      {closedTickets.length === 0
                        ? "Nenhum atendimento de outro setor encerrado por você."
                        : "Nenhum chamado encontrado para a busca ou filtro de data."}
                    </div>
                  ) : (
                    <div className="divide-y p-2">
                      {(() => {
                        const pageCountHist = Math.max(1, Math.ceil(filteredClosedTickets.length / pageSize))
                        const currentPageHist = Math.min(pageIndex, pageCountHist - 1)
                        const startHist = currentPageHist * pageSize
                        const pageTicketsHist = filteredClosedTickets.slice(startHist, startHist + pageSize)
                        return pageTicketsHist.map((t) => (
                          <Link key={t.id} href={`/dashboard/atendimentos/${t.id}`}>
                            <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md py-2 px-4 border-0 shadow-none rounded-md">
                              <div className="flex items-center justify-between gap-2 min-h-0">
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {t.closed_at ? formatDate(t.closed_at) : formatDate(t.created_at)}
                                  </p>
                                </div>
                              </div>
                            </Card>
                          </Link>
                        ))
                      })()}
                    </div>
                  )}
                </div>
                {profile && filteredClosedTickets.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="text-sm text-muted-foreground">
                      {filteredClosedTickets.length === closedTickets.length
                        ? `${closedTickets.length} chamado(s)`
                        : `${filteredClosedTickets.length} de ${closedTickets.length} chamado(s)`}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden items-center gap-2 lg:flex">
                        <Label htmlFor="rows-per-page-hist" className="text-sm font-medium">
                          Por página
                        </Label>
                        <Select
                          value={`${pageSize}`}
                          onValueChange={(v) => {
                            setPageSize(Number(v))
                            setPageIndex(0)
                          }}
                        >
                          <SelectTrigger size="sm" className="w-20" id="rows-per-page-hist">
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
                      {(() => {
                        const pageCountHist = Math.max(1, Math.ceil(filteredClosedTickets.length / pageSize))
                        const currentPageHist = Math.min(pageIndex, pageCountHist - 1)
                        return (
                          <>
                            <div className="text-sm font-medium">
                              Página {currentPageHist + 1} de {pageCountHist}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPageIndex(0)}
                                disabled={currentPageHist <= 0}
                                aria-label="Primeira página"
                              >
                                <IconChevronsLeft className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                                disabled={currentPageHist <= 0}
                                aria-label="Página anterior"
                              >
                                <IconChevronLeft className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setPageIndex((i) => Math.min(pageCountHist - 1, i + 1))
                                }
                                disabled={currentPageHist >= pageCountHist - 1}
                                aria-label="Próxima página"
                              >
                                <IconChevronRight className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPageIndex(pageCountHist - 1)}
                                disabled={currentPageHist >= pageCountHist - 1}
                                aria-label="Última página"
                              >
                                <IconChevronsRight className="size-4" />
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
