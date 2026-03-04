import { SidebarTrigger } from "@/components/ui/sidebar"
import { HeaderNotificationIcon } from "@/components/header-notification-icon"
import { ThemeToggle } from "@/components/theme-toggle"
import { GlobalSearch } from "@/components/global-search"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <div className="flex flex-1 justify-start pl-1 min-w-0">
          <GlobalSearch />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <HeaderNotificationIcon />
        </div>
      </div>
    </header>
  )
}
