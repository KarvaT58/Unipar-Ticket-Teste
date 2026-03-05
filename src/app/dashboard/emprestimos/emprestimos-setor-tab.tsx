"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Loan, LoanAttachment } from "@/lib/emprestimos/types"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

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

type LoanWithNames = Loan & {
  borrower_name: string | null
  lender_name: string | null
}

export function EmprestimosSetorTab() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [loans, setLoans] = useState<LoanWithNames[]>([])
  const [attachmentsByLoanId, setAttachmentsByLoanId] = useState<
    Record<string, LoanAttachment[]>
  >({})
  const [returningId, setReturningId] = useState<string | null>(null)

  const fetchLoans = useCallback(() => {
    if (!supabase || !profile?.department) return
    supabase
      .from("loans")
      .select("*")
      .eq("sector", profile.department)
      .order("return_date", { ascending: true })
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
  }, [supabase, profile?.department])

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

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para ver os empréstimos do setor.</p>
    )
  }

  if (!profile.department) {
    return (
      <p className="text-muted-foreground">
        Seu perfil não tem setor definido. Apenas usuários do setor veem esta lista.
      </p>
    )
  }

  if (loans.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum empréstimo no setor {getSectorLabel(profile.department)}.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Empréstimos do setor {getSectorLabel(profile.department)}
      </h2>
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
                      {loan.lender_name
                        ? `Emprestado por ${loan.lender_name} para ${loan.borrower_name ?? "—"}`
                        : `Emprestado por: ${loan.borrower_name ?? "—"}`}
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
                  </div>
                  {status !== "returned" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkReturned(loan.id)}
                      disabled={returningId === loan.id}
                    >
                      {returningId === loan.id ? "Salvando…" : "Marcar como devolvido"}
                    </Button>
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
