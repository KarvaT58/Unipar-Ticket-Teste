"use client"

import Link from "next/link"
import type { Ticket } from "@/lib/atendimento/types"

export type TicketListItemProps = {
  ticket: Ticket
  href: string
  creatorName: string
  assigneeName: string
  statusLabel: string
  statusClassName?: string
  dateDisplay: string
  timeDisplay: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}

export function TicketListItem({
  ticket,
  href,
  creatorName,
  assigneeName,
  statusLabel,
  statusClassName = "bg-muted text-foreground/90",
  dateDisplay,
  timeDisplay,
  badge,
  actions,
}: TicketListItemProps) {
  return (
    <Link
      href={href}
      className="block border-b border-border bg-card/50 transition-colors hover:bg-muted/40 last:border-b-0"
    >
      <div className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Aberto por:</span>{" "}
            <span className="font-medium text-foreground">{creatorName}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Título:</span>{" "}
            <span className="font-medium text-foreground">{ticket.title}</span>
            {badge}
          </span>
          <span>
            <span className="text-muted-foreground">Status:</span>{" "}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClassName}`}
            >
              {statusLabel}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">Data:</span>{" "}
            <span className="tabular-nums text-foreground">{dateDisplay}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Horário:</span>{" "}
            <span className="tabular-nums text-foreground">{timeDisplay}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Setor:</span>{" "}
            <span className="text-foreground">{ticket.target_sector}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Atribuído por:</span>{" "}
            <span className="text-foreground">{assigneeName}</span>
          </span>
          {actions ? (
            <span
              className="ml-auto shrink-0"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              {actions}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
