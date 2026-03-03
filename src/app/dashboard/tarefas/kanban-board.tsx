"use client"

import * as React from "react"
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import { useTasks } from "@/contexts/task-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlus, IconLayoutKanban } from "@tabler/icons-react"
import { KanbanColumn } from "./kanban-column"
import { TaskDialog } from "./task-dialog"
import { cn } from "@/lib/utils"

export function KanbanBoard() {
  const {
    boards,
    tasksByBoardId,
    createBoard,
    createTask,
    moveTask,
    reorderTasks,
    isLoading,
  } = useTasks()
  const [newColumnName, setNewColumnName] = React.useState("")
  const [showNewColumn, setShowNewColumn] = React.useState(false)
  const [taskDialogTaskId, setTaskDialogTaskId] = React.useState<string | null>(null)
  const [taskDialogBoardId, setTaskDialogBoardId] = React.useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } })
  )

  const allTaskIds = React.useMemo(
    () => new Set(boards.flatMap((b) => (tasksByBoardId[b.id] ?? []).map((t) => t.id))),
    [boards, tasksByBoardId]
  )
  const boardIdsSet = React.useMemo(() => new Set(boards.map((b) => b.id)), [boards])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const taskId = String(active.id)
      const overId = String(over.id)
      const sourceBoard = boards.find((b) => (tasksByBoardId[b.id] ?? []).some((t) => t.id === taskId))
      if (!sourceBoard) return
      const sourceTasks = tasksByBoardId[sourceBoard.id] ?? []
      const sourceIndex = sourceTasks.findIndex((t) => t.id === taskId)
      if (sourceIndex < 0) return

      if (boardIdsSet.has(overId)) {
        const targetBoardId = overId
        if (targetBoardId === sourceBoard.id) return
        const targetTasks = tasksByBoardId[targetBoardId] ?? []
        const newPosition = targetTasks.length
        void moveTask(taskId, targetBoardId, newPosition)
        return
      }

      if (allTaskIds.has(overId)) {
        let targetBoardId: string | null = null
        let targetIndex = -1
        for (const board of boards) {
          const tasks = tasksByBoardId[board.id] ?? []
          const idx = tasks.findIndex((t) => t.id === overId)
          if (idx >= 0) {
            targetBoardId = board.id
            targetIndex = idx
            break
          }
        }
        if (targetBoardId == null || targetIndex < 0) return
        const targetTasks = tasksByBoardId[targetBoardId] ?? []
        if (sourceBoard.id === targetBoardId) {
          const reordered = [...targetTasks]
          const fromIdx = reordered.findIndex((t) => t.id === taskId)
          if (fromIdx < 0) return
          const [removed] = reordered.splice(fromIdx, 1)
          const insertIdx = fromIdx < targetIndex ? targetIndex - 1 : targetIndex
          reordered.splice(insertIdx, 0, removed)
          void reorderTasks(targetBoardId, reordered.map((t) => t.id))
        } else {
          void moveTask(taskId, targetBoardId, targetIndex)
        }
      }
    },
    [boards, tasksByBoardId, boardIdsSet, allTaskIds, moveTask, reorderTasks]
  )

  const handleAddColumn = React.useCallback(async () => {
    const name = newColumnName.trim() || "Nova coluna"
    await createBoard(name)
    setNewColumnName("")
    setShowNewColumn(false)
  }, [newColumnName, createBoard])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 sm:p-8">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando tarefas...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col gap-1 border-b bg-background/95 px-3 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconLayoutKanban className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Tarefas</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Arraste os cartões entre colunas para atualizar o status.
            </p>
          </div>
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden p-3 pb-4 sm:p-4 sm:pb-6">
          {boards.map((board) => (
            <KanbanColumn
              key={board.id}
              board={board}
              tasks={tasksByBoardId[board.id] ?? []}
              onAddTask={() => {
                setTaskDialogBoardId(board.id)
                setTaskDialogTaskId(null)
              }}
              onEditTask={(taskId) => {
                setTaskDialogTaskId(taskId)
                setTaskDialogBoardId(null)
              }}
            />
          ))}
          {showNewColumn ? (
            <div className="flex w-[280px] min-w-[280px] shrink-0 flex-col gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-4 transition-colors focus-within:border-primary/50 focus-within:bg-muted/30 sm:w-72 sm:min-w-72">
              <Input
                placeholder="Nome da coluna"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                className="h-9 border-muted-foreground/20 bg-background text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setShowNewColumn(false)
                    setNewColumnName("")
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" className="flex-1" onClick={handleAddColumn}>
                  Criar coluna
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewColumn(true)}
              className={cn(
                "flex w-[280px] min-w-[280px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-72 sm:min-w-72"
              )}
            >
              <IconPlus className="size-6" />
              <span className="font-medium">Nova coluna</span>
            </button>
          )}
        </div>
      </DndContext>

      <TaskDialog
        taskId={taskDialogTaskId}
        boardId={taskDialogBoardId}
        open={taskDialogTaskId !== null || taskDialogBoardId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTaskDialogTaskId(null)
            setTaskDialogBoardId(null)
          }
        }}
      />
    </div>
  )
}
