import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  icon?: ReactNode
  className?: string
}

/** Same alignment and spacing on every page: px-4 pt-4 lg:px-6 lg:pt-6 pb-4 (match Chat interno). */
const PAGE_HEADER_WRAPPER = "shrink-0 px-4 pt-4 lg:px-6 lg:pt-6 pb-4"

export function PageHeader({ title, description, icon, className }: PageHeaderProps) {
  return (
    <header className={cn(PAGE_HEADER_WRAPPER, className)}>
      <div className="flex items-start gap-3">
        {icon != null && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 dark:border-red-900/50 dark:bg-red-950/50">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
