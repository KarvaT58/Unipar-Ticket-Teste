"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { IconTicket, IconClock, IconUserCheck, IconCircleCheck } from "@tabler/icons-react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type DashboardCounts = {
  openedByMe: number
  queueMySector: number
  inProgress: number
  closed: number
}

export function SectionCards() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [counts, setCounts] = useState<DashboardCounts>({
    openedByMe: 0,
    queueMySector: 0,
    inProgress: 0,
    closed: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const fetchCount = async (
      table: string,
      column: string,
      value: string | null,
      extra?: { column: string; value: string }
    ): Promise<number> => {
      let query = supabase.from(table).select("*", { count: "exact", head: true })
      if (value != null) query = query.eq(column, value)
      if (extra) query = query.eq(extra.column, extra.value)
      const { count } = await query
      return count ?? 0
    }

    if (!profile) {
      const [inProgress, closed] = await Promise.all([
        fetchCount("tickets", "status", "in_progress"),
        fetchCount("tickets", "status", "closed"),
      ])
      setCounts({
        openedByMe: 0,
        queueMySector: 0,
        inProgress,
        closed,
      })
      setLoading(false)
      return
    }

    const [openedByMe, queueMySector, inProgress, closed] = await Promise.all([
      fetchCount("tickets", "created_by", profile.id),
      profile.department
        ? supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .eq("target_sector", profile.department)
            .eq("status", "queue")
            .then(({ count }) => count ?? 0)
        : Promise.resolve(0),
      fetchCount("tickets", "status", "in_progress"),
      fetchCount("tickets", "status", "closed"),
    ])

    setCounts({ openedByMe, queueMySector, inProgress, closed })
    setLoading(false)
  }, [supabase, profile])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted mt-2" />
            </CardHeader>
            <CardFooter>
              <div className="h-3 w-full rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <IconTicket className="size-4" />
            Chamados que eu abri
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {counts.openedByMe}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total de chamados abertos por você
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <IconClock className="size-4" />
            Fila do meu setor
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {counts.queueMySector}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Chamados em aberto na fila do seu setor
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <IconUserCheck className="size-4" />
            Em atendimento
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {counts.inProgress}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Chamados sendo atendidos no momento
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <IconCircleCheck className="size-4" />
            Encerrados
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {counts.closed}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total de chamados encerrados
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
