"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SolicitarEmprestimoTab } from "./solicitar-emprestimo-tab"
import { MeusEmprestimosTab } from "./meus-emprestimos-tab"
import { EmprestimosSetorTab } from "./emprestimos-setor-tab"
import { useOverdueLoans } from "./use-overdue-loans"
import { LoanOverdueModal } from "./loan-overdue-modal"

export function EmprestimosTabs() {
  const { overdueLoans, refetch } = useOverdueLoans()
  const [overdueModalOpen, setOverdueModalOpen] = useState(false)

  useEffect(() => {
    if (overdueLoans.length > 0) {
      setOverdueModalOpen(true)
    }
  }, [overdueLoans.length])

  function handlePostponedOrClosed() {
    refetch()
  }

  return (
    <>
      <Tabs defaultValue="solicitar" className="w-full">
        <div className="flex w-full justify-center">
          <TabsList className="h-9 w-fit">
            <TabsTrigger value="solicitar">Solicitar empréstimo</TabsTrigger>
            <TabsTrigger value="meus">Meus empréstimos</TabsTrigger>
            <TabsTrigger value="setor">Empréstimos do meu setor</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="solicitar" className="mt-6">
          <SolicitarEmprestimoTab />
        </TabsContent>
        <TabsContent value="meus" className="mt-6">
          <MeusEmprestimosTab />
        </TabsContent>
        <TabsContent value="setor" className="mt-6">
          <EmprestimosSetorTab />
        </TabsContent>
      </Tabs>
      <LoanOverdueModal
        overdueLoans={overdueLoans}
        open={overdueModalOpen}
        onOpenChange={setOverdueModalOpen}
        onPostponedOrClosed={handlePostponedOrClosed}
      />
    </>
  )
}
