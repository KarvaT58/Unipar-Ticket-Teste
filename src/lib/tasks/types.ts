export type TaskPriority = "low" | "medium" | "high"

export type TaskBoard = {
  id: string
  user_id: string
  name: string
  color: string | null
  position: number
  created_at: string
}

export type Task = {
  id: string
  board_id: string
  user_id: string
  title: string
  description: string | null
  due_date: string | null // YYYY-MM-DD
  due_time: string | null // HH:MM
  priority: TaskPriority | null
  tags: string[]
  position: number
  deadline_notified_at: string | null
  created_at: string
  updated_at: string
}

export type TaskAttachment = {
  id: string
  task_id: string
  file_path: string
  file_name: string
  file_type: string | null
  file_size: number | null
  created_at: string
}
