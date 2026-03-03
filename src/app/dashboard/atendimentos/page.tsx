import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AtendimentosTabs } from "./atendimentos-tabs"

const VALID_TABS = ["iniciar", "encerrados", "atendimentos", "fila", "historico"] as const

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }> | { tab?: string }
}) {
  const params = typeof (searchParams as { then?: unknown })?.then === "function"
    ? await (searchParams as Promise<{ tab?: string }>)
    : (searchParams as { tab?: string })
  const tabParam = params?.tab
  const defaultTab =
    tabParam && VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
      ? tabParam
      : "iniciar"

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
        <div className="flex flex-1 flex-col p-4 lg:p-6">
          <AtendimentosTabs defaultTab={defaultTab} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
