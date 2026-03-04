"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const SCROLL_THRESHOLD_CHARS = 1000
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE_MB = 3
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp"

const CATEGORIES = [
  { value: "melhoria", label: "Melhoria de Processo" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "ambiente", label: "Ambiente de Trabalho" },
  { value: "cultura", label: "Cultura" },
  { value: "outros", label: "Outros" },
] as const

export type EditingIdea = {
  id: string
  content: string
  category: string
  attachment_urls: string[]
}

type IdeaSubmitFormProps = {
  editingIdea?: EditingIdea | null
  onCancelEdit?: () => void
  onSaved?: () => void
  /** When true, render without Card and use DialogHeader/DialogFooter (for use inside Dialog). */
  inDialog?: boolean
}

export function IdeaSubmitForm({ editingIdea, onCancelEdit, onSaved, inDialog }: IdeaSubmitFormProps) {
  const supabase = createClient()
  const { profile } = useAuth()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [content, setContent] = React.useState(editingIdea?.content ?? "")
  const [category, setCategory] = React.useState<string>(editingIdea?.category ?? "outros")
  const [loading, setLoading] = React.useState(false)
  const [existingUrls, setExistingUrls] = React.useState<string[]>(editingIdea?.attachment_urls ?? [])
  const [newFiles, setNewFiles] = React.useState<File[]>([])

  React.useEffect(() => {
    if (editingIdea) {
      setContent(editingIdea.content)
      setCategory(editingIdea.category)
      setExistingUrls(editingIdea.attachment_urls ?? [])
      setNewFiles([])
    } else {
      setContent("")
      setCategory("outros")
      setExistingUrls([])
      setNewFiles([])
    }
  }, [editingIdea])

  const previewUrls = React.useMemo(() => {
    const urls: string[] = [...existingUrls]
    newFiles.forEach((f) => urls.push(URL.createObjectURL(f)))
    return urls
  }, [existingUrls, newFiles])

  const removeAttachment = React.useCallback((index: number) => {
    if (index < existingUrls.length) {
      setExistingUrls((prev) => prev.filter((_, i) => i !== index))
    } else {
      setNewFiles((prev) => prev.filter((_, i) => i !== index - existingUrls.length))
    }
  }, [existingUrls.length])

  const addValidImageFiles = React.useCallback((files: File[]) => {
    const valid = files.filter((f) => {
      if (!f.type.match(/^image\/(jpeg|png|gif|webp)$/)) return false
      if (f.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) return false
      return true
    })
    setNewFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, MAX_IMAGES)
      return combined
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const onFilesChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addValidImageFiles(Array.from(e.target.files ?? []))
    },
    [addValidImageFiles]
  )

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      addValidImageFiles(Array.from(e.dataTransfer.files ?? []))
    },
    [addValidImageFiles]
  )
  const onDragOver = React.useCallback((e: React.DragEvent) => e.preventDefault(), [])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!profile || !supabase) {
        toast.error("Faça login para enviar uma ideia.")
        return
      }
      const text = content.trim()
      if (!text) {
        toast.error("Escreva sua ideia antes de enviar.")
        return
      }
      const cat = CATEGORIES.some((c) => c.value === category) ? category : "outros"
      setLoading(true)
      try {
        if (editingIdea) {
          const ideaId = editingIdea.id
          const urlsToKeep = existingUrls
          const uploaded: string[] = []
          for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i]
            const ext = file.name.split(".").pop() || "jpg"
            const path = `${ideaId}/${crypto.randomUUID()}.${ext}`
            const { error: upErr } = await supabase.storage.from("idea-attachments").upload(path, file, { contentType: file.type, upsert: false })
            if (upErr) {
              toast.error("Erro ao enviar uma foto.")
              setLoading(false)
              return
            }
            const { data: urlData } = supabase.storage.from("idea-attachments").getPublicUrl(path)
            uploaded.push(urlData.publicUrl)
          }
          const allUrls = [...urlsToKeep, ...uploaded]
          const { error } = await supabase.from("ideas").update({ content: text, category: cat, attachment_urls: allUrls }).eq("id", ideaId).eq("submitted_by", profile.id)
          if (error) {
            toast.error("Não foi possível atualizar. Tente novamente.")
            return
          }
          toast.success("Ideia atualizada.")
          onSaved?.()
          onCancelEdit?.()
        } else {
          const { data: inserted, error: insertErr } = await supabase.from("ideas").insert({ content: text, category: cat, submitted_by: profile.id }).select("id").single()
          if (insertErr || !inserted) {
            toast.error("Não foi possível enviar. Tente novamente.")
            setLoading(false)
            return
          }
          const ideaId = inserted.id
          const uploaded: string[] = []
          for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i]
            const ext = file.name.split(".").pop() || "jpg"
            const path = `${ideaId}/${crypto.randomUUID()}.${ext}`
            const { error: upErr } = await supabase.storage.from("idea-attachments").upload(path, file, { contentType: file.type, upsert: false })
            if (upErr) continue
            const { data: urlData } = supabase.storage.from("idea-attachments").getPublicUrl(path)
            uploaded.push(urlData.publicUrl)
          }
          if (uploaded.length > 0) {
            await supabase.from("ideas").update({ attachment_urls: uploaded }).eq("id", ideaId)
          }
          toast.success("Ideia enviada com sucesso! Obrigado pela contribuição.")
          setContent("")
          setCategory("outros")
          setExistingUrls([])
          setNewFiles([])
          onSaved?.()
        }
      } finally {
        setLoading(false)
      }
    },
    [profile, supabase, content, category, editingIdea, existingUrls, newFiles, onSaved, onCancelEdit]
  )

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enviar ideia</CardTitle>
          <CardDescription>Faça login para enviar uma ideia. Você poderá ver o histórico das que enviou.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const isEditing = Boolean(editingIdea)
  const totalAttachments = existingUrls.length + newFiles.length

  const formFields = (
    <>
      <div className="grid gap-2">
        <Label htmlFor="idea-category">Categoria</Label>
        <Select value={category} onValueChange={setCategory} name="category" required>
          <SelectTrigger id="idea-category">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="idea-content">Sua ideia</Label>
        <Textarea
          id="idea-content"
          placeholder="Descreva sua sugestão..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={inDialog ? 4 : 5}
          className={cn(
            "resize-none overflow-y-auto min-h-[120px] max-h-[280px]",
            inDialog && "max-h-[180px]"
          )}
        />
        <p className="text-right text-xs text-muted-foreground">
          {content.length} caracteres
          {content.length >= SCROLL_THRESHOLD_CHARS && " · role para ver mais"}
        </p>
      </div>
      <div className="grid gap-2">
        <Label>Fotos (opcional)</Label>
        {inDialog ? (
          <>
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
              onDrop={onDrop}
              onDragOver={onDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                multiple
                id="idea-files"
                className="sr-only"
                onChange={onFilesChange}
                disabled={totalAttachments >= MAX_IMAGES}
              />
              <label
                htmlFor="idea-files"
                className="flex cursor-pointer flex-col items-center gap-2"
              >
                <IconUpload className="size-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique ou arraste arquivos aqui
                </span>
                <span className="text-xs text-muted-foreground">
                  Apenas imagens (JPEG, PNG, GIF, WebP). Máx. {MAX_IMAGES} fotos, {MAX_IMAGE_SIZE_MB} MB cada.
                </span>
              </label>
            </div>
            {previewUrls.length > 0 && (
              <ul className="space-y-1 max-h-[200px] overflow-y-auto">
                {previewUrls.map((url, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                  >
                    {i < existingUrls.length ? (
                      <span className="truncate">Foto {i + 1}</span>
                    ) : (
                      <span className="truncate">{newFiles[i - existingUrls.length]?.name ?? "Foto"}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <IconX className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Apenas imagens (JPEG, PNG, GIF, WebP). Máx. {MAX_IMAGES} fotos, {MAX_IMAGE_SIZE_MB} MB cada.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              className="sr-only"
              onChange={onFilesChange}
              disabled={totalAttachments >= MAX_IMAGES}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={totalAttachments >= MAX_IMAGES || loading}
            >
              <IconPhoto className="size-4" />
              Adicionar fotos
            </Button>
            {previewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className={cn("h-20 w-20 rounded-lg object-cover border")} />
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5 opacity-80 hover:opacity-100"
                      onClick={() => removeAttachment(i)}
                      aria-label="Remover foto"
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )

  if (inDialog) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar ideia" : "Enviar ideia"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">{formFields}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancelEdit} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditing ? "Salvando…" : "Enviando…") : isEditing ? "Salvar alterações" : "Enviar ideia"}
            </Button>
          </DialogFooter>
        </form>
      </>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar ideia" : "Enviar ideia"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Altere o texto, a categoria ou as fotos e salve."
            : "Sua ideia fica no seu histórico. Você pode anexar até 5 fotos (apenas imagens)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? (isEditing ? "Salvando…" : "Enviando…") : isEditing ? "Salvar alterações" : "Enviar ideia"}
            </Button>
            {isEditing && onCancelEdit && (
              <Button type="button" variant="outline" onClick={onCancelEdit} disabled={loading}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
