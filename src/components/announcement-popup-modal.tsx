"use client"

import * as React from "react"
import { IconX } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAnnouncements } from "@/contexts/announcement-context"
import { useAuth } from "@/contexts/auth-context"
import type { Announcement } from "@/lib/announcements/types"

const LOCK_SECONDS = 5

function formatEventDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function AnnouncementPopupModal() {
  const { profile } = useAuth()
  const { popupAnnouncement, dismissPopup } = useAnnouncements()
  const [secondsLeft, setSecondsLeft] = React.useState(LOCK_SECONDS)
  const canClose = secondsLeft <= 0

  const announcement = popupAnnouncement

  React.useEffect(() => {
    if (!announcement) {
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
  }, [announcement?.id])

  const handleClose = React.useCallback(async () => {
    if (!announcement || !canClose) return
    await dismissPopup(announcement.id)
  }, [announcement, canClose, dismissPopup])

  if (!profile) return null

  return (
    <Dialog
      open={!!announcement}
      onOpenChange={(open) => {
        if (open === false && canClose) void handleClose()
      }}
    >
      <DialogContent
        className="max-w-md sm:max-w-lg min-w-0 overflow-hidden"
        showCloseButton={false}
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="pr-8">Aviso importante</DialogTitle>
          <DialogDescription asChild>
            <span className="text-muted-foreground">Novo anúncio para toda a equipe</span>
          </DialogDescription>
        </DialogHeader>
        {announcement && (
          <AnnouncementPopupContent announcement={announcement} />
        )}
        <div className="flex flex-col gap-3 pt-2">
          {!canClose && (
            <p className="text-center text-sm text-muted-foreground">
              Você poderá fechar em <strong>{secondsLeft}</strong> segundo(s).
            </p>
          )}
          <Button
            onClick={handleClose}
            disabled={!canClose}
            variant="default"
            className="w-full"
          >
            <IconX className="mr-2 size-4" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AnnouncementPopupContent({ announcement }: { announcement: Announcement }) {
  const eventDate = formatEventDate(announcement.event_date)
  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      <div className="min-w-0 overflow-hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Título</p>
        <h3 className="mt-0.5 break-words font-semibold">{announcement.title}</h3>
      </div>
      {announcement.description && (
        <div className="min-w-0 overflow-hidden">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descrição</p>
          <div className="mt-0.5 max-h-[180px] min-w-0 overflow-x-hidden overflow-y-auto rounded-md border bg-muted/30 px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-sm">{announcement.description}</p>
          </div>
        </div>
      )}
      {eventDate && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data do evento</p>
          <p className="mt-0.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            {eventDate}
          </p>
        </div>
      )}
      {announcement.creator_name && (
        <p className="text-xs text-muted-foreground">Publicado por {announcement.creator_name}</p>
      )}
    </div>
  )
}
