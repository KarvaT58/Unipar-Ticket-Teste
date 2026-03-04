"use client"

import * as React from "react"
import { useTasks } from "@/contexts/task-context"
import type { Task, TaskPriority, TaskAttachment } from "@/lib/tasks/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { IconPaperclip, IconTrash } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const ACCEPT_ATTACHMENTS = "image/*,video/*,audio/*,.mp3,.pdf,.doc,.docx,.xls,.xlsx,.txt"

type DueMode = "none" | "date" | "time" | "datetime"

type TaskDialogProps = {
  taskId: string | null
  boardId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDialog({ taskId, boardId, open, onOpenChange }: TaskDialogProps) {
  const {
    boards,
    tasksByBoardId,
    attachmentsByTaskId,
    createTask,
    updateTask,
    deleteTask,
    addAttachment,
    removeAttachment,
    getAttachmentUrl,
    refetchAttachmentsForTask,
  } = useTasks()

  const task = React.useMemo((): Task | null => {
    if (!taskId) return null
    for (const b of boards) {
      const t = (tasksByBoardId[b.id] ?? []).find((x) => x.id === taskId)
      if (t) return t
    }
    return null
  }, [taskId, boards, tasksByBoardId])

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [priority, setPriority] = React.useState<TaskPriority | "">("")
  const [tagsStr, setTagsStr] = React.useState("")
  const [dueMode, setDueMode] = React.useState<DueMode>("none")
  const [dueDate, setDueDate] = React.useState("")
  const [dueTime, setDueTime] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? "")
      setPriority((task.priority ?? "") as TaskPriority | "")
      setTagsStr((task.tags ?? []).join(", "))
      if (task.due_date && task.due_time) {
        setDueMode("datetime")
        setDueDate(task.due_date)
        setDueTime(task.due_time)
      } else if (task.due_date) {
        setDueMode("date")
        setDueDate(task.due_date)
        setDueTime("")
      } else if (task.due_time) {
        setDueMode("time")
        setDueDate("")
        setDueTime(task.due_time)
      } else {
        setDueMode("none")
        setDueDate("")
        setDueTime("")
      }
      void refetchAttachmentsForTask(task.id)
    } else if (boardId) {
      setTitle("")
      setDescription("")
      setPriority("")
      setTagsStr("")
      setDueMode("none")
      setDueDate("")
      setDueTime("")
    }
  }, [open, task, boardId, refetchAttachmentsForTask])

  const attachments = taskId ? (attachmentsByTaskId[taskId] ?? []) : []

  const handleSubmit = React.useCallback(async () => {
    const payload = {
      title: title.trim() || "Nova tarefa",
      description: description.trim() || null,
      priority: (priority || null) as TaskPriority | null,
      tags: tagsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      due_date: dueMode === "date" || dueMode === "datetime" ? dueDate || null : null,
      due_time: dueMode === "time" || dueMode === "datetime" ? dueTime || null : null,
    }
    setSaving(true)
    try {
      if (taskId) {
        await updateTask(taskId, payload)
      } else if (boardId) {
        await createTask(boardId, payload)
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }, [
    title,
    description,
    priority,
    tagsStr,
    dueMode,
    dueDate,
    dueTime,
    taskId,
    boardId,
    updateTask,
    createTask,
    onOpenChange,
  ])

  const handleDelete = React.useCallback(async () => {
    if (!taskId) return
    if (!confirm("Excluir esta tarefa?")) return
    setSaving(true)
    try {
      await deleteTask(taskId)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }, [taskId, deleteTask, onOpenChange])

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !taskId) return
      setUploading(true)
      try {
        await addAttachment(taskId, file)
      } finally {
        setUploading(false)
        e.target.value = ""
      }
    },
    [taskId, addAttachment]
  )

  const isCreate = !taskId && !!boardId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Nova tarefa" : "Editar tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority | "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-tags">Tags (separadas por vírgula)</Label>
            <Input
              id="task-tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="ex: urgente, cliente-x"
            />
          </div>
          <div className="grid gap-2">
            <Label>Prazo</Label>
            <Select value={dueMode} onValueChange={(v) => setDueMode(v as DueMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem prazo</SelectItem>
                <SelectItem value="date">Só data</SelectItem>
                <SelectItem value="time">Só horário</SelectItem>
                <SelectItem value="datetime">Data e horário</SelectItem>
              </SelectContent>
            </Select>
            {(dueMode === "date" || dueMode === "datetime") && (
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="dd/mm/aaaa"
                className="mt-1"
              />
            )}
            {(dueMode === "time" || dueMode === "datetime") && (
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1"
              />
            )}
          </div>
          {taskId && (
            <div className="grid gap-2">
              <Label>Anexos</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPT_ATTACHMENTS}
                onChange={handleFileChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconPaperclip className="size-4 mr-1" />
                  {uploading ? "Enviando…" : "Anexar"}
                </Button>
                {attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {attachments.map((att) => (
                      <AttachmentItem
                        key={att.id}
                        attachment={att}
                        getUrl={getAttachmentUrl}
                        onRemove={() => removeAttachment(att.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {taskId && (
            <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto" disabled={saving}>
              Excluir
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando…" : isCreate ? "Criar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AttachmentItem({
  attachment,
  getUrl,
  onRemove,
}: {
  attachment: TaskAttachment
  getUrl: (path: string) => Promise<string | null>
  onRemove: () => void
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    getUrl(attachment.file_path).then((u) => {
      if (!cancelled) setUrl(u ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [attachment.file_path, getUrl])
  const isImage = attachment.file_type?.startsWith("image/")
  return (
    <li className="flex items-center gap-1 rounded border bg-muted/50 px-2 py-1 text-xs">
      {isImage && url && (
        <img src={url} alt="" className="size-8 rounded object-cover" />
      )}
      <span className="max-w-[120px] truncate" title={attachment.file_name}>
        {attachment.file_name}
      </span>
      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={onRemove} title="Remover">
        <IconTrash className="size-3" />
      </Button>
    </li>
  )
}
