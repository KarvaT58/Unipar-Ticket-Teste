"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import { IconCalendar } from "@tabler/icons-react"
import type { Matcher } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DISPLAY_FORMAT = "dd/MM/yyyy"
const VALUE_FORMAT = "yyyy-MM-dd"

function toDate(value: string): Date | undefined {
  if (!value.trim()) return undefined
  const d = parse(value, VALUE_FORMAT, new Date())
  return isValid(d) ? d : undefined
}

function fromDate(date: Date | undefined): string {
  if (!date) return ""
  return format(date, VALUE_FORMAT)
}

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  "aria-label"?: string
  disabled?: boolean
  /** Disable specific dates in the calendar (e.g. { before: new Date() } for no past dates) */
  disabledDates?: Matcher
  /** When true, only the calendar icon is shown (no text/placeholder) */
  iconOnly?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  id,
  "aria-label": ariaLabel,
  disabled,
  disabledDates,
  iconOnly = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = toDate(value)
  const displayStr = date ? format(date, DISPLAY_FORMAT, { locale: ptBR }) : ""

  const handleSelect = (d: Date | undefined) => {
    onChange(d ? fromDate(d) : "")
    setOpen(false)
  }

  const handleClear = () => {
    onChange("")
    setOpen(false)
  }

  const handleToday = () => {
    const today = new Date()
    onChange(fromDate(today))
    setOpen(false)
  }

  if (iconOnly) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={ariaLabel ?? "Abrir calendário"}
              className="h-9 w-9 shrink-0 rounded-md"
            >
              <IconCalendar className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelect}
              locale={ptBR}
              initialFocus
              disabled={disabledDates}
            />
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                Limpar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleToday}>
                Hoje
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-9 w-full min-w-[180px] justify-start text-left font-normal",
            !displayStr && "text-muted-foreground",
            className
          )}
        >
          <IconCalendar className="mr-2 size-4 shrink-0 opacity-70" />
          {displayStr || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          disabled={disabledDates}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            Limpar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleToday}>
            Hoje
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
