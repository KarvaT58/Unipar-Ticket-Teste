"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { usePresence } from "@/contexts/presence-context"
import { getUserStatusLabel, USER_STATUS_OPTIONS } from "@/lib/user-status"
import { StatusPill } from "@/components/status-pill"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconChevronDown } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function DashboardWelcome() {
  const { profile, setProfile } = useAuth()
  const { onlineUserIds } = usePresence()
  const [statusSaving, setStatusSaving] = useState(false)
  const supabase = createClient()

  const displayName = profile?.name?.trim() || "Visitante"
  const customStatus = profile?.user_status ? getUserStatusLabel(profile.user_status) : null
  const isOnline = profile?.id ? onlineUserIds.has(profile.id) : false
  const statusLabel = customStatus ?? (isOnline ? "Online" : "Offline")
  const statusVariant = customStatus ? "custom" : isOnline ? "online" : "offline"

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
    setProfile({ ...profile, user_status: status ?? undefined })
    toast.success("Status atualizado.")
  }

  return (
    <header className="px-4 lg:px-6 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Olá, {displayName}! 👋
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={statusSaving}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap",
                "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:opacity-50 disabled:pointer-events-none",
                "cursor-pointer transition-colors"
              )}
              aria-label="Alterar status"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  statusVariant === "online" && "bg-emerald-500",
                  statusVariant === "offline" && "bg-muted-foreground/70",
                  statusVariant === "custom" && "bg-muted-foreground/70"
                )}
                aria-hidden
              />
              {statusLabel}
              <IconChevronDown className="size-3.5 opacity-70" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {USER_STATUS_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={statusSaving}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Bem-vindo ao Sistema de Chamados UNIPAR
      </p>
    </header>
  )
}
