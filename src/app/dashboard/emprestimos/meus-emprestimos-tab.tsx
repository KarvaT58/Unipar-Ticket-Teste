"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Loan, LoanAttachment } from "@/lib/emprestimos/types"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

export function MeusEmprestimosTab() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [loans, setLoans] = useState<Loan[]>([])
  const [attachmentsByLoanId, setAttachmentsByLoanId] = useState<
    Record<string, LoanAttachment[]>
  >({})

  const fetchLoans = useCallback(() => {
    if (!supabase || !profile) return
    supabase
      .from("loans")
      .select("*")
      .eq("borrower_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLoans((data as Loan[]) ?? [])
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

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver seus empréstimos.</p>
    )
  }

  if (loans.length === 0) {
    return (
      <p className="text-muted-foreground">Você ainda não tem empréstimos.</p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Meus empréstimos</h2>
      <div className="grid gap-2">
        {loans.map((loan) => {
          const status = getLoanStatus(loan)
          const attachments = attachmentsByLoanId[loan.id] ?? []
          return (
            <Card key={loan.id} className="overflow-hidden p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{loan.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Setor: {getSectorLabel(loan.sector)}
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Devolução: {formatDate(loan.return_date)}</span>
                  {attachments.length > 0 && (
                    <span>{attachments.length} foto(s)</span>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
