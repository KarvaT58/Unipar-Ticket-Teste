import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service"
import { getAdminMessaging, isAdminConfigured } from "@/lib/firebase/admin"

type WebhookPayload = {
  type: "INSERT"
  table: string
  schema: string
  record: {
    id: string
    user_id: string
    type: string
    ticket_id?: string | null
    announcement_id?: string | null
    chat_conversation_id?: string | null
    task_id?: string | null
  }
}

function buildFCMPayload(record: WebhookPayload["record"]): { title: string; body: string; data: Record<string, string> } {
  const data: Record<string, string> = {
    notificationId: record.id,
    type: record.type,
  }
  if (record.ticket_id) data.ticket_id = record.ticket_id
  if (record.announcement_id) data.announcement_id = record.announcement_id
  if (record.chat_conversation_id) data.chat_conversation_id = record.chat_conversation_id
  if (record.task_id) data.task_id = record.task_id

  switch (record.type) {
    case "new_announcement":
      return { title: "Novo anúncio", body: "Um novo anúncio foi publicado.", data }
    case "new_ticket":
      return { title: "Novo chamado", body: "Um novo chamado foi aberto na fila.", data }
    case "new_message":
      return { title: "Nova mensagem", body: "Nova mensagem em um chamado.", data }
    case "chat_message":
      return { title: "Nova mensagem no chat", body: "Você recebeu uma nova mensagem no chat interno.", data }
    case "chat_priority_message":
      return { title: "Mensagem prioritária", body: "Você recebeu uma mensagem prioritária no chat.", data }
    case "task_deadline":
      return { title: "Prazo da tarefa", body: "Uma tarefa está no prazo ou vencida.", data }
    default:
      return { title: "Notificação", body: "Você tem uma nova notificação.", data }
  }
}

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET
  if (secret) {
    const authHeader = request.headers.get("authorization")
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (bearer !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "FCM not configured" }, { status: 503 })
  }

  let payload: WebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications" || payload.schema !== "public") {
    return NextResponse.json({ ok: true })
  }

  const record = payload.record as WebhookPayload["record"]
  const userId = record.user_id
  if (!userId) return NextResponse.json({ ok: true })

  const supabase = createServiceRoleClient()
  const { data: tokens } = await supabase
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", userId)

  if (!tokens?.length) return NextResponse.json({ ok: true })

  const { title, body, data } = buildFCMPayload(record)
  const fcm = getAdminMessaging()
  if (!fcm) return NextResponse.json({ error: "FCM unavailable" }, { status: 503 })

  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    webpush: {
      fcmOptions: { link: "/dashboard" },
    },
    tokens: tokens.map((t) => t.token),
  }

  try {
    const result = await fcm.sendEachForMulticast(message)
    return NextResponse.json({ ok: true, successCount: result.successCount, failureCount: result.failureCount })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
