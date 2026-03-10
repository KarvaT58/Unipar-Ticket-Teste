"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string | null
  loanTitle: string
  currentReturnDate: string
  onSuccess: () => void
}

export function PostponeLoanDialog({
  open,
  onOpenChange,
  loanId,
  loanTitle,
  currentReturnDate,
  onSuccess,
}: Props) {
  const supabase = createClient()
  const [newDate, setNewDate] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setNewDate("")
    }
  }, [open])

  const disabledDates = React.useMemo(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return { before: tomorrow }
  }, [])

  function formatDateBR(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  async function handleSave() {
    if (!supabase || !loanId || !newDate) return
    if (newDate <= currentReturnDate) {
      toast.error("A nova data precisa ser posterior à data atual de devolução.")
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from("loans")
      .update({ return_date: newDate, updated_at: new Date().toISOString() })
      .eq("id", loanId)
    setSaving(false)
    if (error) {
      toast.error("Não foi possível adiar o prazo.")
      return
    }
    toast.success("Prazo de devolução adiado com sucesso.")
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adiar prazo de devolução</DialogTitle>
          <DialogDescription>
            Selecione uma nova data de devolução para{" "}
            <strong>&quot;{loanTitle}&quot;</strong>. A data atual é{" "}
            <strong>{currentReturnDate ? formatDateBR(currentReturnDate) : "—"}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="postpone-date">Nova data de devolução</Label>
          <DatePicker
            id="postpone-date"
            value={newDate}
            onChange={setNewDate}
            placeholder="Selecione a nova data"
            aria-label="Nova data de devolução"
            disabledDates={disabledDates}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !newDate}
          >
            {saving ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
