"use client"

import * as React from "react"
import { IconPin, IconPinFilled, IconTrash } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
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
  onDelete,
  getAttachmentUrl,
}: MessageBubbleProps) {
  const [fileUrl, setFileUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!message.file_path) return
    let cancelled = false
    getAttachmentUrl(message.file_path).then((url) => {
      if (!cancelled) setFileUrl(url)
    })
    return () => { cancelled = true }
  }, [message.file_path, getAttachmentUrl])

  const content = (
    <div className={`flex max-w-[85%] flex-col gap-0.5 rounded-lg px-3 py-2 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold opacity-90">{senderName}</p>
        {message.is_priority && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isOwn ? "bg-primary-foreground/20 text-primary-foreground" : "bg-amber-500/90 text-white"
            }`}
          >
            Prioritária
          </span>
        )}
      </div>
      <MessageContent message={message} fileUrl={fileUrl} />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] opacity-80">
          {formatMessageDate(message.created_at)} {formatMessageTime(message.created_at)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={canPin ? onTogglePin : undefined}
            disabled={!canPin && !isPinned}
            className="rounded p-0.5 opacity-70 hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              !canPin && !isPinned
                ? "Máximo de 3 mensagens fixadas"
                : isPinned
                  ? "Desfixar mensagem"
                  : "Fixar mensagem"
            }
          >
            {isPinned ? (
              <IconPinFilled className="size-3.5" />
            ) : (
              <IconPin className="size-3.5" />
            )}
          </button>
          {isOwn && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-0.5 opacity-70 hover:opacity-100 hover:text-destructive"
              title="Apagar mensagem"
            >
              <IconTrash className="size-3.5" />
            </button>
          )}
        </div>
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
