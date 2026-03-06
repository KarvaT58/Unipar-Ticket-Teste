import type { SupabaseClient } from "@supabase/supabase-js"

export const NOTIFICATION_TYPES = {
  NEW_TICKET: "new_ticket",
  NEW_MESSAGE: "new_message",
  TICKET_ASSIGNED: "ticket_assigned",
  TICKET_TRANSFERRED: "ticket_transferred",
  TICKET_EDITED: "ticket_edited",
  TICKET_CLOSED: "ticket_closed",
  TICKET_REOPENED: "ticket_reopened",
  TICKET_RETURNED_TO_QUEUE: "ticket_returned_to_queue",
  TICKET_OVERDUE_12H: "ticket_overdue_12h",
  TICKET_OVERDUE_3D: "ticket_overdue_3d",
} as const

export type TicketNotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export type InsertNotificationParams = {
  userId: string
  ticketId: string
  type: string
  actorUserId?: string | null
  ticketMessageId?: string | null
}

/**
 * Insert a single notification for one user.
 * Use from client (RLS allows insert with any user_id per existing policy).
 */
export async function insertNotification(
  supabase: SupabaseClient,
  params: InsertNotificationParams
): Promise<{ error: Error | null }> {
  const { data: _, error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    ticket_id: params.ticketId,
    type: params.type,
    actor_user_id: params.actorUserId ?? null,
    ticket_message_id: params.ticketMessageId ?? null,
  })
  return { error: error ? new Error(error.message) : null }
}

export type InsertNotificationsForSectorParams = {
  ticketId: string
  type: string
  actorUserId?: string | null
}

/**
 * Insert one notification per user in the given sector (by department).
 * Excludes actorUserId so the person who performed the action is not notified.
 */
export async function insertNotificationsForSector(
  supabase: SupabaseClient,
  sectorId: string,
  params: InsertNotificationsForSectorParams
): Promise<{ count: number; error: Error | null }> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("department", sectorId)

  if (!profiles?.length) return { count: 0, error: null }

  const userIds = profiles
    .map((p: { id: string }) => p.id)
    .filter((id: string) => id !== params.actorUserId)

  if (userIds.length === 0) return { count: 0, error: null }

  const rows = userIds.map((userId: string) => ({
    user_id: userId,
    ticket_id: params.ticketId,
    type: params.type,
    actor_user_id: params.actorUserId ?? null,
  }))

  const { error } = await supabase.from("notifications").insert(rows)
  return {
    count: rows.length,
    error: error ? new Error(error.message) : null,
  }
}
