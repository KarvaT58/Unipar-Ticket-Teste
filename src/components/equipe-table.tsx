"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleFilled,
  IconSearch,
  IconDotsVertical,
  IconMessageCircle,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { usePresence } from "@/contexts/presence-context"
import { useChat } from "@/contexts/chat-context"
import { useAuth } from "@/contexts/auth-context"
import { getSectorLabel } from "@/lib/atendimento/sectors"

type TeamMember = {
  id: string
  name: string
  email: string
  department: string
  role: string
  avatar_url: string | null
}

const PAGE_SIZES = [10, 20, 30, 50]

export function EquipeTable() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuth()
  const { onlineUserIds } = usePresence()
  const { startConversation } = useChat()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [startingWith, setStartingWith] = useState<string | null>(null)

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

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return m.name.toLowerCase().includes(q)
  })

  const fetchTeam = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, department, role, avatar_url")
      .order("name")
    setMembers((data as TeamMember[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

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

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Equipe</h2>
        <div className="relative w-full sm:w-72">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPageIndex(0)
            }}
            className="pl-9"
            aria-label="Buscar usuário por nome"
          />
        </div>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
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
                    <TableCell colSpan={5} className="h-24 text-center">
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
                        <Badge
                          variant="outline"
                          className={
                            onlineUserIds.has(user.id)
                              ? "gap-1 border-emerald-500/50 bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-400"
                              : "gap-1 font-normal text-muted-foreground"
                          }
                        >
                          <IconCircleFilled
                            className={
                              onlineUserIds.has(user.id)
                                ? "size-2.5 fill-emerald-500"
                                : "size-2.5 fill-muted-foreground"
                            }
                          />
                          {onlineUserIds.has(user.id) ? "Online" : "Offline"}
                        </Badge>
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
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
      </div>
    </div>
  )
}
