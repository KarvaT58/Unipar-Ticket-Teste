export type AnnouncementAttachment = {
  id: string
  announcement_id: string
  file_path: string
  file_type: string
  file_name: string
  created_at: string
}

export type AudienceType = "all" | "specific_users"

export type Announcement = {
  id: string
  title: string
  description: string | null
  event_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  show_as_popup: boolean
  audience_type: AudienceType
  /** When audience_type === 'specific_users', list of user ids targeted */
  audience_user_ids?: string[]
  attachments?: AnnouncementAttachment[]
  creator_name?: string
}
