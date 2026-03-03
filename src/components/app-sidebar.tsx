"use client"

import * as React from "react"
import Image from "next/image"
import {
  IconCalendarEvent,
  IconHeadset,
  IconLayoutDashboard,
  IconMessageCircle,
  IconCheckbox,
  IconHelp,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Usuário",
    email: "Faça login",
    avatar: undefined,
    department: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconLayoutDashboard,
    },
    {
      title: "Atendimentos",
      url: "/dashboard/atendimentos",
      icon: IconHeadset,
    },
    {
      title: "Anúncio/Eventos",
      url: "/dashboard/anuncios-eventos",
      icon: IconCalendarEvent,
    },
    {
      title: "Chat Interno",
      url: "/dashboard/chat-interno",
      icon: IconMessageCircle,
    },
    {
      title: "Tarefas",
      url: "/dashboard/tarefas",
      icon: IconCheckbox,
    },
  ],
  navSecondary: [
    {
      title: "Ajuda",
      url: "/dashboard/ajuda",
      icon: IconHelp,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={24}
                  height={24}
                  className="size-6 object-contain"
                />
                <span className="text-base font-semibold">Uni</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
