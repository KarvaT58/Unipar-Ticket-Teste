"use client"

import * as React from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useTasks } from "@/contexts/task-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { IconPlus, IconDotsVertical, IconTrash, IconPencil } from "@tabler/icons-react"
import { TaskCard } from "./task-card"
import type { TaskBoard, Task } from "@/lib/tasks/types"
import { cn } from "@/lib/utils"

type KanbanColumnProps = {
  board: TaskBoard
  tasks: Task[]
  onAddTask: () => void
  onEditTask: (taskId: string) => void
}

export function KanbanColumn({ board, tasks, onAddTask, onEditTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: board.id })
  const { attachmentsByTaskId, updateBoard, deleteBoard, deleteTask } = useTasks()
  const taskIds = tasks.map((t) => t.id)
  const [editing, setEditing] = React.useState(false)
  const [editName, setEditName] = React.useState(board.name)
  const [deleteBoardOpen, setDeleteBoardOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    setEditName(board.name)
  }, [board.name])

  const handleSaveName = React.useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== board.name) void updateBoard(board.id, { name: trimmed })
    setEditing(false)
  }, [board.id, board.name, editName, updateBoard])

  const handleDeleteBoard = React.useCallback(async () => {
    setDeleting(true)
    try {
      await deleteBoard(board.id)
      setDeleteBoardOpen(false)
    } finally {
      setDeleting(false)
    }
  }, [board.id, deleteBoard])

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          "flex w-[280px] min-w-[280px] shrink-0 flex-col rounded-xl border bg-card shadow-sm transition-all sm:w-72 sm:min-w-72",
          isOver && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2.5">
          <div
            className="size-3 shrink-0 rounded-full ring-2 ring-background"
            style={{ backgroundColor: board.color ?? "#94a3b8" }}
          />
          {editing ? (
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName()
                if (e.key === "Escape") {
                  setEditName(board.name)
                  setEditing(false)
                }
              }}
              className="h-7 flex-1 border-muted-foreground/30 text-sm font-medium"
              autoFocus
            />
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{board.name}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {tasks.length}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={onAddTask}
                  title="Nova tarefa"
                >
                  <IconPlus className="size-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title="Mais opções"
                    >
                      <IconDotsVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      <IconPencil className="size-4" />
                      Editar nome
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteBoardOpen(true)}
                    >
                      <IconTrash className="size-4" />
                      Excluir coluna
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
        <div className="min-h-[120px] flex-1 overflow-y-auto p-2">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onEditTask(task.id)}
                  onDelete={deleteTask}
                  attachmentCount={attachmentsByTaskId[task.id]?.length ?? 0}
                />
              ))}
            </ul>
          </SortableContext>
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 py-8 text-center">
              <p className="text-xs font-medium text-muted-foreground">Nenhuma tarefa</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Arraste cartões aqui ou</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={onAddTask}
              >
                <IconPlus className="size-3 mr-1" />
                Adicionar tarefa
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteBoardOpen} onOpenChange={setDeleteBoardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna</AlertDialogTitle>
            <AlertDialogDescription>
              A coluna &quot;{board.name}&quot; e todas as {tasks.length} tarefa(s) dentro dela serão
              excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDeleteBoard()
              }}
              disabled={deleting}
            >
              {deleting ? "Excluindo…" : "Excluir coluna"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
