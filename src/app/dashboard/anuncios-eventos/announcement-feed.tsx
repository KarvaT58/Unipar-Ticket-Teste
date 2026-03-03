"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useAnnouncements } from "@/contexts/announcement-context"
import { IconCalendarEvent, IconPencil, IconTrash, IconChevronDown } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AnnouncementFormDialog } from "./announcement-form-dialog"
import { toast } from "sonner"
import type { Announcement, AnnouncementAttachment } from "@/lib/announcements/types"

const BUCKET = "announcement-attachments"
const HIGHLIGHT_DAYS = 3

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isHighlighted(createdAt: string) {
  const created = new Date(createdAt).getTime()
  const limit = Date.now() - HIGHLIGHT_DAYS * 24 * 60 * 60 * 1000
  return created >= limit
}

export function AnnouncementFeed() {
  const supabase = createClient()
  const { profile } = useAuth()
  const { markAnnouncementsAsRead } = useAnnouncements()
  const [list, setList] = React.useState<(Announcement & { creator_name?: string })[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editAnnouncement, setEditAnnouncement] = React.useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<(Announcement & { creator_name?: string }) | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [viewAnnouncement, setViewAnnouncement] = React.useState<(Announcement & { creator_name?: string }) | null>(null)

  const fetchList = React.useCallback(async () => {
    if (!supabase) return
    const { data: rows, error } = await supabase
      .from("announcements")
      .select(`
        id,
        title,
        description,
        event_date,
        created_by,
        created_at,
        updated_at,
        show_as_popup,
        announcement_attachments (id, file_path, file_type, file_name, created_at)
      `)
      .order("created_at", { ascending: false })
    if (error) {
      setList([])
      setLoading(false)
      return
    }
    const withCreator = await Promise.all(
      (rows ?? []).map(async (r: Record<string, unknown>) => {
        const { data: creator } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", r.created_by)
          .single()
        return {
          ...r,
          attachments: (r.announcement_attachments as AnnouncementAttachment[]) ?? [],
          creator_name: (creator as { name?: string })?.name ?? "Equipe",
        } as Announcement & { creator_name: string }
      })
    )
    setList(withCreator)
    setLoading(false)
  }, [supabase])

  React.useEffect(() => {
    markAnnouncementsAsRead()
  }, [markAnnouncementsAsRead])

  React.useEffect(() => {
    fetchList()
  }, [fetchList])

  const openCreate = () => {
    setEditAnnouncement(null)
    setDialogOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setEditAnnouncement(a)
    setDialogOpen(true)
  }

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!supabase || !deleteTarget) return
    setDeleting(true)
    try {
      const attachments = deleteTarget.attachments ?? []
      for (const att of attachments) {
        await supabase.storage.from(BUCKET).remove([att.file_path])
      }
      const { error } = await supabase.from("announcements").delete().eq("id", deleteTarget.id)
      if (error) throw error
      toast.success("Anúncio excluído.")
      setDeleteTarget(null)
      fetchList()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir."
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }, [supabase, deleteTarget, fetchList])

  const getAttachmentUrl = React.useCallback(
    async (path: string): Promise<string | null> => {
      if (!supabase) return null
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
      return data?.signedUrl ?? null
    },
    [supabase]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Anúncio/Eventos</h1>
        <Button onClick={openCreate}>
          <IconCalendarEvent className="mr-2 size-4" />
          Criar anúncio
        </Button>
      </div>

      <AnnouncementFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editAnnouncement={editAnnouncement}
        onSuccess={fetchList}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anúncio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este anúncio? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteConfirm()
              }}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            Nenhum anúncio ainda. Crie o primeiro usando o menu acima.
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="min-w-0 space-y-4">
            {list.map((a) => (
              <li key={a.id} className="min-w-0">
                <Card className={`overflow-hidden ${isHighlighted(a.created_at) ? "border-primary/50 bg-primary/5" : ""}`}>
                  <CardHeader className="min-w-0 overflow-hidden pb-2">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="min-w-0 truncate font-semibold">{a.title}</h2>
                          {isHighlighted(a.created_at) && (
                            <Badge variant="secondary" className="shrink-0 text-xs">Destaque</Badge>
                          )}
                        </div>
                        {a.description && (
                          <div className="min-w-0 overflow-hidden">
                            <p
                              className="min-w-0 overflow-hidden break-all text-sm text-muted-foreground"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {a.description}
                            </p>
                          </div>
                        )}
                        {a.event_date && (
                          <p className="min-w-0 text-xs text-muted-foreground">
                            Data do evento: {formatDate(a.event_date)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewAnnouncement(a)}
                        >
                          <IconChevronDown className="mr-1 size-4" />
                          Ver mais
                        </Button>
                        {profile?.id === a.created_by && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                              <IconPencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(a)}
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden pt-0">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      Publicado por {a.creator_name} em {formatDateTime(a.created_at)}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <Dialog open={!!viewAnnouncement} onOpenChange={(open) => !open && setViewAnnouncement(null)}>
          <DialogContent className="max-w-lg min-w-0 overflow-hidden">
            {viewAnnouncement && (
              <>
                <DialogHeader>
                  <DialogTitle className="break-words pr-8">{viewAnnouncement.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {viewAnnouncement.description && (
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descrição</p>
                      <div className="mt-0.5 max-h-[240px] min-w-0 overflow-x-hidden overflow-y-auto rounded-md border bg-muted/30 px-3 py-2">
                        <p className="whitespace-pre-wrap break-all text-sm">{viewAnnouncement.description}</p>
                      </div>
                    </div>
                  )}
                  {viewAnnouncement.event_date && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data do evento</p>
                      <p className="mt-0.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                        {formatDate(viewAnnouncement.event_date)}
                      </p>
                    </div>
                  )}
                  {(viewAnnouncement.attachments?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Anexos</p>
                      <div className="mt-0.5 flex flex-wrap gap-2">
                        {viewAnnouncement.attachments!.map((att) => (
                          <AttachmentLink
                            key={att.id}
                            attachment={att}
                            getUrlAsync={getAttachmentUrl}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Publicado por {viewAnnouncement.creator_name} em {formatDateTime(viewAnnouncement.created_at)}
                  </p>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
        </>
      )}
    </div>
  )
}

function AttachmentLink({
  attachment,
  getUrlAsync,
}: {
  attachment: AnnouncementAttachment
  getUrlAsync: (path: string) => Promise<string | null>
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    getUrlAsync(attachment.file_path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => { cancelled = true }
  }, [attachment.file_path, getUrlAsync])
  const isImage = attachment.file_type === "image"
  if (!url) return <span className="text-sm text-muted-foreground">{attachment.file_name}</span>
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.file_name}
          className="h-20 w-20 rounded border object-cover"
        />
      </a>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary underline"
    >
      {attachment.file_name}
    </a>
  )
}
