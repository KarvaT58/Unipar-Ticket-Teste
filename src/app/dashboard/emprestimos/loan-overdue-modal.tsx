"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Loan } from "@/lib/emprestimos/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const LOCK_SECONDS = 5

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

type LoanOverdueModalProps = {
  overdueLoans: Loan[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPostponedOrClosed: () => void
}

export function LoanOverdueModal({
  overdueLoans,
  open,
  onOpenChange,
  onPostponedOrClosed,
}: LoanOverdueModalProps) {
  const [lockUntil, setLockUntil] = useState(0)
  const [postponeLoanId, setPostponeLoanId] = useState<string | null>(null)
  const [newReturnDate, setNewReturnDate] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && overdueLoans.length > 0) {
      setLockUntil(Date.now() + LOCK_SECONDS * 1000)
    }
  }, [open, overdueLoans.length])

  const isLocked = lockUntil > Date.now()

  function handleOpenChange(next: boolean) {
    if (next === false && isLocked) return
    onOpenChange(next)
    if (next === false) {
      onPostponedOrClosed()
      setPostponeLoanId(null)
      setNewReturnDate("")
    }
  }

  const supabase = createClient()

  async function handlePostpone() {
    if (!postponeLoanId || !newReturnDate || !supabase) return
    setSaving(true)
    const { error } = await supabase
      .from("loans")
      .update({
        return_date: newReturnDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postponeLoanId)
    setSaving(false)
    if (error) {
      toast.error("Não foi possível adiar a devolução.")
      return
    }
    toast.success("Data de devolução atualizada.")
    setPostponeLoanId(null)
    setNewReturnDate("")
    onPostponedOrClosed()
    handleOpenChange(false)
  }

  if (overdueLoans.length === 0) return null

  const loanToPostpone = postponeLoanId
    ? overdueLoans.find((l) => l.id === postponeLoanId)
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isLocked}
        onPointerDownOutside={(e) => isLocked && e.preventDefault()}
        onEscapeKeyDown={(e) => isLocked && e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Devolução em atraso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Você tem empréstimo(s) com data de devolução vencida. Regularize a situação ou adie a data.
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {overdueLoans.map((loan) => (
              <li key={loan.id}>
                <strong>{loan.title}</strong> — devolução prevista: {formatDate(loan.return_date)}
              </li>
            ))}
          </ul>
          {loanToPostpone ? (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Nova data de devolução para &quot;{loanToPostpone.title}&quot;</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newReturnDate}
                  onChange={(e) => setNewReturnDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
                <Button
                  size="sm"
                  onClick={handlePostpone}
                  disabled={!newReturnDate || saving}
                >
                  {saving ? "Salvando…" : "Confirmar adiamento"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPostponeLoanId(null)
                    setNewReturnDate("")
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isLocked
                ? `Aguarde ${Math.ceil((lockUntil - Date.now()) / 1000)}s para fechar ou adiar.`
                : "Use &quot;Adiar&quot; para definir uma nova data de devolução."}
            </p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {!postponeLoanId ? (
            <>
              {overdueLoans.map((loan) => (
                <Button
                  key={loan.id}
                  variant="outline"
                  onClick={() => setPostponeLoanId(loan.id)}
                  disabled={isLocked}
                >
                  Adiar &quot;{loan.title}&quot;
                </Button>
              ))}
              <Button
                onClick={() => handleOpenChange(false)}
                disabled={isLocked}
              >
                Ok
              </Button>
            </>
          ) : (
            <Button
              onClick={() => handleOpenChange(false)}
              disabled={isLocked}
            >
              Ok
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
