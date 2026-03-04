"use client"

import { cn } from "@/lib/utils"

type StatusPillVariant = "online" | "offline" | "custom"

type StatusPillProps = {
  label: string
  variant?: StatusPillVariant
  className?: string
}

const dotClassByVariant: Record<StatusPillVariant, string> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground/70",
  custom: "bg-muted-foreground/70",
}

export function StatusPill({ label, variant = "offline", className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap",
        className
      )}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", dotClassByVariant[variant])}
        aria-hidden
      />
      {label}
    </span>
  )
}
