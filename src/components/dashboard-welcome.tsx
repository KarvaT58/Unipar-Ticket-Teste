"use client"

import { useAuth } from "@/contexts/auth-context"
import { usePresence } from "@/contexts/presence-context"
import { getUserStatusLabel } from "@/lib/user-status"
import { StatusPill } from "@/components/status-pill"

export function DashboardWelcome() {
  const { profile } = useAuth()
  const { onlineUserIds } = usePresence()
  const displayName = profile?.name?.trim() || "Visitante"
  const customStatus = profile?.user_status ? getUserStatusLabel(profile.user_status) : null
  const isOnline = profile?.id ? onlineUserIds.has(profile.id) : false
  const statusLabel = customStatus ?? (isOnline ? "Online" : "Offline")
  const statusVariant = customStatus ? "custom" : isOnline ? "online" : "offline"

  return (
    <header className="px-4 lg:px-6 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Olá, {displayName}! 👋
        </h1>
        <StatusPill label={statusLabel} variant={statusVariant} />
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Bem-vindo ao Sistema de Chamados UNIPAR
      </p>
    </header>
  )
}
