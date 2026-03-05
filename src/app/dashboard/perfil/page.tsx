"use client"

import { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useNotificationMute } from "@/contexts/notification-mute-context"
import { getSectorLabel } from "@/lib/atendimento/sectors"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { USER_STATUS_OPTIONS } from "@/lib/user-status"
import { IconUpload, IconTrash, IconUserCircle, IconVolume, IconVolumeOff } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp"
const MAX_SIZE_MB = 2

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function PerfilPage() {
  const { profile, setProfile } = useAuth()
  const { muted: notificationSoundMuted, setMuted: setNotificationSoundMuted } = useNotificationMute()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile || !supabase) return

    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      setError("Formato inválido. Use JPEG, PNG, GIF ou WebP.")
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Tamanho máximo: ${MAX_SIZE_MB} MB.`)
      return
    }

    setError(null)
    setUploading(true)

    const ext = file.name.split(".").pop() || "jpg"
    const path = `${profile.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      toast.error("Erro ao enviar a foto.")
      return
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
    // Append cache-busting param so the browser shows the new image immediately (same path = cached otherwise)
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id)

    if (updateError) {
      setError(updateError.message)
      setUploading(false)
      toast.error("Erro ao atualizar o perfil.")
      return
    }

    setProfile({ ...profile, avatar_url: avatarUrl })
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
    toast.success("Foto de perfil atualizada.")
  }

  async function handleRemovePhoto() {
    if (!profile || !supabase) return
    setError(null)
    setRemoving(true)

    const { data: files } = await supabase.storage.from("avatars").list(profile.id)
    if (files?.length) {
      const paths = files.map((f) => `${profile.id}/${f.name}`)
      await supabase.storage.from("avatars").remove(paths)
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", profile.id)

    if (updateError) {
      setError(updateError.message)
      setRemoving(false)
      toast.error("Erro ao remover a foto.")
      return
    }

    setProfile({ ...profile, avatar_url: null })
    setRemoving(false)
    toast.success("Foto de perfil removida.")
  }

  async function handleStatusChange(value: string) {
    if (!profile || !supabase) return
    const status = value === "__none__" || value === "" ? null : value
    setStatusSaving(true)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ user_status: status })
      .eq("id", profile.id)
    setStatusSaving(false)
    if (updateError) {
      toast.error("Erro ao atualizar o status.")
      return
    }
    setProfile((prev) => (prev ? { ...prev, user_status: status ?? undefined } : null))
    toast.success("Status atualizado.")
  }

  if (!profile) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <PageHeader
              title="Perfil"
              description="Altere sua foto de perfil. Ela será exibida na sidebar e no menu."
              icon={<IconUserCircle className="size-5" />}
            />
            <div className="flex-1 px-4 pb-6 lg:px-6">
              <p className="mt-4 text-muted-foreground">Faça login para acessar seu perfil.</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <PageHeader
            title="Perfil"
            description="Altere sua foto de perfil. Ela será exibida na sidebar e no menu."
            icon={<IconUserCircle className="size-5" />}
          />
          <div className="flex-1 px-4 pb-6 lg:px-6">
            <div className="mt-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações</CardTitle>
                <CardDescription>Seus dados no sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Setor</Label>
                  <p className="text-sm font-medium">
                    {profile.department ? getSectorLabel(profile.department) : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Som das notificações</CardTitle>
                <CardDescription>
                  Ative ou desative o som ao receber notificações.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNotificationSoundMuted(!notificationSoundMuted)}
                >
                  {notificationSoundMuted ? (
                    <>
                      <IconVolumeOff className="size-4" />
                      Ativar som das notificações
                    </>
                  ) : (
                    <>
                      <IconVolume className="size-4" />
                      Mutar som das notificações
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>
                  Status exibido na dashboard e para outros usuários.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="user-status">Meu status</Label>
                  <Select
                    value={profile.user_status ?? "__none__"}
                    onValueChange={handleStatusChange}
                    disabled={statusSaving}
                  >
                    <SelectTrigger id="user-status">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Foto de perfil</CardTitle>
                <CardDescription>
                  Envie uma imagem (JPEG, PNG, GIF ou WebP) de até {MAX_SIZE_MB} MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-24 w-24 rounded-xl">
                    <AvatarImage src={profile.avatar_url?.trim() || undefined} alt={profile.name} />
                    <AvatarFallback className="rounded-xl text-2xl">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    className="sr-only"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || removing}
                  >
                    <IconUpload className="size-4" />
                    {uploading ? "Enviando…" : "Escolher foto"}
                  </Button>
                  {profile.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleRemovePhoto}
                      disabled={uploading || removing}
                    >
                      <IconTrash className="size-4" />
                      {removing ? "Removendo…" : "Remover foto"}
                    </Button>
                  )}
                  {error && (
                    <p className={cn("text-center text-sm text-destructive")}>{error}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

