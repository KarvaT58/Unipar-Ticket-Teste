export type ChatMessageType = "text" | "image" | "video" | "audio" | "voice" | "document"

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  message_type: ChatMessageType
  file_path: string | null
  file_name: string | null
  is_priority: boolean
  created_at: string
}

export type ChatConversation = {
  id: string
  user_a_id: string
  user_b_id: string
  last_message_at: string | null
  created_at: string
}

export type ChatConversationWithPeer = ChatConversation & {
  other_id: string
  other_name: string
  other_avatar_url: string | null
  last_message_preview?: string | null
}

export type PriorityMessagePayload = {
  message: ChatMessage
  conversationId: string
  senderName: string
  /** When set, dismiss will mark this notification as read (e.g. when shown from stored notification on login) */
  notificationId?: string
}
