"use client"

import Link from "next/link"
import { IconCirclePlusFilled, type Icon } from "@tabler/icons-react"

import { useQuickCreate } from "@/contexts/quick-create-context"
import { useAnnouncements } from "@/contexts/announcement-context"
import { useNotifications } from "@/contexts/notification-context"
import { useTasks } from "@/contexts/task-context"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const quickCreate = useQuickCreate()
  const { anunciosEventosUnread } = useAnnouncements()
  const { unreadByChatConversationId } = useNotifications()
  const { unreadDeadlineCount } = useTasks()

  const totalChatUnread = Object.values(unreadByChatConversationId).reduce(
    (sum, count) => sum + count,
    0
  )

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Iniciar atendimento rápido"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              onClick={() => quickCreate?.openQuickCreateDialog()}
            >
              <IconCirclePlusFilled />
              <span>Iniciar atendimento rápido</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <Link href={item.url} className="relative">
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.url === "/dashboard/chat-interno" && totalChatUnread > 0 && (
                    <SidebarMenuBadge>
                      {totalChatUnread > 99 ? "99+" : totalChatUnread}
                    </SidebarMenuBadge>
                  )}
                  {item.url === "/dashboard/anuncios-eventos" && anunciosEventosUnread > 0 && (
                    <SidebarMenuBadge>
                      {anunciosEventosUnread > 99 ? "99+" : anunciosEventosUnread}
                    </SidebarMenuBadge>
                  )}
                  {item.url === "/dashboard/tarefas" && unreadDeadlineCount > 0 && (
                    <SidebarMenuBadge>
                      {unreadDeadlineCount > 99 ? "99+" : unreadDeadlineCount}
                    </SidebarMenuBadge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
