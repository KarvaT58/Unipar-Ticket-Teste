"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useIdeas } from "@/contexts/ideas-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Idea = {
  id: string
  content: string
  category: string
  status: string
  admin_response: string | null
  created_at: string
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "melhoria", label: "Melhoria de Processo" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "ambiente", label: "Ambiente de Trabalho" },
  { value: "cultura", label: "Cultura" },
  { value: "outros", label: "Outros" },
]

const STATUSES: { value: string; label: string; variant: "default" | "secondary" | "destructive" | "outline" }[] = [
  { value: "pendente", label: "Pendente", variant: "secondary" },
  { value: "em_analise", label: "Em análise", variant: "outline" },
  { value: "implementado", label: "Implementado", variant: "default" },
  { value: "descartado", label: "Descartado", variant: "destructive" },
]

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays === 0) {
    const diffMins = Math.floor(diffMs / (60 * 1000))
    if (diffMins < 60) return `há ${diffMins} min`
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
    return `há ${diffHours} h`
  }
  if (diffDays === 1) return "ontem"
  if (diffDays < 7) return `há ${diffDays} dias`
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

function statusLabel(value: string): string {
  return STATUSES.find((s) => s.value === value)?.label ?? value
}

function statusVariant(value: string): "default" | "secondary" | "destructive" | "outline" {
  return STATUSES.find((s) => s.value === value)?.variant ?? "secondary"
}

export function IdeaList() {
  const supabase = createClient()
  const { refetchPendingCount } = useIdeas()
  const [ideas, setIdeas] = React.useState<Idea[]>([])
  const [loading, setLoading] = React.useState(true)
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

  const fetchIdeas = React.useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from("ideas")
      .select("id, content, category, status, admin_response, created_at")
      .order("created_at", { ascending: false })
    setLoading(false)
    if (error) {
      toast.error("Não foi possível carregar as ideias.")
      return
    }
    setIdeas((data as Idea[]) ?? [])
  }, [supabase])

  React.useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  const filtered = React.useMemo(() => {
    return ideas.filter((i) => {
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false
      if (statusFilter !== "all" && i.status !== statusFilter) return false
      if (search.trim()) {
        const term = search.trim().toLowerCase()
        if (!i.content.toLowerCase().includes(term)) return false
      }
      return true
    })
  }, [ideas, categoryFilter, statusFilter, search])

  const updateStatus = React.useCallback(
    async (id: string, status: string) => {
      if (!supabase) return
      setUpdatingId(id)
      const { error } = await supabase.from("ideas").update({ status }).eq("id", id)
      setUpdatingId(null)
      if (error) {
        toast.error("Não foi possível atualizar o status.")
        return
      }
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
      void refetchPendingCount()
    },
    [supabase, refetchPendingCount]
  )

  const updateAdminResponse = React.useCallback(
    async (id: string, admin_response: string | null) => {
      if (!supabase) return
      setUpdatingId(id)
      const { error } = await supabase.from("ideas").update({ admin_response }).eq("id", id)
      setUpdatingId(null)
      if (error) {
        toast.error("Não foi possível salvar a resposta.")
        return
      }
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, admin_response } : i)))
    },
    [supabase]
  )

  const pendingCount = ideas.filter((i) => i.status === "pendente").length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Badge variant="outline" className="text-muted-foreground">
          Área restrita — somente TI, Administração e Diretoria
        </Badge>
        <span className="text-sm text-muted-foreground">
          {ideas.length} ideia{ideas.length !== 1 ? "s" : ""} recebida{ideas.length !== 1 ? "s" : ""}
          {pendingCount > 0 && (
            <> · {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</>
          )}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar no texto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ideas.length === 0 ? "Nenhuma ideia enviada ainda." : "Nenhuma ideia corresponde aos filtros."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onStatusChange={(status) => updateStatus(idea.id, status)}
              onAdminResponseChange={(text) => updateAdminResponse(idea.id, text || null)}
              updating={updatingId === idea.id}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function IdeaCard({
  idea,
  onStatusChange,
  onAdminResponseChange,
  updating,
}: {
  idea: Idea
  onStatusChange: (status: string) => void
  onAdminResponseChange: (text: string) => void
  updating: boolean
}) {
  const [responseOpen, setResponseOpen] = React.useState(!!idea.admin_response)
  const [responseDraft, setResponseDraft] = React.useState(idea.admin_response ?? "")

  React.useEffect(() => {
    setResponseDraft(idea.admin_response ?? "")
  }, [idea.admin_response])

  const handleSaveResponse = () => {
    onAdminResponseChange(responseDraft.trim())
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="whitespace-pre-wrap text-sm">{idea.content}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="text-xs">
              {categoryLabel(idea.category)}
            </Badge>
            <Badge variant={statusVariant(idea.status)}>{statusLabel(idea.status)}</Badge>
            <span className="text-xs text-muted-foreground">{formatRelative(idea.created_at)}</span>
          </div>
        </div>
        <Select
          value={idea.status}
          onValueChange={onStatusChange}
          disabled={updating}
        >
          <SelectTrigger className="w-[140px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setResponseOpen((o) => !o)}
        >
          {responseOpen ? <IconChevronUp className="size-4" /> : <IconChevronDown className="size-4" />}
          Resposta interna
        </Button>
        {responseOpen && (
          <div className="space-y-2 pt-2">
            <Label className="text-xs text-muted-foreground">Comentário interno (não visível para quem enviou)</Label>
            <Textarea
              placeholder="Registre um comentário ou feedback interno..."
              value={responseDraft}
              onChange={(e) => setResponseDraft(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <Button size="sm" onClick={handleSaveResponse} disabled={updating}>
              Salvar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
