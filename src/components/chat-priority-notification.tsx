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
import { useChat } from "@/contexts/chat-context"
import { useAuth } from "@/contexts/auth-context"

const LOCK_SECONDS = 5

export function ChatPriorityNotification() {
  const router = useRouter()
  const { profile } = useAuth()
  const { priorityMessage, dismissPriorityMessage } = useChat()
  const [secondsLeft, setSecondsLeft] = React.useState(LOCK_SECONDS)
  const canClose = secondsLeft <= 0

  const payload = priorityMessage

  React.useEffect(() => {
    if (!payload) {
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
  }, [payload?.message.id])

  const handleOpenConversation = React.useCallback(() => {
    if (!payload || !canClose) return
    dismissPriorityMessage()
    router.push(`/dashboard/chat-interno?conversation=${payload.conversationId}`)
  }, [payload, canClose, dismissPriorityMessage, router])

  const handleClose = React.useCallback(() => {
    if (!canClose) return
    dismissPriorityMessage()
  }, [canClose, dismissPriorityMessage])

  if (!profile) return null

  return (
    <Dialog
      open={!!payload}
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
          <DialogTitle className="pr-8">Mensagem de prioridade</DialogTitle>
          <DialogDescription asChild>
            <span className="text-muted-foreground">
              {payload ? `${payload.senderName} enviou uma mensagem prioritária` : ""}
            </span>
          </DialogDescription>
        </DialogHeader>
        {payload && (
          <div className="min-w-0 space-y-4 overflow-hidden">
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mensagem</p>
              <div className="mt-0.5 max-h-[180px] min-w-0 overflow-x-hidden overflow-y-auto rounded-md border bg-muted/30 px-3 py-2">
                <p className="whitespace-pre-wrap break-all text-sm">
                  {payload.message.content || "[Anexo]"}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 pt-2">
          {!canClose && (
            <p className="text-center text-sm text-muted-foreground">
              Você poderá responder em <strong>{secondsLeft}</strong> segundo(s).
            </p>
          )}
          {canClose && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
              <Button variant="default" className="flex-1" onClick={handleOpenConversation}>
                Abrir conversa
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
