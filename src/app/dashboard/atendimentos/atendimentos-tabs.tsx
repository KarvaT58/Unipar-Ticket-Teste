"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IniciarAtendimentoTab } from "./iniciar-atendimento-tab"
import { EncerradosTab } from "./encerrados-tab"
import { FilaChamadosTab } from "./fila-chamados-tab"
import { AtendimentosTab } from "./atendimentos-tab"
import { HistoricoTab } from "./historico-tab"

export function AtendimentosTabs({ defaultTab }: { defaultTab: string }) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex w-full max-w-4xl justify-between gap-4">
        <div className="flex gap-2">
          <TabsTrigger value="iniciar">Iniciar atendimento</TabsTrigger>
          <TabsTrigger value="encerrados">Encerrados</TabsTrigger>
        </div>
        <div className="flex gap-2">
          <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
          <TabsTrigger value="fila">Fila de chamados</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </div>
      </TabsList>
      <TabsContent value="iniciar" className="mt-6">
        <IniciarAtendimentoTab />
      </TabsContent>
      <TabsContent value="encerrados" className="mt-6">
        <EncerradosTab />
      </TabsContent>
      <TabsContent value="atendimentos" className="mt-6">
        <AtendimentosTab />
      </TabsContent>
      <TabsContent value="fila" className="mt-6">
        <FilaChamadosTab />
      </TabsContent>
      <TabsContent value="historico" className="mt-6">
        <HistoricoTab />
      </TabsContent>
    </Tabs>
  )
}
