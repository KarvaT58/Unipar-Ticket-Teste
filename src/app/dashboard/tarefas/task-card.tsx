"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Task } from "@/lib/tasks/types"
import { cn } from "@/lib/utils"
import { IconPaperclip, IconTrash, IconCalendarDue } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
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

const PRIORITY_STYLES: Record<string, { bg: string; label: string }> = {
  low: { bg: "bg-emerald-500/90 text-white", label: "Baixa" },
  medium: { bg: "bg-amber-500/90 text-white", label: "Média" },
  high: { bg: "bg-red-500/90 text-white", label: "Alta" },
}

const PRIORITY_BORDER: Record<string, string> = {
  low: "border-l-emerald-500",
  medium: "border-l-amber-500",
  high: "border-l-red-500",
}

function getDueStatus(task: Task): "ok" | "soon" | "overdue" {
  if (!task.due_date && !task.due_time) return "ok"
  const now = new Date()
  let due: Date
  if (task.due_date && task.due_time) {
    due = new Date(`${task.due_date}T${task.due_time}`)
  } else if (task.due_date) {
    due = new Date(task.due_date + "T23:59:59")
  } else {
    const [h, m] = (task.due_time ?? "00:00").split(":").map(Number)
    due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  }
  if (due.getTime() < now.getTime()) return "overdue"
  const fifteenMin = 15 * 60 * 1000
  if (due.getTime() - now.getTime() <= fifteenMin) return "soon"
  return "ok"
}

function formatDueShort(task: Task): string {
  if (task.due_date && task.due_time) return `${task.due_date} ${task.due_time}`
  if (task.due_date) return task.due_date
  if (task.due_time) return task.due_time
  return ""
}

function formatDueRelative(task: Task): string {
  if (!task.due_date && !task.due_time) return ""
  const now = new Date()
  let due: Date
  if (task.due_date && task.due_time) {
    due = new Date(`${task.due_date}T${task.due_time}`)
  } else if (task.due_date) {
    due = new Date(task.due_date + "T23:59:59")
  } else {
    const [h, m] = (task.due_time ?? "00:00").split(":").map(Number)
    due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  }
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  const diffHours = Math.round(diffMs / (60 * 60 * 1000))
  if (diffMs < 0) {
    if (diffDays === 0) return "Atrasada"
    if (diffDays === -1) return "Ontem"
    return `${Math.abs(diffDays)} dias atrás`
  }
  if (diffDays === 0) {
    if (diffHours < 1) return "Em breve"
    return `Hoje`
  }
  if (diffDays === 1) return "Amanhã"
  return `Em ${diffDays} dias`
}

type TaskCardProps = {
  task: Task
  onClick: () => void
  onDelete: (taskId: string) => void
  attachmentCount?: number
}

export function TaskCard({ task, onClick, onDelete, attachmentCount = 0 }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dueStatus = getDueStatus(task)
  const dueShort = formatDueShort(task)
  const dueRelative = formatDueRelative(task)
  const priorityStyle = task.priority ? PRIORITY_STYLES[task.priority] : null
  const priorityBorder = task.priority ? PRIORITY_BORDER[task.priority] : ""

  const handleConfirmDelete = React.useCallback(async () => {
    setDeleting(true)
    try {
      await Promise.resolve(onDelete(task.id))
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }, [task.id, onDelete])

  return (
    <>
      <li
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative cursor-grab rounded-lg border bg-card text-left shadow-sm transition-all active:cursor-grabbing hover:shadow-md",
          isDragging && "z-50 rotate-1 opacity-95 shadow-lg",
          dueStatus === "overdue" && "border-red-500/50",
          task.priority && `border-l-4 ${priorityBorder}`
        )}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return
          onClick()
        }}
      >
        <div className="flex items-start gap-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{task.title || "Sem título"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {priorityStyle && (
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", priorityStyle.bg)}>
                  {priorityStyle.label}
                </span>
              )}
              {dueShort && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px]",
                    dueStatus === "overdue" && "text-red-600 dark:text-red-400",
                    dueStatus === "soon" && "text-amber-600 dark:text-amber-400",
                    dueStatus === "ok" && "text-muted-foreground"
                  )}
                  title={dueShort}
                >
                  <IconCalendarDue className="size-3 shrink-0" />
                  {dueRelative || dueShort}
                </span>
              )}
              {task.tags?.length > 0 &&
                task.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              {attachmentCount > 0 && (
                <span className="flex items-center gap-0.5 text-muted-foreground" title="Anexos">
                  <IconPaperclip className="size-3" />
                  <span className="text-[10px]">{attachmentCount}</span>
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 opacity-100 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:ring-2 sm:opacity-0"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteOpen(true)
            }}
            title="Excluir tarefa"
          >
            <IconTrash className="size-3.5 text-destructive" />
          </Button>
        </div>
      </li>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{task.title || "Sem título"}&quot; será excluída permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deleting}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
