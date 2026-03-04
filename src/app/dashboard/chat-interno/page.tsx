"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { IconMessageCircle } from "@tabler/icons-react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useChat } from "@/contexts/chat-context"
import { useNotifications } from "@/contexts/notification-context"
import { ConversationSidebar } from "./conversation-sidebar"
import { ConversationView } from "./conversation-view"

function ChatInternoContent() {
  const searchParams = useSearchParams()
  const { activeConversationId, setActiveConversationId, conversations, refetchConversations } = useChat()
  const { markChatConversationAsRead } = useNotifications()
  const conversationParam = searchParams.get("conversation")

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  )

  React.useEffect(() => {
    if (!conversationParam) return
    if (conversationParam !== activeConversationId) {
      const exists = conversations.some((c) => c.id === conversationParam)
      if (exists) {
        void markChatConversationAsRead(conversationParam)
        setActiveConversationId(conversationParam)
      } else {
        void refetchConversations().then(() => {
          void markChatConversationAsRead(conversationParam)
          setActiveConversationId(conversationParam)
        })
      }
    }
  }, [conversationParam, activeConversationId, conversations, setActiveConversationId, refetchConversations, markChatConversationAsRead])

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
            title="Chat interno"
            description="Conversas em tempo real com a equipe — mensagens diretas."
            icon={<IconMessageCircle className="size-5" />}
          />
          <Separator className="shrink-0" />
          <div className="flex min-h-0 flex-1 overflow-hidden p-0">
            <ConversationSidebar />
            <ConversationView conversation={activeConversation} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function ChatInternoPage() {
  return (
    <React.Suspense fallback={<div className="flex h-svh items-center justify-center">Carregando...</div>}>
      <ChatInternoContent />
    </React.Suspense>
  )
}
