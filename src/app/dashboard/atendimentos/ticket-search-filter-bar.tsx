"use client"

import { IconSearch } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { DateRangePicker } from "@/components/ui/date-range-picker"

export type TicketSearchFilter = {
  search: string
  dateFrom: string
  dateTo: string
}

type TicketSearchFilterBarProps = {
  value: TicketSearchFilter
  onChange: (v: TicketSearchFilter) => void
  dateLabel?: string
  /** Use compact date range (icon buttons + "Até:") instead of full labels */
  compactDateRange?: boolean
}

export function TicketSearchFilterBar({
  value,
  onChange,
  dateLabel = "Data",
  compactDateRange = true,
}: TicketSearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 w-full">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou descrição..."
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <DateRangePicker
          dateLabel={dateLabel}
          dateFrom={value.dateFrom}
          dateTo={value.dateTo}
          onDateFromChange={(dateFrom) => onChange({ ...value, dateFrom })}
          onDateToChange={(dateTo) => onChange({ ...value, dateTo })}
          compact={compactDateRange}
        />
      </div>
    </div>
  )
}

export function filterTicketsBySearchAndDate<T extends { title: string; description?: string | null; created_at: string; closed_at?: string | null }>(
  tickets: T[],
  filter: TicketSearchFilter,
  dateField: "created_at" | "closed_at" = "created_at"
): T[] {
  const searchLower = filter.search.trim().toLowerCase()
  const from = filter.dateFrom ? new Date(filter.dateFrom + "T00:00:00").getTime() : null
  const to = filter.dateTo ? new Date(filter.dateTo + "T23:59:59").getTime() : null

  return tickets.filter((t) => {
    const matchesSearch =
      !searchLower ||
      t.title.toLowerCase().includes(searchLower) ||
      (t.description && t.description.toLowerCase().includes(searchLower))
    const date = dateField === "closed_at" && t.closed_at ? t.closed_at : t.created_at
    const ts = new Date(date).getTime()
    const matchesFrom = !from || ts >= from
    const matchesTo = !to || ts <= to
    return matchesSearch && matchesFrom && matchesTo
  })
}
