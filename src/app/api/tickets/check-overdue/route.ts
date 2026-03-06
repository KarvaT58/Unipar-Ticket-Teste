import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service"
import { insertNotification, insertNotificationsForSector, NOTIFICATION_TYPES } from "@/lib/atendimento/notifications"

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

export const dynamic = "force-dynamic"
export const maxDuration = 60

function getNow() {
  return new Date()
}

function twelveHoursAgo() {
  return new Date(getNow().getTime() - TWELVE_HOURS_MS)
}

function threeDaysAgo() {
  return new Date(getNow().getTime() - THREE_DAYS_MS)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = getNow()
  const t12 = twelveHoursAgo().toISOString()
  const t3d = threeDaysAgo().toISOString()

  let inserted12h = 0
  let inserted3d = 0

  // --- In progress: notify assigned user ---
  const { data: inProgressTickets } = await supabase
    .from("tickets")
    .select("id, assigned_to_user_id, assigned_at, created_at, target_sector")
    .eq("status", "in_progress")
    .not("assigned_to_user_id", "is", null)

  if (inProgressTickets?.length) {
    const { data: existingNotif } = await supabase
      .from("notifications")
      .select("ticket_id, user_id, type")
      .in("ticket_id", inProgressTickets.map((t) => t.id))
      .in("type", [NOTIFICATION_TYPES.TICKET_OVERDUE_12H, NOTIFICATION_TYPES.TICKET_OVERDUE_3D])

    const sentSet = new Set(
      (existingNotif ?? []).map((n) => `${n.ticket_id}:${n.user_id}:${n.type}`)
    )

    for (const t of inProgressTickets) {
      const ref = (t.assigned_at ?? t.created_at) ?? t.created_at
      if (!ref) continue
      const assignedTo = t.assigned_to_user_id
      if (!assignedTo) continue

      if (new Date(ref) <= new Date(t12)) {
        const key = `${t.id}:${assignedTo}:${NOTIFICATION_TYPES.TICKET_OVERDUE_12H}`
        if (!sentSet.has(key)) {
          const { error } = await insertNotification(supabase, {
            userId: assignedTo,
            ticketId: t.id,
            type: NOTIFICATION_TYPES.TICKET_OVERDUE_12H,
          })
          if (!error) {
            sentSet.add(key)
            inserted12h++
          }
        }
      }
      if (new Date(ref) <= new Date(t3d)) {
        const key = `${t.id}:${assignedTo}:${NOTIFICATION_TYPES.TICKET_OVERDUE_3D}`
        if (!sentSet.has(key)) {
          const { error } = await insertNotification(supabase, {
            userId: assignedTo,
            ticketId: t.id,
            type: NOTIFICATION_TYPES.TICKET_OVERDUE_3D,
          })
          if (!error) {
            sentSet.add(key)
            inserted3d++
          }
        }
      }
    }
  }

  // --- Queue: notify all sector users (once per ticket per type) ---
  const { data: queueTickets } = await supabase
    .from("tickets")
    .select("id, created_at, target_sector")
    .eq("status", "queue")

  if (queueTickets?.length) {
    const ticketIds = queueTickets.map((t) => t.id)
    const { data: existingNotif } = await supabase
      .from("notifications")
      .select("ticket_id, type")
      .in("ticket_id", ticketIds)
      .in("type", [NOTIFICATION_TYPES.TICKET_OVERDUE_12H, NOTIFICATION_TYPES.TICKET_OVERDUE_3D])

    const sentTicketType = new Set(
      (existingNotif ?? []).map((n) => `${n.ticket_id}:${n.type}`)
    )

    for (const t of queueTickets) {
      const created = t.created_at
      if (!created) continue
      const sector = t.target_sector
      if (!sector) continue

      if (new Date(created) <= new Date(t12)) {
        const key = `${t.id}:${NOTIFICATION_TYPES.TICKET_OVERDUE_12H}`
        if (!sentTicketType.has(key)) {
          const { count } = await insertNotificationsForSector(supabase, sector, {
            ticketId: t.id,
            type: NOTIFICATION_TYPES.TICKET_OVERDUE_12H,
          })
          inserted12h += count
          sentTicketType.add(key)
        }
      }
      if (new Date(created) <= new Date(t3d)) {
        const key = `${t.id}:${NOTIFICATION_TYPES.TICKET_OVERDUE_3D}`
        if (!sentTicketType.has(key)) {
          const { count } = await insertNotificationsForSector(supabase, sector, {
            ticketId: t.id,
            type: NOTIFICATION_TYPES.TICKET_OVERDUE_3D,
          })
          inserted3d += count
          sentTicketType.add(key)
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inserted_overdue_12h: inserted12h,
    inserted_overdue_3d: inserted3d,
  })
}

export async function POST(request: Request) {
  return GET(request)
}
