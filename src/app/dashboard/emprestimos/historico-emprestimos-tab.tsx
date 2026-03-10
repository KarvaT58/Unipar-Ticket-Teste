"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Loan, LoanAttachment } from "@/lib/emprestimos/types"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconEye } from "@tabler/icons-react"
import { LoanDetailDialog } from "./loan-detail-dialog"
import { filterLoans, type LoanSearchFilter } from "./loan-search-filter-bar"

type LoanWithNames = Loan & {
  borrower_name: string | null
  lender_name: string | null
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function HistoricoEmprestimosTab({ filter }: { filter: LoanSearchFilter }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [loans, setLoans] = useState<LoanWithNames[]>([])
  const [attachmentsByLoanId, setAttachmentsByLoanId] = useState<
    Record<string, LoanAttachment[]>
  >({})
  const [detailLoan, setDetailLoan] = useState<LoanWithNames | null>(null)

  const fetchLoans = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("loans")
      .select("*")
      .not("returned_at", "is", null)
      .or(`lender_id.eq.${profile.id},borrower_id.eq.${profile.id}`)
      .order("returned_at", { ascending: false })
      .then(({ data }) => {
        const list = (data as Loan[]) ?? []
        if (list.length === 0) {
          setLoans([])
          return
        }
        const borrowerIds = [...new Set(list.map((l) => l.borrower_id))]
        const lenderIds = [...new Set(list.map((l) => l.lender_id).filter(Boolean))] as string[]
        const allIds = [...new Set([...borrowerIds, ...lenderIds])]
        supabase
          .from("profiles")
          .select("id, name")
          .in("id", allIds)
          .then(({ data: profiles }) => {
            const nameById: Record<string, string | null> = {}
            ;(profiles ?? []).forEach((p: { id: string; name: string | null }) => {
              nameById[p.id] = p.name ?? null
            })
            setLoans(
              list.map((l) => ({
                ...l,
                borrower_name: nameById[l.borrower_id] ?? null,
                lender_name: l.lender_id ? nameById[l.lender_id] ?? null : null,
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

  const filtered = useMemo(() => filterLoans(loans, filter), [loans, filter])

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver o histórico.</p>
    )
  }

  if (loans.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum empréstimo devolvido ainda. Quando um empréstimo for marcado como devolvido, ele aparecerá aqui.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Histórico de empréstimos</h2>
      <p className="text-sm text-muted-foreground">
        Todos os empréstimos que foram devolvidos, tanto os que você fez quanto os que pegou emprestado.
      </p>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum empréstimo encontrado com os filtros aplicados.</p>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((loan) => {
          const attachments = attachmentsByLoanId[loan.id] ?? []
          const isLender = loan.lender_id === profile.id
          return (
            <Card key={loan.id} className="overflow-hidden p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{loan.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {isLender
                        ? `Emprestado para: ${loan.borrower_name ?? "—"}`
                        : `Emprestado por: ${loan.lender_name ?? "—"}`}
                    </p>
                  </div>
                  <Badge variant="secondary">Devolvido</Badge>
                </div>
                {loan.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {loan.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Setor: {getSectorLabel(loan.sector)}</span>
                  <span>Prazo: {formatDate(loan.return_date)}</span>
                  {loan.returned_at && (
                    <span>Devolvido em: {formatDateTime(loan.returned_at)}</span>
                  )}
                  {attachments.length > 0 && (
                    <span>{attachments.length} foto(s)</span>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailLoan(loan)}
                    className="gap-1.5"
                  >
                    <IconEye className="size-4" />
                    Ver detalhes
                  </Button>
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
      />
    </div>
  )
}
