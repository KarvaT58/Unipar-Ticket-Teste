"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Loan, LoanAttachment } from "@/lib/emprestimos/types"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { IconEye, IconCalendarPlus } from "@tabler/icons-react"
import { LoanDetailDialog } from "./loan-detail-dialog"
import { PostponeLoanDialog } from "./postpone-loan-dialog"
import { filterLoans, type LoanSearchFilter } from "./loan-search-filter-bar"

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getLoanStatus(loan: Loan): "active" | "overdue" | "returned" {
  if (loan.returned_at) return "returned"
  const today = new Date().toISOString().slice(0, 10)
  return loan.return_date <= today ? "overdue" : "active"
}

type LoanWithBorrowerName = Loan & { borrower_name: string | null }

export function EmprestimosQueEuFizTab({ filter }: { filter: LoanSearchFilter }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [loans, setLoans] = useState<LoanWithBorrowerName[]>([])
  const [attachmentsByLoanId, setAttachmentsByLoanId] = useState<
    Record<string, LoanAttachment[]>
  >({})
  const [returningId, setReturningId] = useState<string | null>(null)
  const [detailLoan, setDetailLoan] = useState<LoanWithBorrowerName | null>(null)
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null)
  const [postponeLoan, setPostponeLoan] = useState<LoanWithBorrowerName | null>(null)

  const fetchLoans = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("loans")
      .select("*")
      .eq("lender_id", profile.id)
      .is("returned_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data as Loan[]) ?? []
        if (list.length === 0) {
          setLoans([])
          return
        }
        const borrowerIds = [...new Set(list.map((l) => l.borrower_id))]
        supabase
          .from("profiles")
          .select("id, name")
          .in("id", borrowerIds)
          .then(({ data: profiles }) => {
            const nameById: Record<string, string | null> = {}
            ;(profiles ?? []).forEach((p: { id: string; name: string | null }) => {
              nameById[p.id] = p.name ?? null
            })
            setLoans(
              list.map((l) => ({
                ...l,
                borrower_name: nameById[l.borrower_id] ?? null,
              }))
            )
          })
      })
  }, [supabase, profile])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  useEffect(() => {
    if (!supabase || loans.length === 0) {
      setAttachmentsByLoanId({})
      return
    }
    const ids = loans.map((l) => l.id)
    supabase
      .from("loan_attachments")
      .select("*")
      .in("loan_id", ids)
      .then(({ data }) => {
        const map: Record<string, LoanAttachment[]> = {}
        ids.forEach((id) => (map[id] = []))
        ;(data as LoanAttachment[] ?? []).forEach((a) => {
          map[a.loan_id] = map[a.loan_id] ?? []
          map[a.loan_id].push(a)
        })
        setAttachmentsByLoanId(map)
      })
  }, [supabase, loans])

  async function handleMarkReturned(loanId: string) {
    if (!supabase) return
    setReturningId(loanId)
    const { error } = await supabase
      .from("loans")
      .update({ returned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", loanId)
    setReturningId(null)
    if (error) {
      toast.error("Não foi possível marcar como devolvido.")
      return
    }
    toast.success("Marcado como devolvido.")
    fetchLoans()
  }

  const filtered = useMemo(() => filterLoans(loans, filter), [loans, filter])

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver os empréstimos que você criou.</p>
    )
  }

  if (loans.length === 0) {
    return (
      <p className="text-muted-foreground">
        Você ainda não criou nenhum empréstimo. Use o botão &quot;Novo empréstimo&quot; para emprestar um item a alguém.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Empréstimos que eu fiz</h2>
      <p className="text-sm text-muted-foreground">
        Itens que você emprestou para outras pessoas. Só você, a pessoa e os setores de ambos veem cada empréstimo.
      </p>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum empréstimo encontrado com os filtros aplicados.</p>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((loan) => {
          const status = getLoanStatus(loan)
          const attachments = attachmentsByLoanId[loan.id] ?? []
          return (
            <Card key={loan.id} className="overflow-hidden p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{loan.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Emprestado para: {loan.borrower_name ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      status === "overdue"
                        ? "destructive"
                        : status === "returned"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {status === "overdue"
                      ? "Atrasado"
                      : status === "returned"
                        ? "Devolvido"
                        : "Ativo"}
                  </Badge>
                </div>
                {loan.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {loan.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Devolução: {formatDate(loan.return_date)}</span>
                    {attachments.length > 0 && (
                      <span>{attachments.length} foto(s)</span>
                    )}
                    <span>Setor: {getSectorLabel(loan.sector)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailLoan(loan)}
                      className="gap-1.5"
                    >
                      <IconEye className="size-4" />
                      Ver empréstimo
                    </Button>
                    {status !== "returned" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPostponeLoan(loan)}
                          className="gap-1.5"
                        >
                          <IconCalendarPlus className="size-4" />
                          Adiar prazo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmReturnId(loan.id)}
                          disabled={returningId === loan.id}
                        >
                          {returningId === loan.id ? "Salvando…" : "Marcar como devolvido"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      )}

      <LoanDetailDialog
        open={!!detailLoan}
        onOpenChange={(open) => !open && setDetailLoan(null)}
        loan={detailLoan}
        attachments={detailLoan ? (attachmentsByLoanId[detailLoan.id] ?? []) : []}
        onMarkReturned={(id) => {
          setDetailLoan(null)
          setConfirmReturnId(id)
        }}
        showMarkReturned
        onPostpone={(id) => {
          const loan = loans.find((l) => l.id === id)
          if (loan) {
            setDetailLoan(null)
            setPostponeLoan(loan)
          }
        }}
        showPostpone
      />

      <AlertDialog
        open={!!confirmReturnId}
        onOpenChange={(open) => !open && setConfirmReturnId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar devolução</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar este empréstimo como devolvido? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReturnId) {
                  handleMarkReturned(confirmReturnId)
                  setConfirmReturnId(null)
                }
              }}
            >
              Confirmar devolução
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PostponeLoanDialog
        open={!!postponeLoan}
        onOpenChange={(open) => !open && setPostponeLoan(null)}
        loanId={postponeLoan?.id ?? null}
        loanTitle={postponeLoan?.title ?? ""}
        currentReturnDate={postponeLoan?.return_date ?? ""}
        onSuccess={fetchLoans}
      />
    </div>
  )
}
