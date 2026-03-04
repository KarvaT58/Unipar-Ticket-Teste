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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

function NavMenuItems({
  items,
  totalChatUnread,
  anunciosEventosUnread,
  unreadDeadlineCount,
  atendimentosUnread,
  filaUnread,
}: {
  items: NavItem[]
  totalChatUnread: number
  anunciosEventosUnread: number
  unreadDeadlineCount: number
  atendimentosUnread: number
  filaUnread: number
}) {
  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild tooltip={item.title}>
            <Link href={item.url} className="relative">
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.url === "/dashboard/atendimentos" && atendimentosUnread > 0 && (
                <SidebarMenuBadge>
                  {atendimentosUnread > 99 ? "99+" : atendimentosUnread}
                </SidebarMenuBadge>
              )}
              {item.url === "/dashboard/fila-atendimentos" && filaUnread > 0 && (
                <SidebarMenuBadge>
                  {filaUnread > 99 ? "99+" : filaUnread}
                </SidebarMenuBadge>
              )}
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
    </>
  )
}

export function NavMain({
  items,
  secondarySection,
}: {
  items: NavItem[]
  secondarySection?: { label: string; items: NavItem[] }
}) {
  const quickCreate = useQuickCreate()
  const { anunciosEventosUnread } = useAnnouncements()
  const { unreadByChatConversationId, totalTicketUnread, filaTabUnread } = useNotifications()
  const { unreadDeadlineCount } = useTasks()

  const totalChatUnread = Object.values(unreadByChatConversationId).reduce(
    (sum, count) => sum + count,
    0
  )

  return (
    <>
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
            <NavMenuItems
              items={items}
              totalChatUnread={totalChatUnread}
              anunciosEventosUnread={anunciosEventosUnread}
              unreadDeadlineCount={unreadDeadlineCount}
              atendimentosUnread={totalTicketUnread}
              filaUnread={filaTabUnread}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {secondarySection && (
        <SidebarGroup className="pt-6">
          {secondarySection.label ? (
            <SidebarGroupLabel>{secondarySection.label}</SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <NavMenuItems
                items={secondarySection.items}
                totalChatUnread={totalChatUnread}
                anunciosEventosUnread={anunciosEventosUnread}
                unreadDeadlineCount={unreadDeadlineCount}
                atendimentosUnread={totalTicketUnread}
                filaUnread={filaTabUnread}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  )
}
