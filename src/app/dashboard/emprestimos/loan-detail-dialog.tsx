"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import type { Loan, LoanAttachment } from "@/lib/emprestimos/types"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconCalendar, IconCalendarPlus, IconUser, IconBuilding, IconPhoto } from "@tabler/icons-react"

const LOAN_ATTACHMENTS_BUCKET = "loan-attachments"

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
  borrower_name?: string | null
  lender_name?: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: LoanWithNames | null
  attachments: LoanAttachment[]
  onMarkReturned?: (loanId: string) => void
  showMarkReturned?: boolean
  onPostpone?: (loanId: string) => void
  showPostpone?: boolean
}

export function LoanDetailDialog({
  open,
  onOpenChange,
  loan,
  attachments,
  onMarkReturned,
  showMarkReturned = false,
  onPostpone,
  showPostpone = false,
}: Props) {
  const supabase = createClient()
  const [attachmentUrls, setAttachmentUrls] = React.useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = React.useState(false)

  React.useEffect(() => {
    if (!open || !supabase || attachments.length === 0) {
      setAttachmentUrls({})
      return
    }
    let cancelled = false
    setLoadingUrls(true)
    const loadUrls = async () => {
      const map: Record<string, string> = {}
      for (const att of attachments) {
        if (cancelled) return
        const { data } = await supabase.storage
          .from(LOAN_ATTACHMENTS_BUCKET)
          .createSignedUrl(att.file_path, 60 * 60)
        if (data?.signedUrl && att.file_type.startsWith("image/")) {
          map[att.id] = data.signedUrl
        }
      }
      if (!cancelled) {
        setAttachmentUrls(map)
      }
      setLoadingUrls(false)
    }
    loadUrls()
    return () => {
      cancelled = true
    }
  }, [open, supabase, attachments])

  if (!loan) return null

  const status = getLoanStatus(loan)
  const imageAttachments = attachments.filter((a) => a.file_type.startsWith("image/"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <DialogTitle className="text-xl">{loan.title}</DialogTitle>
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
        </DialogHeader>

        <div className="space-y-4">
          {loan.description && (
            <p className="text-sm text-muted-foreground">{loan.description}</p>
          )}

          <div className="space-y-3">
            {loan.borrower_name !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <IconUser className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  Emprestado para: <strong>{loan.borrower_name ?? "—"}</strong>
                </span>
              </div>
            )}
            {loan.lender_name != null && (
              <div className="flex items-center gap-2 text-sm">
                <IconUser className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  Emprestado por: <strong>{loan.lender_name}</strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <IconBuilding className="size-4 shrink-0 text-muted-foreground" />
              <span>Setor: {getSectorLabel(loan.sector)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <IconCalendar className="size-4 shrink-0 text-muted-foreground" />
              <span>Devolução: {formatDate(loan.return_date)}</span>
            </div>
          </div>

          {imageAttachments.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <IconPhoto className="size-4" />
                  Fotos ({imageAttachments.length})
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {imageAttachments.map((att) => {
                    const url = attachmentUrls[att.id]
                    return (
                      <div
                        key={att.id}
                        className="aspect-square overflow-hidden rounded-lg border bg-muted"
                      >
                        {loadingUrls ? (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <span className="text-xs">Carregando…</span>
                          </div>
                        ) : url ? (
                          <img
                            src={url}
                            alt={att.file_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <IconPhoto className="size-8" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {status !== "returned" && (showMarkReturned || showPostpone) && (
            <>
              <Separator />
              <div className="flex flex-col gap-2 sm:flex-row">
                {showPostpone && onPostpone && (
                  <Button
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => {
                      onPostpone(loan.id)
                    }}
                  >
                    <IconCalendarPlus className="size-4" />
                    Adiar prazo
                  </Button>
                )}
                {showMarkReturned && onMarkReturned && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      onMarkReturned(loan.id)
                      onOpenChange(false)
                    }}
                  >
                    Marcar como devolvido
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
