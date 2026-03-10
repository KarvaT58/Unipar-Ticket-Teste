"use client"

import * as React from "react"
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  getDate,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useAnnouncements } from "@/contexts/announcement-context"
import {
  IconCalendarEvent,
  IconPencil,
  IconTrash,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
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
import { Calendar } from "@/components/ui/calendar"
import { AnnouncementFormDialog } from "./announcement-form-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Announcement, AnnouncementAttachment } from "@/lib/announcements/types"

const BUCKET = "announcement-attachments"
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

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

function parseEventDate(d: string | null): Date | null {
  if (!d) return null
  try {
    return parseISO(d + "T12:00:00")
  } catch {
    return null
  }
}

function getAnnouncementsForMonth(
  list: (Announcement & { creator_name?: string })[],
  year: number,
  month: number
) {
  return list.filter((a) => {
    const ed = parseEventDate(a.event_date)
    if (!ed) return false
    return ed.getFullYear() === year && ed.getMonth() === month - 1
  })
}

function getAnnouncementsForDay(
  list: (Announcement & { creator_name?: string })[],
  date: Date
) {
  return list.filter((a) => {
    const ed = parseEventDate(a.event_date)
    if (!ed) return false
    return isSameDay(ed, date)
  })
}

export function AnnouncementFeed() {
  const supabase = createClient()
  const { profile } = useAuth()
  const { markAnnouncementsAsRead } = useAnnouncements()
  const [list, setList] = React.useState<(Announcement & { creator_name?: string })[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentMonth, setCurrentMonth] = React.useState(() => new Date())
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editAnnouncement, setEditAnnouncement] = React.useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<(Announcement & { creator_name?: string }) | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [viewAnnouncement, setViewAnnouncement] = React.useState<(Announcement & { creator_name?: string }) | null>(null)

  const fetchList = React.useCallback(async () => {
    if (!supabase) return
    const legacySelect = `
        id,
        title,
        description,
        event_date,
        created_by,
        created_at,
        updated_at,
        show_as_popup,
        announcement_attachments (id, file_path, file_type, file_name, created_at)
      `
    const { data: rows, error } = await supabase
      .from("announcements")
      .select(
        `
        id,
        title,
        description,
        event_date,
        created_by,
        created_at,
        updated_at,
        show_as_popup,
        audience_type,
        announcement_attachments (id, file_path, file_type, file_name, created_at),
        announcement_audience_users (user_id)
      `
      )
      .order("created_at", { ascending: false })
    let data = rows
    let err = error
    if (err) {
      const fallback = await supabase
        .from("announcements")
        .select(legacySelect)
        .order("created_at", { ascending: false })
      if (fallback.error) {
        setList([])
        setLoading(false)
        return
      }
      data = fallback.data
      err = null
    }
    const withCreator = await Promise.all(
      (data ?? []).map(async (r: Record<string, unknown>) => {
        const { data: creator } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", r.created_by)
          .single()
        const audienceUsers = (r.announcement_audience_users as { user_id: string }[] | undefined) ?? []
        return {
          ...r,
          attachments: (r.announcement_attachments as AnnouncementAttachment[]) ?? [],
          creator_name: (creator as { name?: string })?.name ?? "Equipe",
          audience_type: (r.audience_type as "all" | "specific_users") ?? "all",
          audience_user_ids: audienceUsers.map((u) => u.user_id),
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

  const y = currentMonth.getFullYear()
  const m = currentMonth.getMonth()
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { locale: ptBR })
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const monthAnnouncements = getAnnouncementsForMonth(list, y, m + 1)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
      <aside className="flex w-[17rem] shrink-0 flex-col gap-4">
        <div className="overflow-visible rounded-lg border bg-card p-2">
          <div className="flex items-center justify-between px-1 pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setCurrentMonth((d) => subMonths(d, 1))}
              aria-label="Mês anterior"
            >
              <IconChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
              aria-label="Próximo mês"
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
          <Calendar
            mode="single"
            month={currentMonth}
            onMonthChange={(month) => month && setCurrentMonth(month)}
            selected={undefined}
            onSelect={() => {}}
            locale={ptBR}
            fixedWeeks={false}
            className="min-w-0 [--cell-size:2rem]"
            classNames={{
              month_caption: "hidden",
              nav: "hidden",
              today: "rounded-md bg-primary/20 font-medium text-primary",
            }}
            formatters={{
              formatWeekdayName: (date) =>
                format(date, "EEEEEE", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
            }}
            modifiers={{
              event: (date) => getAnnouncementsForDay(list, date).length > 0,
            }}
            modifiersClassNames={{
              event: "bg-destructive/15 text-destructive font-medium",
            }}
            disabled={() => true}
            showOutsideDays
          />
        </div>
        <Button onClick={openCreate} className="w-full">
          <IconCalendarEvent className="mr-2 size-4" />
          Criar anúncio
        </Button>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            Eventos do mês
          </p>
          <ul className="max-h-64 overflow-y-auto p-2">
            {loading ? (
              <li className="py-2 text-center text-sm text-muted-foreground">Carregando...</li>
            ) : monthAnnouncements.length === 0 ? (
              <li className="py-2 text-center text-sm text-muted-foreground">Nenhum evento</li>
            ) : (
              monthAnnouncements
                .sort((a, b) => {
                  const da = parseEventDate(a.event_date)?.getTime() ?? 0
                  const db = parseEventDate(b.event_date)?.getTime() ?? 0
                  return da - db
                })
                .map((a) => {
                  const ed = parseEventDate(a.event_date)
                  const dayNum = ed ? getDate(ed) : null
                  return (
                    <li key={a.id} className="mb-1">
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => setViewAnnouncement(a)}
                      >
                        <span className="font-medium text-destructive">{dayNum}</span>
                        <span className="ml-1 truncate text-muted-foreground">{a.title}</span>
                      </button>
                    </li>
                  )
                })
            )}
          </ul>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="text-lg font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth((d) => subMonths(d, 1))}
                  aria-label="Mês anterior"
                >
                  <IconChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
                  aria-label="Próximo mês"
                >
                  <IconChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>
            <div
              className="grid min-h-0 flex-1 grid-cols-7 gap-px pt-1"
              style={{
                gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(0, 1fr))`,
              }}
            >
              {days.map((day) => {
                const dayEvents = getAnnouncementsForDay(list, day)
                const hasEvent = dayEvents.length > 0
                const isCurrentMonth = isSameMonth(day, currentMonth)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex min-h-0 flex-col overflow-hidden rounded-md border bg-background p-1",
                      !isCurrentMonth && "opacity-40"
                    )}
                  >
                    <div className="flex shrink-0 items-center justify-between">
                      <span
                        className={cn(
                          "text-sm",
                          isToday(day) && "font-semibold text-primary"
                        )}
                      >
                        {getDate(day)}
                      </span>
                      {hasEvent && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-destructive"
                          title={dayEvents.map((e) => e.title).join(", ")}
                          aria-hidden
                        />
                      )}
                    </div>
                    {hasEvent && (
                      <div className="mt-0.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                        {dayEvents.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="block w-full truncate rounded bg-destructive/15 px-1 py-0.5 text-left text-xs text-destructive hover:bg-destructive/25"
                            onClick={() => setViewAnnouncement(a)}
                          >
                            {a.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() => setViewAnnouncement(dayEvents[3])}
                          >
                            +{dayEvents.length - 3}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Descrição
                    </p>
                    <div className="mt-0.5 max-h-[240px] min-w-0 overflow-x-hidden overflow-y-auto rounded-md border bg-muted/30 px-3 py-2">
                      <p className="whitespace-pre-wrap break-all text-sm">
                        {viewAnnouncement.description}
                      </p>
                    </div>
                  </div>
                )}
                {viewAnnouncement.event_date && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Data do evento
                    </p>
                    <p className="mt-0.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                      {formatDate(viewAnnouncement.event_date)}
                    </p>
                  </div>
                )}
                {(viewAnnouncement.attachments?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Anexos
                    </p>
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
                  Publicado por {viewAnnouncement.creator_name} em{" "}
                  {formatDateTime(viewAnnouncement.created_at)}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {profile?.id === viewAnnouncement.created_by && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(viewAnnouncement)}>
                        <IconPencil className="mr-1 size-4" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget(viewAnnouncement)
                          setViewAnnouncement(null)
                        }}
                      >
                        <IconTrash className="mr-1 size-4" />
                        Excluir
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setViewAnnouncement(null)}>
                    <IconChevronDown className="mr-1 size-4" />
                    Fechar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
    return () => {
      cancelled = true
    }
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
