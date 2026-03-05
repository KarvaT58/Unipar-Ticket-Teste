"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconUpload, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ACCEPTED_IMAGE_TYPES = "image/*"
const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 500
const UPLOAD_LIST_SCROLL_AFTER = 5

type ProfileOption = { id: string; name: string; department: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function LoanFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [borrowerId, setBorrowerId] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [returnDate, setReturnDate] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [users, setUsers] = React.useState<ProfileOption[]>([])

  React.useEffect(() => {
    if (!open || !supabase || !profile?.id) return
    let cancelled = false
    supabase
      .from("profiles")
      .select("id, name, department")
      .neq("id", profile.id)
      .then(({ data }) => {
        if (!cancelled && data) {
          setUsers(
            (data as ProfileOption[]).map((p) => ({
              ...p,
              name: p.name ?? "Sem nome",
              department: p.department ?? "",
            })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, supabase, profile?.id])

  React.useEffect(() => {
    if (!open) {
      setBorrowerId("")
      setTitle("")
      setDescription("")
      setReturnDate("")
      setFiles([])
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !profile) {
      toast.error("Faça login para criar empréstimo.")
      return
    }
    if (!borrowerId) {
      toast.error("Selecione a pessoa para quem está emprestando.")
      return
    }
    if (!returnDate) {
      toast.error("Informe a data de devolução.")
      return
    }
    if (!profile.department) {
      toast.error("Seu perfil precisa ter um setor definido para criar empréstimos.")
      return
    }
    setError(null)
    setLoading(true)
    const { data: inserted, error: insertError } = await supabase
      .from("loans")
      .insert({
        lender_id: profile.id,
        borrower_id: borrowerId,
        sector: profile.department,
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

    setLoading(false)
    toast.success("Empréstimo criado. A pessoa selecionada verá o aviso.")
    onSuccess()
    onOpenChange(false)
  }

  if (!profile) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo empréstimo</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha para quem você está emprestando, descrição e data de devolução. Só você, a pessoa e os setores de ambos verão este empréstimo.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="loan-borrower">Pessoa para quem estou emprestando</Label>
            <Select value={borrowerId} onValueChange={setBorrowerId} required>
              <SelectTrigger id="loan-borrower">
                <SelectValue placeholder="Selecione a pessoa" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {u.department ? ` (${u.department})` : ""}
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
            <DatePicker
              id="loan-return-date"
              value={returnDate}
              onChange={setReturnDate}
              placeholder="dd/mm/aaaa"
              aria-label="Data de devolução"
              disabledDates={React.useMemo(() => {
                const d = new Date()
                d.setHours(0, 0, 0, 0)
                return { before: d }
              }, [])}
            />
          </div>
          <div className="grid gap-2">
            <Label>Fotos (opcional)</Label>
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {loading || uploading ? "Salvando…" : "Criar empréstimo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
