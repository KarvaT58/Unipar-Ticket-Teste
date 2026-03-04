"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { IconPhone } from "@tabler/icons-react"

export default function ListaRamaisPage() {
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
            title="Lista de ramais"
            description="Consulte a lista de ramais."
            icon={<IconPhone className="size-5" />}
          />
          <div className="flex-1 overflow-auto px-4 pb-6 lg:px-6">
            <div className="mx-auto mt-6 w-full max-w-2xl space-y-6">
              <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                <p>Conteúdo da lista de ramais pode ser adicionado aqui.</p>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
