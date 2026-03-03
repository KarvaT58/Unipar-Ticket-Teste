"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { IconHelp } from "@tabler/icons-react"

export default function AjudaPage() {
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
        <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconHelp className="size-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Ajuda</h1>
                <p className="text-sm text-muted-foreground">
                  Dúvidas e suporte
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              <p>Conteúdo de ajuda pode ser adicionado aqui: FAQ, contato do suporte, manuais ou links úteis.</p>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
