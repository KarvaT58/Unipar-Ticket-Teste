"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { IconPackage } from "@tabler/icons-react"
import { EmprestimosTabs } from "./emprestimos-tabs"

export default function EmprestimosPage() {
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
            title="Empréstimos"
            description="Empreste itens para colegas, acompanhe o que você emprestou e o que pegou emprestado."
            icon={<IconPackage className="size-5" />}
          />
          <div className="flex-1 overflow-auto px-4 pb-6 lg:px-6">
            <div className="mx-auto mt-6 w-full max-w-2xl">
              <EmprestimosTabs />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
