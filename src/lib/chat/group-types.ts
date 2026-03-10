import type { ChatMessageType } from "./types"

export type ChatGroupRole = "admin" | "member"

export type ChatGroup = {
  id: string
  name: string | null
  created_by: string
  created_at: string
  last_message_at: string | null
}

export type ChatGroupMember = {
  group_id: string
  user_id: string
  role: ChatGroupRole
  joined_at: string
  name?: string
  avatar_url?: string | null
}

export type ChatGroupMessage = {
  id: string
  group_id: string
  sender_id: string
  content: string | null
  message_type: ChatMessageType
  file_path: string | null
  file_name: string | null
  is_priority: boolean
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
}

/** For use with MessageBubble: same shape as ChatMessage where it matters (id, sender_id, content, message_type, file_path, file_name, is_priority, created_at) */
export type ChatGroupMessageForBubble = ChatGroupMessage & {
  conversation_id?: string
}

export type ChatGroupWithPreview = ChatGroup & {
  last_message_preview?: string | null
  member_count?: number
}
