"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { IconUsersGroup } from "@tabler/icons-react"
import { useGroupChat } from "@/contexts/group-chat-context"
import { GroupSidebar } from "./group-sidebar"
import { GroupConversationView } from "./group-conversation-view"

export default function GruposPage() {
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false)
  const { activeGroupId, groups } = useGroupChat()
  const activeGroup = React.useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  )

  return (
    <SidebarProvider
      className="h-svh max-h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader
            title="Grupos"
            description="Chat em tempo real com grupos — adicione e remova membros."
            icon={<IconUsersGroup className="size-5" />}
          />
          <Separator className="shrink-0" />
          <div className="flex min-h-0 flex-1 overflow-hidden p-0">
            <GroupSidebar
              createOpen={createGroupOpen}
              onOpenChange={setCreateGroupOpen}
            />
            <GroupConversationView
              group={activeGroup}
              onOpenCreateGroup={() => setCreateGroupOpen(true)}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
