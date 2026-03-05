"use client"

import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"

export type DateRangePickerProps = {
  /** Label before the first date (e.g. "Data de abertura" → displays "Data de abertura de:"). Ignored when compact is true. */
  dateLabel: string
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Optional aria prefix for the two inputs */
  ariaLabelFrom?: string
  ariaLabelTo?: string
  /** Compact style: only [calendar] Até: [calendar] (no long label), square icon buttons */
  compact?: boolean
}

/**
 * Unified date range picker: "[dateLabel] de:" [from input] "até:" [to input].
 * Use this everywhere the app needs "from date to date" filtering so the UI is consistent.
 */
export function DateRangePicker({
  dateLabel,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  placeholder = "dd/mm/aaaa",
  className,
  ariaLabelFrom = "Data inicial",
  ariaLabelTo = "Data final",
  compact = false,
}: DateRangePickerProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <DatePicker
          value={dateFrom}
          onChange={onDateFromChange}
          placeholder={placeholder}
          aria-label={ariaLabelFrom}
          iconOnly
          className="shrink-0"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">Até:</span>
        <DatePicker
          value={dateTo}
          onChange={onDateToChange}
          placeholder={placeholder}
          aria-label={ariaLabelTo}
          iconOnly
          className="shrink-0"
        />
      </div>
    )
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label className="text-sm text-muted-foreground whitespace-nowrap">
        {dateLabel} de:
      </label>
      <DatePicker
        value={dateFrom}
        onChange={onDateFromChange}
        placeholder={placeholder}
        aria-label={ariaLabelFrom}
        className="min-w-[140px] w-[140px]"
      />
      <label className="text-sm text-muted-foreground whitespace-nowrap">
        até:
      </label>
      <DatePicker
        value={dateTo}
        onChange={onDateToChange}
        placeholder={placeholder}
        aria-label={ariaLabelTo}
        className="min-w-[140px] w-[140px]"
      />
    </div>
  )
}
