"use client"

import { useEffect, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { IconPlus } from "@tabler/icons-react"
import { MeusEmprestimosTab } from "./meus-emprestimos-tab"
import { EmprestimosQueEuFizTab } from "./emprestimos-que-eu-fiz-tab"
import { EmprestimosSetorTab } from "./emprestimos-setor-tab"
import { HistoricoEmprestimosTab } from "./historico-emprestimos-tab"
import { LoanFormDialog } from "./loan-form-dialog"
import { useOverdueLoans } from "./use-overdue-loans"
import { LoanOverdueModal } from "./loan-overdue-modal"
import { LoanSearchFilterBar, EMPTY_LOAN_FILTER, type LoanSearchFilter } from "./loan-search-filter-bar"

export function EmprestimosTabs() {
  const { overdueLoans, refetch } = useOverdueLoans()
  const [overdueModalOpen, setOverdueModalOpen] = useState(false)
  const [loanDialogOpen, setLoanDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState<LoanSearchFilter>(EMPTY_LOAN_FILTER)

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
        <Tabs defaultValue="que-eu-fiz" className="w-full space-y-5">
          <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-10 w-fit gap-1 bg-muted/50 p-1">
              <TabsTrigger value="que-eu-fiz">Empréstimos que eu fiz</TabsTrigger>
              <TabsTrigger value="que-eu-peguei">Empréstimos que eu peguei</TabsTrigger>
              <TabsTrigger value="setor">Empréstimos do meu setor</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            <Button onClick={() => setLoanDialogOpen(true)} className="shrink-0">
              <IconPlus className="size-4 mr-2" />
              Novo empréstimo
            </Button>
          </div>
          <LoanSearchFilterBar value={filter} onChange={setFilter} />
          <TabsContent value="que-eu-fiz" className="mt-4">
            <EmprestimosQueEuFizTab key={refreshKey} filter={filter} />
          </TabsContent>
          <TabsContent value="que-eu-peguei" className="mt-4">
            <MeusEmprestimosTab key={refreshKey} filter={filter} />
          </TabsContent>
          <TabsContent value="setor" className="mt-4">
            <EmprestimosSetorTab key={refreshKey} filter={filter} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <HistoricoEmprestimosTab key={refreshKey} filter={filter} />
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
