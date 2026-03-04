"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { IconSearch, IconTicket, IconMessageCircle, IconCalendarEvent, IconCheckbox } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const MAX_RESULTS_PER_TYPE = 5

type SearchResultItem =
  | { type: "ticket"; id: string; title: string }
  | { type: "conversation"; id: string; title: string }
  | { type: "announcement"; id: string; title: string }
  | { type: "task"; id: string; title: string }

function getResultHref(item: SearchResultItem): string {
  switch (item.type) {
    case "ticket":
      return `/dashboard/atendimentos/${item.id}`
    case "conversation":
      return `/dashboard/chat-interno?conversation=${item.id}`
    case "announcement":
      return "/dashboard/anuncios-eventos"
    case "task":
      return "/dashboard/tarefas"
    default:
      return "/dashboard"
  }
}

function getResultLabel(item: SearchResultItem): string {
  switch (item.type) {
    case "ticket":
      return "Chamado"
    case "conversation":
      return "Conversa"
    case "announcement":
      return "Anúncio"
    case "task":
      return "Tarefa"
    default:
      return ""
  }
}

function ResultIcon({ item }: { item: SearchResultItem }) {
  switch (item.type) {
    case "ticket":
      return <IconTicket className="size-4 shrink-0 text-muted-foreground" />
    case "conversation":
      return <IconMessageCircle className="size-4 shrink-0 text-muted-foreground" />
    case "announcement":
      return <IconCalendarEvent className="size-4 shrink-0 text-muted-foreground" />
    case "task":
      return <IconCheckbox className="size-4 shrink-0 text-muted-foreground" />
    default:
      return null
  }
}

export function GlobalSearch() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuth()
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)

  const runSearch = React.useCallback(async () => {
    const q = query.trim().toLowerCase()
    if (q.length < MIN_QUERY_LENGTH || !supabase) {
      setResults([])
      return
    }
    setLoading(true)
    const pattern = `%${q}%`
    try {
      const all: SearchResultItem[] = []

      if (profile?.id) {
        const [ticketsRes, announcementsRes, tasksRes, convRes] = await Promise.all([
          supabase
            .from("tickets")
            .select("id, title")
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .limit(MAX_RESULTS_PER_TYPE),
          supabase
            .from("announcements")
            .select("id, title")
            .ilike("title", pattern)
            .limit(MAX_RESULTS_PER_TYPE),
          supabase
            .from("tasks")
            .select("id, title")
            .eq("user_id", profile.id)
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .limit(MAX_RESULTS_PER_TYPE),
          supabase
            .from("chat_conversations")
            .select("id, user_a_id, user_b_id")
            .or(`user_a_id.eq.${profile.id},user_b_id.eq.${profile.id}`),
        ])

        const tickets = (ticketsRes.data ?? []).map((t) => ({
          type: "ticket" as const,
          id: t.id,
          title: t.title ?? "",
        }))
        all.push(...tickets)

        const announcements = (announcementsRes.data ?? []).map((a) => ({
          type: "announcement" as const,
          id: a.id,
          title: a.title ?? "",
        }))
        all.push(...announcements)

        const tasks = (tasksRes.data ?? []).map((t) => ({
          type: "task" as const,
          id: t.id,
          title: t.title ?? "",
        }))
        all.push(...tasks)

        const convRows = convRes.data ?? []
        const otherIds = convRows.map((c) =>
          c.user_a_id === profile.id ? c.user_b_id : c.user_a_id
        )
        if (otherIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", otherIds)
            .ilike("name", pattern)
          const matchingIds = new Set((profilesData ?? []).map((p) => p.id))
          const conversations: SearchResultItem[] = convRows
            .filter((c) => {
              const otherId = c.user_a_id === profile.id ? c.user_b_id : c.user_a_id
              return matchingIds.has(otherId)
            })
            .slice(0, MAX_RESULTS_PER_TYPE)
            .map((c) => {
              const otherId = c.user_a_id === profile.id ? c.user_b_id : c.user_a_id
              const name = profilesData?.find((p) => p.id === otherId)?.name ?? "Conversa"
              return {
                type: "conversation" as const,
                id: c.id,
                title: name,
              }
            })
          all.push(...conversations)
        }
      } else {
        const [ticketsRes, announcementsRes] = await Promise.all([
          supabase
            .from("tickets")
            .select("id, title")
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .limit(MAX_RESULTS_PER_TYPE),
          supabase
            .from("announcements")
            .select("id, title")
            .ilike("title", pattern)
            .limit(MAX_RESULTS_PER_TYPE),
        ])
        all.push(
          ...(ticketsRes.data ?? []).map((t) => ({
            type: "ticket" as const,
            id: t.id,
            title: t.title ?? "",
          })),
          ...(announcementsRes.data ?? []).map((a) => ({
            type: "announcement" as const,
            id: a.id,
            title: a.title ?? "",
          }))
        )
      }

      setResults(all)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, supabase, profile?.id])

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(runSearch, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  const showPopover = open
  const hasResults = results.length > 0

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
    router.push(getResultHref(item))
  }

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative flex flex-1 max-w-md">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Buscar conversas, chamados e mais..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false)
                inputRef.current?.blur()
              }
            }}
            className="pl-9 h-9 bg-muted/50"
            aria-label="Busca geral"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverRef}
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-h-[70vh] overflow-hidden p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Buscando...
          </div>
        ) : query.trim().length < MIN_QUERY_LENGTH ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Digite ao menos {MIN_QUERY_LENGTH} caracteres para buscar
          </div>
        ) : !hasResults ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhum resultado encontrado
          </div>
        ) : (
          <ul className="max-h-[70vh] overflow-auto py-1">
            {results.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                    "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none"
                  )}
                >
                  <ResultIcon item={item} />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{getResultLabel(item)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
