export type Notification = {
  id: string
  user_id: string
  ticket_id: string | null
  ticket_message_id: string | null
  announcement_id: string | null
  chat_conversation_id: string | null
  chat_sender_id: string | null
  chat_message_id: string | null
  task_id: string | null
  type: string
  read_at: string | null
  created_at: string
  actor_user_id: string | null
}
