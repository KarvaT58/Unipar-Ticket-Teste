"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IniciarAtendimentoTab } from "./iniciar-atendimento-tab"
import { EncerradosTab } from "./encerrados-tab"
import { ChamadosEmAndamentoTab } from "./chamados-em-andamento-tab"
import { useNotifications } from "@/contexts/notification-context"

export function AtendimentosTabs({ defaultTab }: { defaultTab: string }) {
  const {
    iniciadosTabUnread,
    atendimentosTabUnread,
    encerradosTabUnread,
  } = useNotifications()
  const andamentoUnread = atendimentosTabUnread

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <div className="flex w-full justify-center">
        <TabsList className="h-9 w-fit">
          <TabsTrigger value="iniciados" className="relative">
            Chamados que iniciei
            {iniciadosTabUnread > 0 && (
              <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-medium text-foreground">
                {iniciadosTabUnread > 99 ? "99+" : iniciadosTabUnread}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="andamento" className="relative">
            Chamados em andamento
            {andamentoUnread > 0 && (
              <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-medium text-foreground">
                {andamentoUnread > 99 ? "99+" : andamentoUnread}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="encerrados" className="relative">
            Encerrados
            {encerradosTabUnread > 0 && (
              <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-medium text-foreground">
                {encerradosTabUnread > 99 ? "99+" : encerradosTabUnread}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="iniciados" className="mt-6">
        <IniciarAtendimentoTab />
      </TabsContent>
      <TabsContent value="andamento" className="mt-6">
        <ChamadosEmAndamentoTab />
      </TabsContent>
      <TabsContent value="encerrados" className="mt-6">
        <EncerradosTab />
      </TabsContent>
    </Tabs>
  )
}
