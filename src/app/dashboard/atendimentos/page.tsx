import { IconHeadset } from "@tabler/icons-react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AtendimentosTabs } from "./atendimentos-tabs"

const VALID_TABS = ["iniciados", "andamento", "encerrados"] as const

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
      : "iniciados"

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
            title="Atendimentos"
            description="Crie chamados, acompanhe a fila e gerencie atendimentos em andamento."
            icon={<IconHeadset className="size-5" />}
          />
          <div className="flex-1 px-4 pb-6 lg:px-6">
            <AtendimentosTabs defaultTab={defaultTab} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
