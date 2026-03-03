export type AnnouncementAttachment = {
  id: string
  announcement_id: string
  file_path: string
  file_type: string
  file_name: string
  created_at: string
}

export type Announcement = {
  id: string
  title: string
  description: string | null
  event_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  show_as_popup: boolean
  attachments?: AnnouncementAttachment[]
  creator_name?: string
}
