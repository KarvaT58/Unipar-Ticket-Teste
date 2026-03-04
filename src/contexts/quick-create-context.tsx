"use client"

import React, { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { SECTORS } from "@/lib/atendimento/sectors"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { IconUpload, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ACCEPTED_FILE_TYPES =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
const TITLE_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 700
const UPLOAD_LIST_SCROLL_AFTER = 5

type QuickCreateContextValue = {
  openQuickCreateDialog: () => void
}

const QuickCreateContext = React.createContext<QuickCreateContextValue | null>(null)

export function useQuickCreate() {
  const ctx = React.useContext(QuickCreateContext)
  return ctx
}

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [sector, setSector] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openQuickCreateDialog = useCallback(() => {
    setTitle("")
    setSector("")
    setDescription("")
    setFiles([])
    setError(null)
    setOpen(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !profile) {
      toast.error("Faça login para criar chamados.")
      return
    }
    setError(null)
    setLoading(true)
    const { data: inserted, error: insertError } = await supabase
      .from("tickets")
      .insert({
        title: title.trim(),
        description: description.trim(),
        created_by: profile.id,
        target_sector: sector,
        status: "queue",
      })
      .select("id")
      .single()
    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }
    const ticketId = (inserted as { id: string }).id
    const { data: firstMsg, error: msgError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        user_id: profile.id,
        content: description.trim(),
      })
      .select("id")
      .single()
    if (msgError || !firstMsg) {
      setError(msgError?.message ?? "Erro ao criar mensagem.")
      setLoading(false)
      return
    }
    const messageId = (firstMsg as { id: string }).id
    if (files.length > 0) {
      setUploading(true)
      for (const file of files) {
        const path = `${ticketId}/messages/${messageId}/${crypto.randomUUID()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(path, file, { upsert: false, contentType: file.type })
        if (!uploadError) {
          await supabase.from("message_attachments").insert({
            message_id: messageId,
            uploaded_by: profile.id,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
          })
        }
      }
      setUploading(false)
    }
    setOpen(false)
    setLoading(false)
    toast.success("Chamado criado.")
    router.push("/dashboard/atendimentos?tab=iniciados")
  }

  return (
    <QuickCreateContext.Provider value={{ openQuickCreateDialog }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Criar chamado</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="quick-ticket-title">Título</Label>
                <Input
                  id="quick-ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
                  placeholder="Ex: Problema no acesso ao sistema"
                  maxLength={TITLE_MAX_LENGTH}
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {title.length}/{TITLE_MAX_LENGTH}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Setor destino</Label>
                <Select value={sector} onValueChange={setSector} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quick-ticket-desc">Descrição</Label>
                <Textarea
                  id="quick-ticket-desc"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))
                  }
                  placeholder="Descreva o problema ou solicitação..."
                  rows={4}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  className="resize-none overflow-y-auto max-h-[180px]"
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {description.length}/{DESCRIPTION_MAX_LENGTH}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Anexos (imagens, vídeos, áudios, documentos)</Label>
                <div
                  className={cn(
                    "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                    "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="file"
                    id="quick-ticket-files"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    className="sr-only"
                    onChange={(e) => {
                      const chosen = e.target.files
                      if (!chosen) return
                      setFiles((prev) => [...prev, ...Array.from(chosen)])
                    }}
                  />
                  <label
                    htmlFor="quick-ticket-files"
                    className="flex cursor-pointer flex-col items-center gap-2"
                  >
                    <IconUpload className="size-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique ou arraste arquivos aqui
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Imagens, vídeos, áudios, PDF, Word, Excel, etc.
                    </span>
                  </label>
                </div>
                {files.length > 0 && (
                  <ul
                    className={cn(
                      "space-y-1",
                      files.length > UPLOAD_LIST_SCROLL_AFTER &&
                        "max-h-[200px] overflow-y-auto"
                    )}
                  >
                    {files.map((file, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                      >
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <IconX className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || uploading}>
                {loading || uploading ? "Criando…" : "Criar chamado"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </QuickCreateContext.Provider>
  )
}
