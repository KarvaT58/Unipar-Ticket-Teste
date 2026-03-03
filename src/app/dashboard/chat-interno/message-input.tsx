"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import {
  IconPaperclip,
  IconMicrophone,
  IconMicrophoneOff,
  IconSend,
  IconLoader2,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import type { ChatMessage } from "@/lib/chat/types"

const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"

type MessageInputProps = {
  conversationId: string
  disabled?: boolean
  onTyping?: (typing: boolean) => void
  onSend: (
    conversationId: string,
    payload: {
      content?: string | null
      message_type?: ChatMessage["message_type"]
      file_path?: string | null
      file_name?: string | null
      is_priority?: boolean
    }
  ) => Promise<void>
}

const ACCEPT_ALL_ATTACHMENTS = "image/*,video/*,audio/*,.mp3,.pdf,.doc,.docx,.xls,.xlsx,.txt"

const TYPING_DEBOUNCE_MS = 1500

export function MessageInput({
  conversationId,
  disabled,
  onTyping,
  onSend,
}: MessageInputProps) {
  const supabase = createClient()
  const [text, setText] = React.useState("")
  const [priority, setPriority] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const [recordingSeconds, setRecordingSeconds] = React.useState(0)
  const [sendingVoice, setSendingVoice] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const notifyTyping = React.useCallback(
    (typing: boolean) => {
      onTyping?.(typing)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      if (typing) {
        typingTimeoutRef.current = setTimeout(() => {
          onTyping?.(false)
          typingTimeoutRef.current = null
        }, TYPING_DEBOUNCE_MS)
      }
    },
    [onTyping]
  )

  const uploadFile = React.useCallback(
    async (file: File): Promise<{ path: string; name: string } | null> => {
      if (!supabase) return null
      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })
      if (error) return null
      return { path, name: file.name }
    },
    [supabase, conversationId]
  )

  const sendWithFile = React.useCallback(
    async (
      file: File,
      messageType: ChatMessage["message_type"],
      content?: string | null
    ) => {
      if (!file || sending) return
      setSending(true)
      const wasPriority = priority
      try {
        const uploaded = await uploadFile(file)
        if (uploaded) {
          await onSend(conversationId, {
            content: content ?? null,
            message_type: messageType,
            file_path: uploaded.path,
            file_name: uploaded.name,
            is_priority: wasPriority,
          })
          if (wasPriority) setPriority(false)
        }
      } finally {
        setSending(false)
      }
    },
    [conversationId, onSend, priority, sending, uploadFile]
  )

  const handleSendText = React.useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    const wasPriority = priority
    try {
      await onSend(conversationId, {
        content: trimmed,
        message_type: "text",
        is_priority: wasPriority,
      })
      setText("")
      if (wasPriority) setPriority(false)
    } finally {
      setSending(false)
    }
  }, [conversationId, onSend, priority, sending, text])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  const getMessageTypeFromFile = (file: File): ChatMessage["message_type"] => {
    if (file.type.startsWith("image/")) return "image"
    if (file.type.startsWith("video/")) return "video"
    if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mp3")) return "audio"
    return "document"
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = getMessageTypeFromFile(file)
    sendWithFile(file, type)
    e.target.value = ""
  }

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        setRecording(false)
        setRecordingSeconds(0)
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const file = new File([blob], "audio.webm", { type: "audio/webm" })
        setSendingVoice(true)
        try {
          await sendWithFile(file, "voice")
        } finally {
          setSendingVoice(false)
        }
      }
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1)
      }, 1000)
    } catch {
      setRecording(false)
    }
  }, [sendWithFile])

  const stopRecording = React.useCallback(() => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      rec.stop()
      mediaRecorderRef.current = null
    }
  }, [])

  return (
    <div className="flex flex-col gap-1.5 border-t bg-background px-2 pb-2 pt-2">
      {/* Main input row */}
      <div className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPT_ALL_ATTACHMENTS}
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          title="Anexar foto, vídeo, áudio, MP3 ou documento"
        >
          <IconPaperclip className="size-4" />
        </Button>
        {/* Desktop: priority checkbox to the right of paperclip, vertically centered */}
        <div className="hidden items-center gap-2 md:flex shrink-0">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={priority}
              onCheckedChange={(checked) => setPriority(checked === true)}
              disabled={disabled}
              aria-label="Mensagem prioritária"
            />
            <span
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) {
                  e.preventDefault()
                  setPriority((p) => !p)
                }
              }}
              onClick={() => !disabled && setPriority((p) => !p)}
            >
              Mensagem prioritária
            </span>
          </label>
        </div>

        {recording ? (
          <div className="flex min-h-[40px] flex-1 items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-2 py-1.5">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" />
            <span className="text-xs font-medium text-destructive">Gravando</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
            </span>
            <div className="flex flex-1 items-center justify-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-destructive/70 animate-pulse"
                  style={{ height: 8 + (i % 3) * 6 }}
                />
              ))}
            </div>
          </div>
        ) : sendingVoice ? (
          <div className="flex min-h-[40px] flex-1 items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1.5">
            <IconLoader2 className="size-4 shrink-0 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Enviando áudio...</span>
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            placeholder="Mensagem..."
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (e.target.value.trim()) notifyTyping(true)
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="min-h-[40px] max-h-28 flex-1 resize-none text-sm"
            rows={1}
          />
        )}

        {recording ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="size-9 shrink-0"
            onClick={stopRecording}
            title="Parar e enviar áudio"
          >
            <IconMicrophoneOff className="size-4" />
          </Button>
        ) : text.trim() ? (
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0"
            disabled={disabled || sending}
            onClick={handleSendText}
            title="Enviar"
          >
            <IconSend className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            disabled={disabled || sendingVoice}
            onClick={startRecording}
            title="Gravar áudio"
          >
            <IconMicrophone className="size-4" />
          </Button>
        )}
      </div>

      {/* Mobile: priority checkbox below the bar; desktop hint when priority */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
        <div className="flex md:hidden items-center gap-2 px-1">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={priority}
              onCheckedChange={(checked) => setPriority(checked === true)}
              disabled={disabled}
              aria-label="Mensagem prioritária"
            />
            <span
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) {
                  e.preventDefault()
                  setPriority((p) => !p)
                }
              }}
              onClick={() => !disabled && setPriority((p) => !p)}
            >
              Mensagem prioritária
            </span>
          </label>
        </div>
        {priority && (
          <span className="px-1 text-xs text-amber-600 dark:text-amber-400 md:ml-0">
            ⚠ Aparecerá no centro da tela do destinatário
          </span>
        )}
      </div>
    </div>
  )
}
