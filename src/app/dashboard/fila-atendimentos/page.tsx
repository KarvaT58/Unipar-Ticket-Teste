"use client"

import { IconListNumbers } from "@tabler/icons-react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { FilaChamadosTab } from "@/app/dashboard/atendimentos/fila-chamados-tab"

export default function FilaAtendimentosPage() {
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
            title="Fila De Atendimentos"
            icon={<IconListNumbers className="size-5" />}
          />
          <div className="flex-1 px-4 pb-6 lg:px-6">
            <FilaChamadosTab />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
