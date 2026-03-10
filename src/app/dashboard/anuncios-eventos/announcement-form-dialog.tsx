"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useAnnouncements } from "@/contexts/announcement-context"
import { useNotifications } from "@/contexts/notification-context"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { IconCalendar, IconPlus, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Announcement, AnnouncementAttachment, AudienceType } from "@/lib/announcements/types"

const BUCKET = "announcement-attachments"
const ACCEPTED = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
const TITLE_MAX = 60

type PendingFile = { file: File; id: string }

function PendingFileChip({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const isImage = file.type.startsWith("image/")
  const [preview, setPreview] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 overflow-hidden">
      {preview ? (
        <img
          src={preview}
          alt=""
          className="size-10 object-cover shrink-0"
        />
      ) : null}
      <span className="truncate max-w-[120px] px-1 text-sm" title={file.name}>
        {file.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 hover:bg-muted shrink-0"
        aria-label="Remover"
      >
        <IconX className="size-3.5" />
      </button>
    </span>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editAnnouncement: Announcement | null
  onSuccess: () => void
}

export function AnnouncementFormDialog({ open, onOpenChange, editAnnouncement, onSuccess }: Props) {
  const supabase = createClient()
  const { profile } = useAuth()
  const { refetchUnread } = useAnnouncements()
  const { refetch: refetchNotifications } = useNotifications()
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [eventDate, setEventDate] = React.useState("")
  const [showAsPopup, setShowAsPopup] = React.useState(false)
  const [audienceType, setAudienceType] = React.useState<AudienceType>("all")
  const [audienceUserIds, setAudienceUserIds] = React.useState<string[]>([])
  const [profiles, setProfiles] = React.useState<Array<{ id: string; name: string }>>([])
  const [profileSearch, setProfileSearch] = React.useState("")
  const [pendingFiles, setPendingFiles] = React.useState<PendingFile[]>([])
  const [existingAttachments, setExistingAttachments] = React.useState<AnnouncementAttachment[]>([])
  const [loading, setLoading] = React.useState(false)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isEdit = !!editAnnouncement

  React.useEffect(() => {
    if (!open) return
    if (editAnnouncement) {
      setTitle(editAnnouncement.title)
      setDescription(editAnnouncement.description ?? "")
      setEventDate(editAnnouncement.event_date ? editAnnouncement.event_date.slice(0, 10) : "")
      setShowAsPopup(editAnnouncement.show_as_popup)
      setExistingAttachments(editAnnouncement.attachments ?? [])
      setAudienceType(editAnnouncement.audience_type ?? "all")
      setAudienceUserIds(editAnnouncement.audience_user_ids ?? [])
      setPendingFiles([])
    } else {
      setTitle("")
      setDescription("")
      setEventDate("")
      setShowAsPopup(false)
      setAudienceType("all")
      setAudienceUserIds([])
      setExistingAttachments([])
      setPendingFiles([])
    }
  }, [open, editAnnouncement])

  React.useEffect(() => {
    if (!open || !supabase) return
    supabase
      .from("profiles")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProfiles((data as Array<{ id: string; name: string }>) ?? []))
  }, [open, supabase])

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    const newOnes: PendingFile[] = []
    for (let i = 0; i < list.length; i++) {
      newOnes.push({ file: list[i]!, id: crypto.randomUUID() })
    }
    setPendingFiles((prev) => [...prev, ...newOnes])
    e.target.value = ""
  }

  const removePending = (id: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id))
  }

  const removeExisting = (id: string) => {
    setExistingAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !profile) {
      toast.error("Faça login para publicar.")
      return
    }
    const titleTrim = title.trim()
    if (!titleTrim) {
      toast.error("Informe o título.")
      return
    }
    setLoading(true)
    try {
      if (isEdit && editAnnouncement) {
        let updateError = (await supabase
          .from("announcements")
          .update({
            title: titleTrim,
            description: description.trim() || null,
            event_date: eventDate || null,
            show_as_popup: showAsPopup,
            audience_type: audienceType,
          })
          .eq("id", editAnnouncement.id)).error
        if (updateError != null) {
          updateError = (await supabase
            .from("announcements")
            .update({
              title: titleTrim,
              description: description.trim() || null,
              event_date: eventDate || null,
              show_as_popup: showAsPopup,
            })
            .eq("id", editAnnouncement.id)).error
        }
        if (updateError) throw updateError
        const { error: delAudErr } = await supabase
          .from("announcement_audience_users")
          .delete()
          .eq("announcement_id", editAnnouncement.id)
        if (delAudErr == null && audienceType === "specific_users" && audienceUserIds.length > 0) {
          await supabase.from("announcement_audience_users").insert(
            audienceUserIds.map((user_id) => ({
              announcement_id: editAnnouncement.id,
              user_id,
            }))
          )
        }
        const toRemove = (editAnnouncement.attachments ?? []).filter(
          (a) => !existingAttachments.some((ex) => ex.id === a.id)
        )
        for (const a of toRemove) {
          await supabase.storage.from(BUCKET).remove([a.file_path])
          await supabase.from("announcement_attachments").delete().eq("id", a.id)
        }
        const aid = editAnnouncement.id
        for (const { file } of pendingFiles) {
          const path = `${aid}/${crypto.randomUUID()}-${file.name}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
          if (upErr) throw upErr
          const { error: insErr } = await supabase.from("announcement_attachments").insert({
            announcement_id: aid,
            file_path: path,
            file_type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document",
            file_name: file.name,
          })
          if (insErr) throw insErr
        }
        toast.success("Anúncio atualizado.")
      } else {
        let result = await supabase
          .from("announcements")
          .insert({
            title: titleTrim,
            description: description.trim() || null,
            event_date: eventDate || null,
            created_by: profile.id,
            show_as_popup: showAsPopup,
            audience_type: audienceType,
          })
          .select("id")
          .single()
        if (result.error) {
          result = await supabase
            .from("announcements")
            .insert({
              title: titleTrim,
              description: description.trim() || null,
              event_date: eventDate || null,
              created_by: profile.id,
              show_as_popup: showAsPopup,
            })
            .select("id")
            .single()
        }
        if (result.error || !result.data) throw result.error ?? new Error("Falha ao criar")
        const aid = result.data.id
        if (audienceType === "specific_users" && audienceUserIds.length > 0) {
          const { error: audErr } = await supabase.from("announcement_audience_users").insert(
            audienceUserIds.map((user_id) => ({ announcement_id: aid, user_id }))
          )
          if (audErr) {
            // table may not exist yet (migration not applied)
          }
        }
        for (const { file } of pendingFiles) {
          const path = `${aid}/${crypto.randomUUID()}-${file.name}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
          if (upErr) throw upErr
          await supabase.from("announcement_attachments").insert({
            announcement_id: aid,
            file_path: path,
            file_type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document",
            file_name: file.name,
          })
        }
        const { data: profilesList } = await supabase.from("profiles").select("id")
        const userIds =
          audienceType === "specific_users" && audienceUserIds.length > 0
            ? audienceUserIds
            : (profilesList ?? []).map((p: { id: string }) => p.id)
        if (userIds.length > 0) {
          await supabase.from("notifications").insert(
            userIds.map((userId: string) => ({
              user_id: userId,
              announcement_id: aid,
              type: "new_announcement",
            }))
          )
        }
        toast.success("Anúncio publicado.")
        await refetchUnread()
        await refetchNotifications()
      }
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar anúncio" : "Criar anúncio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="min-w-0 space-y-4 overflow-hidden">
          <div>
            <Label htmlFor="title">Título</Label>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="Título do anúncio"
                required
                maxLength={TITLE_MAX}
                className="min-w-0 flex-1 overflow-x-auto"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {title.length}/{TITLE_MAX}
              </span>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <Label htmlFor="description">Descrição</Label>
            <div className="mt-1 relative">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                rows={6}
                className="min-h-[140px] max-h-[280px] w-full max-w-full resize-y overflow-y-auto overflow-x-hidden break-words [field-sizing:fixed]"
              />
              <span className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none">
                {description.length} caracteres · rolagem a partir de ~700
              </span>
            </div>
          </div>
          <div>
            <Label>Data do evento</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "mt-1 w-full justify-start text-left font-normal",
                    !eventDate && "text-muted-foreground"
                  )}
                >
                  <IconCalendar className="mr-2 size-4" />
                  {eventDate
                    ? new Date(eventDate + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate ? new Date(eventDate + "T12:00:00") : undefined}
                  onSelect={(d) => {
                    setEventDate(d ? d.toISOString().slice(0, 10) : "")
                    setCalendarOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Quem pode ver este anúncio</Label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience"
                  checked={audienceType === "all"}
                  onChange={() => setAudienceType("all")}
                  className="size-4"
                />
                <span className="text-sm">Todos</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience"
                  checked={audienceType === "specific_users"}
                  onChange={() => setAudienceType("specific_users")}
                  className="size-4"
                />
                <span className="text-sm">Apenas colaboradores escolhidos</span>
              </label>
              {audienceType === "specific_users" && (
                <div className="rounded-md border p-2">
                  <Input
                    placeholder="Buscar por nome..."
                    value={profileSearch}
                    onChange={(e) => setProfileSearch(e.target.value)}
                    className="mb-2 h-8 text-sm"
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {profiles
                      .filter(
                        (p) =>
                          !profileSearch.trim() ||
                          p.name.toLowerCase().includes(profileSearch.trim().toLowerCase())
                      )
                      .map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted"
                        >
                          <Checkbox
                            checked={audienceUserIds.includes(p.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAudienceUserIds((prev) => [...prev, p.id])
                              } else {
                                setAudienceUserIds((prev) => prev.filter((id) => id !== p.id))
                              }
                            }}
                          />
                          <span className="text-sm">{p.name}</span>
                        </label>
                      ))}
                  </div>
                  {audienceUserIds.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {audienceUserIds.length} selecionado(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label>Anexos (imagens, vídeos, áudios, documentos)</Label>
            <div className="mt-2 flex flex-wrap gap-2 items-end">
              {existingAttachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-sm"
                >
                  {a.file_name}
                  <button
                    type="button"
                    onClick={() => removeExisting(a.id)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label="Remover"
                  >
                    <IconX className="size-3.5" />
                  </button>
                </span>
              ))}
              {pendingFiles.map((p) => (
                <PendingFileChip
                  key={p.id}
                  file={p.file}
                  onRemove={() => removePending(p.id)}
                />
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={addFiles}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPlus className="mr-1 size-4" />
                Adicionar
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show_as_popup"
              checked={showAsPopup}
              onCheckedChange={(c) => setShowAsPopup(!!c)}
            />
            <Label htmlFor="show_as_popup" className="cursor-pointer text-sm font-normal">
              Exibir aviso no centro da tela (1x na publicação e 1x no dia do evento)
              {audienceType === "all" ? " para todos" : " para os colaboradores escolhidos"}
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar" : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
