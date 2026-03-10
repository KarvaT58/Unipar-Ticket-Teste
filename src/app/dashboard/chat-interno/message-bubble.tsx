"use client"

import * as React from "react"
import { IconDotsVertical, IconPin, IconPinFilled, IconPencil, IconTrash } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ChatMessage } from "@/lib/chat/types"

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatMessageDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type MessageBubbleProps = {
  id?: string
  message: ChatMessage
  senderName: string
  isOwn: boolean
  isPinned: boolean
  canPin?: boolean
  onTogglePin: () => void
  onEdit?: () => void
  onDelete?: () => void
  getAttachmentUrl: (path: string) => Promise<string | null>
}

export function MessageBubble({
  id: idProp,
  message,
  senderName,
  isOwn,
  isPinned,
  canPin = true,
  onTogglePin,
  onEdit,
  onDelete,
  getAttachmentUrl,
}: MessageBubbleProps) {
  const [fileUrl, setFileUrl] = React.useState<string | null>(null)
  const isDeleted = Boolean(message.deleted_at)

  React.useEffect(() => {
    if (!message.file_path || isDeleted) return
    let cancelled = false
    getAttachmentUrl(message.file_path).then((url) => {
      if (!cancelled) setFileUrl(url)
    })
    return () => { cancelled = true }
  }, [message.file_path, getAttachmentUrl, isDeleted])

  const content = (
    <div className={`flex max-w-[85%] flex-col gap-0.5 rounded-lg px-3 py-2 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold opacity-90">{senderName}</p>
        {message.is_priority && !isDeleted && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isOwn ? "bg-primary-foreground/20 text-primary-foreground" : "bg-amber-500/90 text-white"
            }`}
          >
            Prioritária
          </span>
        )}
      </div>
      {isDeleted ? (
        <p className="text-sm italic opacity-80">Mensagem apagada</p>
      ) : (
        <MessageContent message={message} fileUrl={fileUrl} />
      )}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] opacity-80">
          {formatMessageDate(message.created_at)} {formatMessageTime(message.created_at)}
          {message.edited_at && !isDeleted && (
            <span className="ml-1 opacity-80">· editada</span>
          )}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none"
              aria-label="Opções da mensagem"
            >
              <IconDotsVertical className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? "end" : "start"} side="top">
            {!isDeleted && isOwn && onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <IconPencil className="size-4" />
                Editar
              </DropdownMenuItem>
            )}
            {isOwn && onDelete && (
              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
              >
                <IconTrash className="size-4" />
                Apagar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={canPin ? onTogglePin : undefined}
              disabled={!canPin && !isPinned}
            >
              {isPinned ? (
                <>
                  <IconPinFilled className="size-4" />
                  Desfixar
                </>
              ) : (
                <>
                  <IconPin className="size-4" />
                  Fixar
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <li
      id={idProp}
      className={`scroll-mt-4 flex ${isOwn ? "justify-end" : "justify-start"}`}
    >
      {content}
    </li>
  )
}

function MessageContent({
  message,
  fileUrl,
}: {
  message: ChatMessage
  fileUrl: string | null
}) {
  if (message.message_type === "text" || !message.file_path) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        {message.content || ""}
      </p>
    )
  }

  switch (message.message_type) {
    case "image":
      return fileUrl ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={fileUrl}
            alt={message.file_name ?? "Imagem"}
            className="max-h-48 rounded object-cover"
          />
        </a>
      ) : (
        <span className="text-sm opacity-80">Carregando imagem...</span>
      )
    case "video":
      return fileUrl ? (
        <video
          src={fileUrl}
          controls
          className="max-h-48 rounded"
          preload="metadata"
        />
      ) : (
        <span className="text-sm opacity-80">Carregando vídeo...</span>
      )
    case "audio":
    case "voice":
      return fileUrl ? (
        <audio src={fileUrl} controls className="max-w-full" preload="metadata" />
      ) : (
        <span className="text-sm opacity-80">Carregando áudio...</span>
      )
    case "document":
      return fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          {message.file_name ?? "Documento"}
        </a>
      ) : (
        <span className="text-sm opacity-80">Carregando documento...</span>
      )
    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content || message.file_name || ""}
        </p>
      )
  }
}
