"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import { useIdeas } from "@/contexts/ideas-context"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { ideasPendingCount } = useIdeas()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={item.url} className="relative">
                  <item.icon />
                  <span>{item.title}</span>
                  {item.url === "/dashboard/ideias" && ideasPendingCount > 0 && (
                    <SidebarMenuBadge>
                      {ideasPendingCount > 99 ? "99+" : ideasPendingCount}
                    </SidebarMenuBadge>
                  )}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
