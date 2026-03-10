"use client"

import { IconSearch } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { DateRangePicker } from "@/components/ui/date-range-picker"

export type LoanSearchFilter = {
  search: string
  dateFrom: string
  dateTo: string
}

export const EMPTY_LOAN_FILTER: LoanSearchFilter = {
  search: "",
  dateFrom: "",
  dateTo: "",
}

type Props = {
  value: LoanSearchFilter
  onChange: (v: LoanSearchFilter) => void
}

export function LoanSearchFilterBar({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nome ou título..."
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="pl-8 h-9 bg-muted/30 border-muted-foreground/20"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <DateRangePicker
          dateLabel="Data"
          dateFrom={value.dateFrom}
          dateTo={value.dateTo}
          onDateFromChange={(dateFrom) => onChange({ ...value, dateFrom })}
          onDateToChange={(dateTo) => onChange({ ...value, dateTo })}
          compact
        />
      </div>
    </div>
  )
}

export function filterLoans<
  T extends {
    title: string
    description?: string | null
    created_at: string
    borrower_name?: string | null
    lender_name?: string | null
  }
>(loans: T[], filter: LoanSearchFilter): T[] {
  const q = filter.search.trim().toLowerCase()
  const from = filter.dateFrom
    ? new Date(filter.dateFrom + "T00:00:00").getTime()
    : null
  const to = filter.dateTo
    ? new Date(filter.dateTo + "T23:59:59").getTime()
    : null

  return loans.filter((loan) => {
    const matchesSearch =
      !q ||
      loan.title.toLowerCase().includes(q) ||
      (loan.description && loan.description.toLowerCase().includes(q)) ||
      (loan.borrower_name && loan.borrower_name.toLowerCase().includes(q)) ||
      (loan.lender_name && loan.lender_name.toLowerCase().includes(q))

    const ts = new Date(loan.created_at).getTime()
    const matchesFrom = !from || ts >= from
    const matchesTo = !to || ts <= to

    return matchesSearch && matchesFrom && matchesTo
  })
}
