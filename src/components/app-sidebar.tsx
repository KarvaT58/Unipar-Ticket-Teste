"use client"

import * as React from "react"
import Image from "next/image"
import {
  IconCalendarEvent,
  IconHeadset,
  IconLayoutDashboard,
  IconListNumbers,
  IconMessageCircle,
  IconCheckbox,
  IconHelp,
  IconBulb,
  IconHistory,
  IconUsersGroup,
  IconPackage,
  IconPhone,
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
import { Separator } from "@/components/ui/separator"

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
      title: "Fila De Atendimentos",
      url: "/dashboard/fila-atendimentos",
      icon: IconListNumbers,
    },
    {
      title: "Histórico De Atendimentos",
      url: "/dashboard/historico-atendimentos",
      icon: IconHistory,
    },
  ],
  navFerramentas: [
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
      title: "Grupos",
      url: "/dashboard/grupos",
      icon: IconUsersGroup,
    },
    {
      title: "Tarefas",
      url: "/dashboard/tarefas",
      icon: IconCheckbox,
    },
    {
      title: "Empréstimos",
      url: "/dashboard/emprestimos",
      icon: IconPackage,
    },
  ],
  navSecondary: [
    {
      title: "Ideias",
      url: "/dashboard/ideias",
      icon: IconBulb,
    },
    {
      title: "Ajuda",
      url: "/dashboard/ajuda",
      icon: IconHelp,
    },
    {
      title: "Lista de ramais",
      url: "/dashboard/lista-ramais",
      icon: IconPhone,
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
                  src="/logo-uni-up.png"
                  alt="Uni"
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                />
                <span className="text-base font-semibold">Uni</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain}
          secondarySection={{ label: "", items: data.navFerramentas }}
        />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <Separator className="shrink-0" />
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
