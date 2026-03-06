"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/contexts/notification-context"
import { useAuth } from "@/contexts/auth-context"

const LOCK_SECONDS = 5

export function TicketOverduePopup() {
  const router = useRouter()
  const { profile } = useAuth()
  const { overduePopupNotification, dismissOverduePopup } = useNotifications()
  const [secondsLeft, setSecondsLeft] = React.useState(LOCK_SECONDS)
  const canClose = secondsLeft <= 0

  React.useEffect(() => {
    if (!overduePopupNotification) {
      setSecondsLeft(LOCK_SECONDS)
      return
    }
    setSecondsLeft(LOCK_SECONDS)
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [overduePopupNotification?.id])

  const handleViewTicket = React.useCallback(() => {
    if (!overduePopupNotification || !canClose) return
    void dismissOverduePopup(overduePopupNotification.id)
    router.push(`/dashboard/atendimentos/${overduePopupNotification.ticket_id}`)
  }, [overduePopupNotification, canClose, dismissOverduePopup, router])

  const handleClose = React.useCallback(() => {
    if (!canClose) return
    if (overduePopupNotification) void dismissOverduePopup(overduePopupNotification.id)
  }, [canClose, overduePopupNotification, dismissOverduePopup])

  if (!profile) return null

  const title =
    overduePopupNotification?.type === "ticket_overdue_3d"
      ? "Chamado em atraso (3 dias)"
      : "Chamado em atraso (12 horas)"

  const description =
    overduePopupNotification?.type === "ticket_overdue_3d"
      ? "Este chamado está sem resolução há 3 dias."
      : "Este chamado não foi resolvido em 12 horas."

  return (
    <Dialog
      open={!!overduePopupNotification}
      onOpenChange={(open) => {
        if (open === false && canClose) handleClose()
      }}
    >
      <DialogContent
        className="max-w-md sm:max-w-lg min-w-0 overflow-hidden"
        showCloseButton={false}
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription asChild>
            <span className="text-muted-foreground">{description}</span>
          </DialogDescription>
        </DialogHeader>
        {overduePopupNotification && (
          <div className="min-w-0 space-y-4 overflow-hidden">
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Chamado
              </p>
              <div className="mt-0.5 max-h-[180px] min-w-0 overflow-x-hidden overflow-y-auto rounded-md border bg-muted/30 px-3 py-2">
                <p className="font-medium">{overduePopupNotification.ticketTitle || "Sem título"}</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 pt-2">
          {!canClose && (
            <p className="text-center text-sm text-muted-foreground">
              Você poderá fechar em <strong>{secondsLeft}</strong> segundo(s).
            </p>
          )}
          {canClose && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
              <Button variant="default" className="flex-1" onClick={handleViewTicket}>
                Ver chamado
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
