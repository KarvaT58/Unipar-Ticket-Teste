"use client"

import * as React from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
import { useAuth } from "@/contexts/auth-context"
import { IconHelp, IconPhotoPlus } from "@tabler/icons-react"
import { toast } from "sonner"

const HELP_IMAGES_BUCKET = "help-images"
const TITLE_MAX = 120

// Placeholder when DB is empty (fallback)
const PLACEHOLDER_IMAGES = [
  { id: "1", src: "https://picsum.photos/400/300?random=1", title: "Como acessar o sistema" },
  { id: "2", src: "https://picsum.photos/400/300?random=2", title: "Configuração de perfil" },
  { id: "3", src: "https://picsum.photos/400/300?random=3", title: "Relatórios e dashboards" },
  { id: "4", src: "https://picsum.photos/400/300?random=4", title: "Solicitar suporte" },
  { id: "5", src: "https://picsum.photos/400/300?random=5", title: "FAQ rápido" },
  { id: "6", src: "https://picsum.photos/400/300?random=6", title: "Atalhos e dicas" },
]

type HelpImage = { id: string; image_url: string; title: string }

/** Returns true only for users whose profiles.department = 'TI'. */
function useIsTI(): boolean {
  const { profile } = useAuth()
  const [isTIFromDb, setIsTIFromDb] = React.useState<boolean | null>(null)
  const supabase = createClient()

  React.useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id ?? profile?.id
      if (!userId) return
      const { data, error } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", userId)
        .single()
      if (cancelled) return
      if (error || !data) {
        setIsTIFromDb(false)
        return
      }
      const dept = String((data as { department?: string }).department ?? "").trim().toUpperCase()
      setIsTIFromDb(dept === "TI")
    }
    run()
    return () => {
      cancelled = true
    }
  }, [profile?.id, profile?.department, supabase])

  const fromContext = String(profile?.department ?? "").trim().toUpperCase() === "TI"
  return fromContext || isTIFromDb === true
}

type HelpImageAddDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function HelpImageAddDialog({ open, onOpenChange, onSuccess }: HelpImageAddDialogProps) {
  const supabase = createClient()
  const [title, setTitle] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [loading, setLoading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setTitle("")
      setFile(null)
    }
  }, [open])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!supabase || !file || !title.trim()) {
        toast.error("Selecione uma imagem e informe a descrição.")
        return
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Envie apenas arquivos de imagem.")
        return
      }
      setLoading(true)
      try {
        const ext = file.name.split(".").pop() || "jpg"
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from(HELP_IMAGES_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from(HELP_IMAGES_BUCKET).getPublicUrl(path)
        const { data: maxRow } = await supabase
          .from("help_images")
          .select("position")
          .order("position", { ascending: false })
          .limit(1)
          .single()
        const nextPosition = (maxRow as { position?: number } | null)?.position ?? -1
        const { error: insertError } = await supabase.from("help_images").insert({
          image_url: urlData.publicUrl,
          title: title.trim().slice(0, TITLE_MAX),
          position: nextPosition + 1,
        })
        if (insertError) throw insertError
        toast.success("Imagem de ajuda adicionada.")
        onSuccess()
        onOpenChange(false)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao adicionar imagem."
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [supabase, file, title, onSuccess, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar imagem de ajuda</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="help-image-title">Descrição / Título</Label>
            <Input
              id="help-image-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder="Ex: Como acessar o sistema"
              maxLength={TITLE_MAX}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">{title.length}/{TITLE_MAX}</p>
          </div>
          <div>
            <Label>Imagem</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
            </div>
            {file && (
              <p className="mt-1 text-sm text-muted-foreground truncate" title={file.name}>
                {file.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !file || !title.trim()}>
              {loading ? "Enviando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AjudaPage() {
  const isTI = useIsTI()
  const supabase = createClient()
  const [helpImages, setHelpImages] = React.useState<HelpImage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from("help_images")
      .select("id, image_url, title")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error || !data) {
          setHelpImages([])
          return
        }
        setHelpImages((data as HelpImage[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [supabase])

  const displayList =
    helpImages.length > 0
      ? helpImages
      : !loading
        ? PLACEHOLDER_IMAGES.map((p) => ({ id: p.id, image_url: p.src, title: p.title }))
        : []

  const handleAddImages = React.useCallback(() => {
    setAddDialogOpen(true)
  }, [])

  const handleAddSuccess = React.useCallback(() => {
    setAddDialogOpen(false)
    if (!supabase) return
    supabase
      .from("help_images")
      .select("id, image_url, title")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setHelpImages((data as HelpImage[]) ?? [])
      })
  }, [supabase])

  return (
    <SidebarProvider
      className="h-svh max-h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-start justify-between gap-4 pr-4 pt-4 lg:pr-6 lg:pt-6 pb-4">
            <PageHeader
              title="Ajuda"
              description="Dúvidas e suporte."
              icon={<IconHelp className="size-5" />}
            />
            {isTI && (
              <Button
                onClick={handleAddImages}
                variant="outline"
                size="default"
                className="shrink-0 gap-2"
                aria-label="Adicionar imagens de ajuda"
              >
                <IconPhotoPlus className="size-4" />
                Adicionar imagens
              </Button>
            )}
            {isTI && (
              <HelpImageAddDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSuccess={handleAddSuccess}
              />
            )}
          </div>
          <div className="flex-1 overflow-auto px-3 pb-4 lg:px-4">
            <div className="mt-2 w-full">
              <p className="mb-3 text-sm text-muted-foreground">
                Imagens de ajuda: tutoriais, manuais e guias visuais.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayList.map((img) => (
                  <div
                    key={img.id}
                    className="overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] w-full bg-muted min-h-[200px] sm:min-h-[240px] lg:min-h-[280px]">
                      <Image
                        src={img.image_url}
                        alt={img.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-medium text-foreground">{img.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
