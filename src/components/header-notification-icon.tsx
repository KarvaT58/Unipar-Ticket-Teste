"use client"

import { useState } from "react"
import Link from "next/link"
import { IconBell, IconCalendarEvent, IconTicket, IconMessageCircle } from "@tabler/icons-react"
import { useNotifications } from "@/contexts/notification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format-relative-time"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function getNotificationTitle(type: string): string {
  if (type === "new_announcement") return "Novo anúncio"
  if (type === "new_ticket") return "Novo chamado"
  if (type === "new_message") return "Nova mensagem"
  if (type === "chat_message") return "Nova mensagem no chat"
  if (type === "chat_priority_message") return "Mensagem prioritária"
  if (type === "task_deadline") return "Prazo da tarefa"
  return "Notificação"
}

function getNotificationDescription(
  type: string,
  ticketTitle: string,
  announcementTitle: string | null,
  chatSenderName: string | null
): string {
  if (type === "new_announcement")
    return announcementTitle ? `"${announcementTitle}" foi publicado para a equipe.` : "Um novo anúncio foi publicado."
  if (type === "new_ticket") return `O chamado "${ticketTitle}" foi aberto na fila do seu setor.`
  if (type === "new_message") return `Nova mensagem no chamado "${ticketTitle}".`
  if (type === "chat_message") return chatSenderName ? `Mensagem de ${chatSenderName} no chat interno.` : "Nova mensagem no chat interno."
  if (type === "chat_priority_message") return chatSenderName ? `Mensagem prioritária de ${chatSenderName}.` : "Mensagem prioritária no chat."
  if (type === "task_deadline") return "Uma tarefa está no prazo ou vencida."
  return `Atividade no chamado "${ticketTitle}".`
}

export function HeaderNotificationIcon() {
  const [open, setOpen] = useState(false)
  const { totalUnread, unreadNotificationItems, markNotificationAsRead } = useNotifications()

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative ml-auto"
          aria-label={totalUnread > 0 ? `${totalUnread} notificações` : "Notificações"}
        >
          <IconBell className="size-5" />
          {totalUnread > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground",
                totalUnread > 99 && "px-1 text-[9px]"
              )}
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[min(70vh,400px)] overflow-y-auto">
        <div className="px-3 pt-3 pb-2 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
        </div>
        {unreadNotificationItems.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">
            Nenhuma notificação.
          </p>
        ) : (
          <div className="py-1">
            {unreadNotificationItems.map((item) => {
              const href =
                item.type === "new_announcement"
                  ? "/dashboard/anuncios-eventos"
                  : (item.type === "chat_message" || item.type === "chat_priority_message") && item.chat_conversation_id
                    ? `/dashboard/chat-interno?conversation=${item.chat_conversation_id}`
                    : item.type === "task_deadline" || item.task_id
                      ? "/dashboard/tarefas"
                      : item.ticket_id
                        ? `/dashboard/atendimentos/${item.ticket_id}`
                        : "/dashboard"
              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={() => {
                    setOpen(false)
                    if (item.type === "new_announcement") void markNotificationAsRead(item.id)
                    if (item.type === "chat_message" || item.type === "chat_priority_message") void markNotificationAsRead(item.id)
                    if (item.type === "task_deadline") void markNotificationAsRead(item.id)
                  }}
                >
                  <div className="flex gap-3 px-3 py-3 hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {item.type === "new_announcement" ? (
                        <IconCalendarEvent className="size-5" />
                      ) : item.type === "new_ticket" ? (
                        <IconTicket className="size-5" />
                      ) : item.type === "chat_message" ? (
                        <IconMessageCircle className="size-5" />
                      ) : item.type === "chat_priority_message" ? (
                        <IconMessageCircle className="size-5" />
                      ) : (
                        <IconMessageCircle className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">
                        {getNotificationTitle(item.type)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {getNotificationDescription(item.type, item.ticketTitle, item.announcementTitle, item.chat_sender_name ?? null)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
            <div className="border-t mt-1">
              <Link
                href="/dashboard/atendimentos?tab=atendimentos"
                onClick={() => setOpen(false)}
                className="block px-3 py-3 text-center text-sm font-medium text-primary hover:bg-muted/50"
              >
                Ver todas
              </Link>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
