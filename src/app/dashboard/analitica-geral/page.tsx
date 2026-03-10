"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IconChartBar } from "@tabler/icons-react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"
import type { Profile } from "@/contexts/auth-context"
import { UserDetailPanel } from "./user-detail-panel"
import { UserListPanel } from "./user-list-panel"

function isAdminRole(role: string | undefined): boolean {
  return role === "admin" || role === "adm"
}

export default function AnaliticaGeralPage() {
  const { profile, isLoading } = useAuth()
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!profile) {
      router.replace("/login")
      return
    }
    if (!isAdminRole(profile.role)) {
      router.replace("/dashboard")
      return
    }
  }, [profile, isLoading, router])

  if (isLoading || !profile || !isAdminRole(profile.role)) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <PageHeader
              title="Administração Geral"
              description="Carregando..."
              icon={<IconChartBar className="size-5" />}
            />
            <div className="flex-1 px-4 pb-6 lg:px-6" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <PageHeader
            title="Administração Geral"
            description="Visualize perfis e atendimentos de todos os colaboradores."
            icon={<IconChartBar className="size-5" />}
          />
          <div className="flex flex-1 flex-col gap-4 px-4 pb-6 lg:flex-row lg:gap-6 lg:px-6">
            <div className="w-full shrink-0 lg:w-[360px]">
              <UserListPanel
                selectedUserId={selectedUser?.id ?? null}
                onSelectUser={setSelectedUser}
              />
            </div>
            <div className="min-w-0 flex-1">
              <UserDetailPanel selectedUser={selectedUser} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
