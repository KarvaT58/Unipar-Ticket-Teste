export type TicketStatus = "queue" | "in_progress" | "closed"

export type Ticket = {
  id: string
  title: string
  description: string
  created_by: string
  target_sector: string
  assigned_to_user_id: string | null
  assigned_at: string | null
  status: TicketStatus
  created_at: string
  closed_at: string | null
  closed_description: string | null
  closed_by_user_id: string | null
}

export type TicketMessage = {
  id: string
  ticket_id: string
  user_id: string
  content: string
  created_at: string
  is_internal_note?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
  edited_at?: string | null
  edited_by?: string | null
}

export type MessageAttachment = {
  id: string
  message_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number | null
  created_at: string
}
