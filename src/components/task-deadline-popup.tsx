"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTasks } from "@/contexts/task-context"
import { useAuth } from "@/contexts/auth-context"

const LOCK_SECONDS = 5

function formatDue(task: { due_date: string | null; due_time: string | null }): string {
  if (task.due_date && task.due_time) {
    return `${task.due_date} às ${task.due_time}`
  }
  if (task.due_date) return task.due_date
  if (task.due_time) return task.due_time
  return ""
}

export function TaskDeadlinePopup() {
  const router = useRouter()
  const { profile } = useAuth()
  const { deadlinePopup, dismissDeadlinePopup } = useTasks()
  const [secondsLeft, setSecondsLeft] = React.useState(LOCK_SECONDS)
  const canClose = secondsLeft <= 0

  React.useEffect(() => {
    if (!deadlinePopup) {
      setSecondsLeft(LOCK_SECONDS)
      return
    }
    setSecondsLeft(LOCK_SECONDS)
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [deadlinePopup?.id])

  const handleViewTask = React.useCallback(() => {
    if (!deadlinePopup || !canClose) return
    dismissDeadlinePopup()
    router.push("/dashboard/tarefas")
  }, [deadlinePopup, canClose, dismissDeadlinePopup, router])

  const handleClose = React.useCallback(() => {
    if (!canClose) return
    dismissDeadlinePopup()
  }, [canClose, dismissDeadlinePopup])

  if (!profile) return null

  return (
    <Dialog
      open={!!deadlinePopup}
      onOpenChange={(open) => {
        if (open === false && canClose) handleClose()
      }}
    >
      <DialogContent
        className="max-w-md sm:max-w-lg min-w-0 overflow-hidden"
        showCloseButton={false}
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="pr-8">Prazo da tarefa</DialogTitle>
          <DialogDescription asChild>
            <span className="text-muted-foreground">
              {deadlinePopup ? "Uma tarefa está no prazo ou vencida." : ""}
            </span>
          </DialogDescription>
        </DialogHeader>
        {deadlinePopup && (
          <div className="min-w-0 space-y-4 overflow-hidden">
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tarefa</p>
              <div className="mt-0.5 max-h-[180px] min-w-0 overflow-x-hidden overflow-y-auto rounded-md border bg-muted/30 px-3 py-2">
                <p className="font-medium">{deadlinePopup.title}</p>
                {deadlinePopup.description && (
                  <p className="mt-1 whitespace-pre-wrap break-all text-sm text-muted-foreground">
                    {deadlinePopup.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Prazo: {formatDue(deadlinePopup)}</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 pt-2">
          {!canClose && (
            <p className="text-center text-sm text-muted-foreground">
              Você poderá fechar em <strong>{secondsLeft}</strong> segundo(s).
            </p>
          )}
          {canClose && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
              <Button variant="default" className="flex-1" onClick={handleViewTask}>
                Ver tarefa
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
