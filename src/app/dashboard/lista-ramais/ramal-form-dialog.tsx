"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export type RamalRow = {
  id: string
  sector_name: string
  extension_number: string
  person_name: string | null
  created_at: string
  updated_at: string
}

type RamalFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRamal: RamalRow | null
  onSaved: () => void
}

export function RamalFormDialog({
  open,
  onOpenChange,
  editingRamal,
  onSaved,
}: RamalFormDialogProps) {
  const supabase = createClient()
  const [sectorName, setSectorName] = React.useState("")
  const [extensionNumber, setExtensionNumber] = React.useState("")
  const [personName, setPersonName] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (editingRamal) {
      setSectorName(editingRamal.sector_name)
      setExtensionNumber(editingRamal.extension_number)
      setPersonName(editingRamal.person_name ?? "")
    } else {
      setSectorName("")
      setExtensionNumber("")
      setPersonName("")
    }
  }, [editingRamal, open])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!supabase) return
      const sector = sectorName.trim()
      const ext = extensionNumber.trim()
      if (!sector || !ext) {
        toast.error("Preencha o setor e o número do ramal.")
        return
      }
      setLoading(true)
      try {
        const payload = {
          sector_name: sector,
          extension_number: ext,
          person_name: personName.trim() || null,
          updated_at: new Date().toISOString(),
        }
        if (editingRamal) {
          const { error } = await supabase
            .from("ramais")
            .update(payload)
            .eq("id", editingRamal.id)
          if (error) {
            toast.error("Não foi possível atualizar o ramal.")
            return
          }
          toast.success("Ramal atualizado.")
        } else {
          const { error } = await supabase.from("ramais").insert(payload)
          if (error) {
            toast.error("Não foi possível adicionar o ramal.")
            return
          }
          toast.success("Ramal adicionado.")
        }
        onSaved()
        onOpenChange(false)
      } finally {
        setLoading(false)
      }
    },
    [
      supabase,
      sectorName,
      extensionNumber,
      personName,
      editingRamal,
      onSaved,
      onOpenChange,
    ]
  )

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {editingRamal ? "Editar ramal" : "Adicionar ramal"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ramal-sector">Setor</Label>
          <Input
            id="ramal-sector"
            value={sectorName}
            onChange={(e) => setSectorName(e.target.value)}
            placeholder="Ex.: TI, Administração"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ramal-extension">Número do ramal</Label>
          <Input
            id="ramal-extension"
            value={extensionNumber}
            onChange={(e) => setExtensionNumber(e.target.value)}
            placeholder="Ex.: 1234"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ramal-person">
            Nome da pessoa <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="ramal-person"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="Ex.: João Silva"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : editingRamal ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
