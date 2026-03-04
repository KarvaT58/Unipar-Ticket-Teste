"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { SECTORS } from "@/lib/atendimento/sectors"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { IconUpload, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ACCEPTED_IMAGE_TYPES = "image/*"
const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 500
const UPLOAD_LIST_SCROLL_AFTER = 5

export function SolicitarEmprestimoTab() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [sector, setSector] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [returnDate, setReturnDate] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !profile) {
      toast.error("Faça login para solicitar empréstimo.")
      return
    }
    if (!returnDate) {
      toast.error("Informe a data de devolução.")
      return
    }
    setError(null)
    setLoading(true)
    const { data: inserted, error: insertError } = await supabase
      .from("loans")
      .insert({
        sector: sector,
        borrower_id: profile.id,
        title: title.trim(),
        description: description.trim() || null,
        return_date: returnDate,
      })
      .select("id")
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    const loanId = (inserted as { id: string }).id

    if (files.length > 0) {
      setUploading(true)
      for (const file of files) {
        const path = `${loanId}/${crypto.randomUUID()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from("loan-attachments")
          .upload(path, file, { upsert: false, contentType: file.type })
        if (!uploadError) {
          await supabase.from("loan_attachments").insert({
            loan_id: loanId,
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

    setSector("")
    setTitle("")
    setDescription("")
    setReturnDate("")
    setFiles([])
    setLoading(false)
    toast.success("Empréstimo solicitado.")
  }

  if (!profile) {
    return (
      <p className="text-muted-foreground">Faça login para solicitar empréstimo.</p>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Solicitar empréstimo</h2>
        <p className="text-sm text-muted-foreground">
          Preencha o setor de onde está pegando o item, título, descrição, fotos e data de devolução.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="loan-sector">Setor de onde está pegando</Label>
            <Select value={sector} onValueChange={setSector} required>
              <SelectTrigger id="loan-sector">
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
            <Label htmlFor="loan-title">Título</Label>
            <Input
              id="loan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
              placeholder="Ex: Notebook Dell"
              maxLength={TITLE_MAX_LENGTH}
              required
            />
            <p className="text-right text-xs text-muted-foreground">
              {title.length}/{TITLE_MAX_LENGTH}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loan-desc">Descrição (opcional)</Label>
            <Textarea
              id="loan-desc"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))
              }
              placeholder="Detalhes do item ou observações..."
              rows={3}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">
              {description.length}/{DESCRIPTION_MAX_LENGTH}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loan-return-date">Data de devolução</Label>
            <Input
              id="loan-return-date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Fotos do empréstimo (opcional)</Label>
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
            >
              <input
                type="file"
                id="loan-files"
                multiple
                accept={ACCEPTED_IMAGE_TYPES}
                className="sr-only"
                onChange={(e) => {
                  const chosen = e.target.files
                  if (!chosen) return
                  const images = Array.from(chosen).filter((f) =>
                    f.type.startsWith("image/")
                  )
                  setFiles((prev) => [...prev, ...images])
                }}
              />
              <label
                htmlFor="loan-files"
                className="flex cursor-pointer flex-col items-center gap-2"
              >
                <IconUpload className="size-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para adicionar imagens
                </span>
                <span className="text-xs text-muted-foreground">
                  Apenas imagens (JPEG, PNG, etc.)
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
          <Button type="submit" disabled={loading || uploading}>
            {loading || uploading ? "Enviando…" : "Solicitar empréstimo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
