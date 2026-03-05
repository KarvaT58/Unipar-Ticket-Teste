"use client"

import { useEffect, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { IconPlus } from "@tabler/icons-react"
import { MeusEmprestimosTab } from "./meus-emprestimos-tab"
import { EmprestimosQueEuFizTab } from "./emprestimos-que-eu-fiz-tab"
import { EmprestimosSetorTab } from "./emprestimos-setor-tab"
import { LoanFormDialog } from "./loan-form-dialog"
import { useOverdueLoans } from "./use-overdue-loans"
import { LoanOverdueModal } from "./loan-overdue-modal"

export function EmprestimosTabs() {
  const { overdueLoans, refetch } = useOverdueLoans()
  const [overdueModalOpen, setOverdueModalOpen] = useState(false)
  const [loanDialogOpen, setLoanDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (overdueLoans.length > 0) {
      setOverdueModalOpen(true)
    }
  }, [overdueLoans.length])

  const handlePostponedOrClosed = useCallback(() => {
    refetch()
  }, [refetch])

  const handleLoanCreated = useCallback(() => {
    setRefreshKey((k) => k + 1)
    refetch()
  }, [refetch])

  return (
    <>
      <div className="flex flex-col gap-4 w-full">
        <div className="flex justify-end">
          <Button onClick={() => setLoanDialogOpen(true)}>
            <IconPlus className="size-4 mr-2" />
            Novo empréstimo
          </Button>
        </div>
        <Tabs defaultValue="que-eu-fiz" className="w-full">
          <div className="flex w-full justify-center">
            <TabsList className="h-9 w-fit">
              <TabsTrigger value="que-eu-fiz">Empréstimos que eu fiz</TabsTrigger>
              <TabsTrigger value="que-eu-peguei">Empréstimos que eu peguei</TabsTrigger>
              <TabsTrigger value="setor">Empréstimos do meu setor</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="que-eu-fiz" className="mt-6">
            <EmprestimosQueEuFizTab key={refreshKey} />
          </TabsContent>
          <TabsContent value="que-eu-peguei" className="mt-6">
            <MeusEmprestimosTab key={refreshKey} />
          </TabsContent>
          <TabsContent value="setor" className="mt-6">
            <EmprestimosSetorTab key={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
      <LoanFormDialog
        open={loanDialogOpen}
        onOpenChange={setLoanDialogOpen}
        onSuccess={handleLoanCreated}
      />
      <LoanOverdueModal
        overdueLoans={overdueLoans}
        open={overdueModalOpen}
        onOpenChange={setOverdueModalOpen}
        onPostponedOrClosed={handlePostponedOrClosed}
      />
    </>
  )
}
