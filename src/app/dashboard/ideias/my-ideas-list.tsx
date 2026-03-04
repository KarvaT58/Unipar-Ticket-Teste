"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconPencil } from "@tabler/icons-react"
import { toast } from "sonner"
import type { EditingIdea } from "./idea-submit-form"

const CATEGORIES: { value: string; label: string }[] = [
  { value: "melhoria", label: "Melhoria de Processo" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "ambiente", label: "Ambiente de Trabalho" },
  { value: "cultura", label: "Cultura" },
  { value: "outros", label: "Outros" },
]

type MyIdea = {
  id: string
  content: string
  category: string
  status: string
  attachment_urls: string[]
  created_at: string
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MyIdeasList({
  onEdit,
  refreshTrigger,
}: {
  onEdit: (idea: EditingIdea) => void
  refreshTrigger?: number
}) {
  const supabase = createClient()
  const { profile } = useAuth()
  const [ideas, setIdeas] = React.useState<MyIdea[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchMyIdeas = React.useCallback(async () => {
    if (!supabase || !profile?.id) {
      setIdeas([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("ideas")
      .select("id, content, category, status, attachment_urls, created_at")
      .eq("submitted_by", profile.id)
      .order("created_at", { ascending: false })
    setLoading(false)
    if (error) {
      toast.error("Não foi possível carregar suas ideias.")
      return
    }
    setIdeas((data as MyIdea[]) ?? [])
  }, [supabase, profile?.id])

  React.useEffect(() => {
    fetchMyIdeas()
  }, [fetchMyIdeas, refreshTrigger])

  if (!profile) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suas ideias enviadas</CardTitle>
        <p className="text-sm text-muted-foreground">
          Histórico das ideias que você enviou. Clique em Editar para alterar texto, categoria ou fotos.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não enviou nenhuma ideia.</p>
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                className="rounded-lg border bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {categoryLabel(idea.category)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(idea.created_at)}
                      </span>
                      {idea.status !== "pendente" && (
                        <Badge variant="outline" className="text-xs">
                          {idea.status}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{idea.content}</p>
                    {(idea.attachment_urls?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {idea.attachment_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-14 w-14 rounded object-cover border"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      onEdit({
                        id: idea.id,
                        content: idea.content,
                        category: idea.category,
                        attachment_urls: idea.attachment_urls ?? [],
                      })
                    }
                  >
                    <IconPencil className="size-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
