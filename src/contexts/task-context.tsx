"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotificationMute } from "@/contexts/notification-mute-context"
import { playNotificationSound } from "@/lib/notification-sound"
import type { TaskBoard, Task, TaskAttachment, TaskPriority } from "@/lib/tasks/types"

const TASK_ATTACHMENTS_BUCKET = "task-attachments"
const DEFAULT_BOARDS: { name: string; color: string }[] = [
  { name: "A Fazer", color: "#3b82f6" },
  { name: "Em Progresso", color: "#eab308" },
  { name: "Concluído", color: "#22c55e" },
]
const DEADLINE_CHECK_INTERVAL_MS = 60_000
const DEADLINE_WINDOW_MINUTES = 15

type TaskContextType = {
  boards: TaskBoard[]
  tasksByBoardId: Record<string, Task[]>
  attachmentsByTaskId: Record<string, TaskAttachment[]>
  deadlinePopup: Task | null
  dismissDeadlinePopup: (notificationId?: string) => void
  unreadDeadlineCount: number
  isLoading: boolean
  createBoard: (name: string, color?: string) => Promise<TaskBoard>
  updateBoard: (id: string, data: { name?: string; color?: string }) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
  reorderBoards: (orderedIds: string[]) => Promise<void>
  createTask: (boardId: string, data: Partial<Pick<Task, "title" | "description" | "due_date" | "due_time" | "priority" | "tags">>) => Promise<Task>
  updateTask: (id: string, data: Partial<Pick<Task, "title" | "description" | "due_date" | "due_time" | "priority" | "tags" | "board_id">>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTask: (taskId: string, toBoardId: string, newPosition: number) => Promise<void>
  reorderTasks: (boardId: string, orderedTaskIds: string[]) => Promise<void>
  addAttachment: (taskId: string, file: File) => Promise<TaskAttachment>
  removeAttachment: (attachmentId: string) => Promise<void>
  getAttachmentUrl: (path: string) => Promise<string | null>
  refetchBoards: () => Promise<void>
  refetchTasks: () => Promise<void>
  refetchAttachmentsForTask: (taskId: string) => Promise<void>
}

const TaskContext = React.createContext<TaskContextType | undefined>(undefined)

function parseTime(s: string | null): number {
  if (!s) return 0
  const [h, m] = s.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function getDueTimestamp(task: Task): number | null {
  const date = task.due_date
  const time = task.due_time
  if (!date && !time) return null
  const d = date ? new Date(date + "Z") : new Date()
  if (!date) d.setHours(0, 0, 0, 0)
  if (time) {
    const [h, m] = time.split(":").map(Number)
    d.setUTCHours(h ?? 0, m ?? 0, 0, 0)
  }
  return d.getTime()
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { profile } = useAuth()
  const { muted: notificationSoundMuted } = useNotificationMute()
  const [boards, setBoards] = React.useState<TaskBoard[]>([])
  const [tasksByBoardId, setTasksByBoardId] = React.useState<Record<string, Task[]>>({})
  const [attachmentsByTaskId, setAttachmentsByTaskId] = React.useState<Record<string, TaskAttachment[]>>({})
  const [deadlinePopup, setDeadlinePopup] = React.useState<Task | null>(null)
  const deadlineNotificationIdRef = React.useRef<string | null>(null)
  const [unreadDeadlineCount, setUnreadDeadlineCount] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)

  const refetchBoards = React.useCallback(async () => {
    if (!supabase || !profile?.id) {
      setBoards([])
      return
    }
    const { data, error } = await supabase
      .from("task_boards")
      .select("*")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
    if (error) {
      setBoards([])
      return
    }
    let list = (data ?? []) as TaskBoard[]
    if (list.length === 0) {
      for (let i = 0; i < DEFAULT_BOARDS.length; i++) {
        const { data: inserted } = await supabase
          .from("task_boards")
          .insert({
            user_id: profile.id,
            name: DEFAULT_BOARDS[i].name,
            color: DEFAULT_BOARDS[i].color,
            position: i,
          })
          .select()
          .single()
        if (inserted) list = [...list, inserted as TaskBoard]
      }
    }
    setBoards(list)
  }, [supabase, profile?.id])

  const refetchTasks = React.useCallback(async () => {
    if (!supabase || !profile?.id) {
      setTasksByBoardId({})
      return
    }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
    if (error) {
      setTasksByBoardId({})
      return
    }
    const tasks = (data ?? []) as Task[]
    const byBoard: Record<string, Task[]> = {}
    for (const t of tasks) {
      if (!byBoard[t.board_id]) byBoard[t.board_id] = []
      byBoard[t.board_id].push(t)
    }
    setTasksByBoardId(byBoard)
    const taskIds = tasks.map((t) => t.id)
    if (taskIds.length > 0) {
      const { data: attData } = await supabase
        .from("task_attachments")
        .select("*")
        .in("task_id", taskIds)
      const attList = (attData ?? []) as TaskAttachment[]
      const byTask: Record<string, TaskAttachment[]> = {}
      for (const a of attList) {
        if (!byTask[a.task_id]) byTask[a.task_id] = []
        byTask[a.task_id].push(a)
      }
      setAttachmentsByTaskId(byTask)
    }
  }, [supabase, profile?.id])

  const refetchAttachmentsForTask = React.useCallback(
    async (taskId: string) => {
      if (!supabase) return
      const { data } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })
      setAttachmentsByTaskId((prev) => ({ ...prev, [taskId]: (data ?? []) as TaskAttachment[] }))
    },
    [supabase]
  )

  const fetchUnreadDeadlineCount = React.useCallback(async () => {
    if (!supabase || !profile?.id) {
      setUnreadDeadlineCount(0)
      return
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("type", "task_deadline")
      .is("read_at", null)
    if (!error) setUnreadDeadlineCount(count ?? 0)
  }, [supabase, profile?.id])

  React.useEffect(() => {
    if (!profile?.id) {
      setBoards([])
      setTasksByBoardId({})
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    Promise.all([refetchBoards(), refetchTasks(), fetchUnreadDeadlineCount()]).finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.id, refetchBoards, refetchTasks, fetchUnreadDeadlineCount])

  React.useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${profile.id}` },
        () => {
          refetchTasks()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id, refetchTasks])

  const checkDeadlines = React.useCallback(async () => {
    if (!supabase || !profile?.id) return
    const now = Date.now()
    const windowEnd = now + DEADLINE_WINDOW_MINUTES * 60 * 1000
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", profile.id)
      .is("deadline_notified_at", null)
      .or("due_date.not.is.null,due_time.not.is.null")
    const list = (tasks ?? []) as Task[]
    const toNotify = list.filter((t) => {
      const ts = getDueTimestamp(t)
      if (ts == null) return false
      return ts <= windowEnd
    })
    for (const task of toNotify) {
      const { data: notif } = await supabase
        .from("notifications")
        .insert({
          user_id: profile.id,
          task_id: task.id,
          type: "task_deadline",
        })
        .select("id")
        .single()
      await supabase
        .from("tasks")
        .update({ deadline_notified_at: new Date().toISOString() })
        .eq("id", task.id)
      if (!notificationSoundMuted) playNotificationSound()
      if (notif?.id) {
        deadlineNotificationIdRef.current = notif.id
        setDeadlinePopup(task)
        await fetchUnreadDeadlineCount()
        break
      }
    }
  }, [supabase, profile?.id, fetchUnreadDeadlineCount])

  React.useEffect(() => {
    if (!profile?.id) return
    checkDeadlines()
    const interval = setInterval(checkDeadlines, DEADLINE_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [profile?.id, checkDeadlines])

  const hasFetchedDeadlineOnLoadRef = React.useRef(false)
  React.useEffect(() => {
    if (!supabase || !profile?.id || hasFetchedDeadlineOnLoadRef.current) return
    let cancelled = false
    ;(async () => {
      const { data: unread } = await supabase
        .from("notifications")
        .select("id, task_id")
        .eq("user_id", profile.id)
        .eq("type", "task_deadline")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
      if (cancelled || !unread?.length) return
      const notif = unread[0] as { id: string; task_id: string }
      const { data: task } = await supabase.from("tasks").select("*").eq("id", notif.task_id).single()
      if (cancelled || !task) return
      hasFetchedDeadlineOnLoadRef.current = true
      deadlineNotificationIdRef.current = notif.id
      setDeadlinePopup(task as Task)
      if (!notificationSoundMuted) playNotificationSound()
      await fetchUnreadDeadlineCount()
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, profile?.id, fetchUnreadDeadlineCount, notificationSoundMuted])

  const dismissDeadlinePopup = React.useCallback(
    (notificationId?: string) => {
      const id = notificationId ?? deadlineNotificationIdRef.current
      setDeadlinePopup(null)
      deadlineNotificationIdRef.current = null
      if (id && supabase && profile?.id) {
        supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id)
          .eq("user_id", profile.id)
          .then(() => fetchUnreadDeadlineCount())
      }
    },
    [supabase, profile?.id, fetchUnreadDeadlineCount]
  )

  const createBoard = React.useCallback(
    async (name: string, color?: string): Promise<TaskBoard> => {
      if (!supabase || !profile?.id) throw new Error("Not authenticated")
      const maxPos = boards.length === 0 ? 0 : Math.max(...boards.map((b) => b.position), -1) + 1
      const { data, error } = await supabase
        .from("task_boards")
        .insert({ user_id: profile.id, name, color: color ?? null, position: maxPos })
        .select()
        .single()
      if (error) throw error
      const board = data as TaskBoard
      setBoards((prev) => [...prev, board].sort((a, b) => a.position - b.position))
      return board
    },
    [supabase, profile?.id, boards]
  )

  const updateBoard = React.useCallback(
    async (id: string, data: { name?: string; color?: string }) => {
      if (!supabase) return
      await supabase.from("task_boards").update(data).eq("id", id).eq("user_id", profile!.id)
      setBoards((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...data } : b))
      )
    },
    [supabase, profile?.id]
  )

  const deleteBoard = React.useCallback(
    async (id: string) => {
      if (!supabase || !profile?.id) return
      await supabase.from("task_boards").delete().eq("id", id).eq("user_id", profile.id)
      setBoards((prev) => prev.filter((b) => b.id !== id))
      setTasksByBoardId((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    },
    [supabase, profile?.id]
  )

  const reorderBoards = React.useCallback(
    async (orderedIds: string[]) => {
      if (!supabase || !profile?.id) return
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase.from("task_boards").update({ position: i }).eq("id", orderedIds[i]).eq("user_id", profile.id)
      }
      setBoards((prev) => {
        const byId = new Map(prev.map((b) => [b.id, b]))
        return orderedIds.map((id) => byId.get(id)!).filter(Boolean)
      })
    },
    [supabase, profile?.id]
  )

  const createTask = React.useCallback(
    async (
      boardId: string,
      data: Partial<Pick<Task, "title" | "description" | "due_date" | "due_time" | "priority" | "tags">>
    ): Promise<Task> => {
      if (!supabase || !profile?.id) throw new Error("Not authenticated")
      const tasksInBoard = tasksByBoardId[boardId] ?? []
      const position = tasksInBoard.length
      const { data: inserted, error } = await supabase
        .from("tasks")
        .insert({
          board_id: boardId,
          user_id: profile.id,
          title: data.title ?? "Nova tarefa",
          description: data.description ?? null,
          due_date: data.due_date ?? null,
          due_time: data.due_time ?? null,
          priority: data.priority ?? null,
          tags: data.tags ?? [],
          position,
        })
        .select()
        .single()
      if (error) throw error
      const task = inserted as Task
      setTasksByBoardId((prev) => ({
        ...prev,
        [boardId]: [...(prev[boardId] ?? []), task],
      }))
      return task
    },
    [supabase, profile?.id, tasksByBoardId]
  )

  const updateTask = React.useCallback(
    async (id: string, data: Partial<Pick<Task, "title" | "description" | "due_date" | "due_time" | "priority" | "tags" | "board_id">>) => {
      if (!supabase || !profile?.id) return
      const payload: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }
      await supabase.from("tasks").update(payload).eq("id", id).eq("user_id", profile.id)
      const boardId = "board_id" in data ? data.board_id : undefined
      if (boardId !== undefined) {
        await refetchTasks()
      } else {
        setTasksByBoardId((prev) => {
          const next = { ...prev }
          for (const bid of Object.keys(next)) {
            const idx = next[bid].findIndex((t) => t.id === id)
            if (idx >= 0) {
              next[bid] = next[bid].map((t) => (t.id === id ? { ...t, ...data } : t))
              break
            }
          }
          return next
        })
      }
    },
    [supabase, profile?.id, refetchTasks]
  )

  const deleteTask = React.useCallback(
    async (id: string) => {
      if (!supabase || !profile?.id) return
      await supabase.from("tasks").delete().eq("id", id).eq("user_id", profile.id)
      setTasksByBoardId((prev) => {
        const next = { ...prev }
        for (const bid of Object.keys(next)) {
          next[bid] = next[bid].filter((t) => t.id !== id)
        }
        return next
      })
      setAttachmentsByTaskId((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    },
    [supabase, profile?.id]
  )

  const moveTask = React.useCallback(
    async (taskId: string, toBoardId: string, newPosition: number) => {
      if (!supabase || !profile?.id) return

      let fromBoardId: string | null = null
      setTasksByBoardId((prev) => {
        for (const bid of Object.keys(prev)) {
          const idx = prev[bid].findIndex((t) => t.id === taskId)
          if (idx >= 0) {
            fromBoardId = bid
            const task = prev[bid][idx]
            const next = { ...prev }
            next[bid] = next[bid].filter((t) => t.id !== taskId)
            const targetList = [...(next[toBoardId] ?? [])]
            const inserted = { ...task, board_id: toBoardId, position: newPosition, updated_at: new Date().toISOString() }
            targetList.splice(Math.min(newPosition, targetList.length), 0, inserted)
            next[toBoardId] = targetList
            return next
          }
        }
        return prev
      })

      try {
        await supabase
          .from("tasks")
          .update({ board_id: toBoardId, position: newPosition, updated_at: new Date().toISOString() })
          .eq("id", taskId)
          .eq("user_id", profile.id)
        await refetchTasks()
      } catch {
        await refetchTasks()
      }
    },
    [supabase, profile?.id, refetchTasks]
  )

  const reorderTasks = React.useCallback(
    async (boardId: string, orderedTaskIds: string[]) => {
      if (!supabase || !profile?.id) return
      for (let i = 0; i < orderedTaskIds.length; i++) {
        await supabase
          .from("tasks")
          .update({ position: i, updated_at: new Date().toISOString() })
          .eq("id", orderedTaskIds[i])
          .eq("user_id", profile.id)
      }
      setTasksByBoardId((prev) => {
        const list = prev[boardId] ?? []
        const byId = new Map(list.map((t) => [t.id, t]))
        const reordered = orderedTaskIds.map((id) => byId.get(id)!).filter(Boolean)
        return { ...prev, [boardId]: reordered }
      })
    },
    [supabase, profile?.id]
  )

  const addAttachment = React.useCallback(
    async (taskId: string, file: File): Promise<TaskAttachment> => {
      if (!supabase || !profile?.id) throw new Error("Not authenticated")
      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${profile.id}/${taskId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })
      if (uploadError) throw uploadError
      const { data, error } = await supabase
        .from("task_attachments")
        .insert({
          task_id: taskId,
          file_path: path,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single()
      if (error) throw error
      const att = data as TaskAttachment
      setAttachmentsByTaskId((prev) => ({
        ...prev,
        [taskId]: [...(prev[taskId] ?? []), att],
      }))
      return att
    },
    [supabase, profile?.id]
  )

  const removeAttachment = React.useCallback(
    async (attachmentId: string) => {
      if (!supabase) return
      const att = Object.values(attachmentsByTaskId).flat().find((a) => a.id === attachmentId)
      if (att) {
        await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([att.file_path])
        await supabase.from("task_attachments").delete().eq("id", attachmentId)
        setAttachmentsByTaskId((prev) => {
          const next = { ...prev }
          const taskId = att.task_id
          if (next[taskId]) next[taskId] = next[taskId].filter((a) => a.id !== attachmentId)
          return next
        })
      }
    },
    [supabase, attachmentsByTaskId]
  )

  const getAttachmentUrl = React.useCallback(
    async (path: string): Promise<string | null> => {
      if (!supabase) return null
      const { data } = await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).createSignedUrl(path, 3600)
      return data?.signedUrl ?? null
    },
    [supabase]
  )

  const value: TaskContextType = {
    boards,
    tasksByBoardId,
    attachmentsByTaskId,
    deadlinePopup,
    dismissDeadlinePopup,
    unreadDeadlineCount,
    isLoading,
    createBoard,
    updateBoard,
    deleteBoard,
    reorderBoards,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
    addAttachment,
    removeAttachment,
    getAttachmentUrl,
    refetchBoards,
    refetchTasks,
    refetchAttachmentsForTask,
  }

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}

export function useTasks() {
  const ctx = React.useContext(TaskContext)
  if (ctx === undefined) throw new Error("useTasks must be used within TaskProvider")
  return ctx
}
