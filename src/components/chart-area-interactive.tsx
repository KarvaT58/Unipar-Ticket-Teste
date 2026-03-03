"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Chamados encerrados (histórico) e chamados em atendimento ao longo do tempo"

const chartConfig = {
  encerrados: {
    label: "Chamados encerrados",
    color: "var(--color-chart-2)",
  },
  em_atendimento: {
    label: "Chamados em atendimento",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function buildDailyData(
  closedByDay: Record<string, number>,
  assignedByDay: Record<string, number>,
  startStr: string,
  endStr: string
): { date: string; encerrados: number; em_atendimento: number }[] {
  const result: { date: string; encerrados: number; em_atendimento: number }[] = []
  const start = new Date(startStr + "T00:00:00.000Z")
  const end = new Date(endStr + "T23:59:59.999Z")
  const curr = new Date(start)
  while (curr <= end) {
    const dateStr = curr.toISOString().slice(0, 10)
    result.push({
      date: dateStr,
      encerrados: closedByDay[dateStr] ?? 0,
      em_atendimento: assignedByDay[dateStr] ?? 0,
    })
    curr.setUTCDate(curr.getUTCDate() + 1)
  }
  return result
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const supabase = createClient()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [chartData, setChartData] = React.useState<
    { date: string; encerrados: number; em_atendimento: number }[]
  >([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d")
  }, [isMobile])

  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
  const startDate = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    d.setHours(0, 0, 0, 0)
    return d
  }, [days])
  const endDate = React.useMemo(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d
  }, [])

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    const startStr = startDate.toISOString().slice(0, 10)
    const endStr = endDate.toISOString().slice(0, 10)

    const closedPromise = supabase
      .from("tickets")
      .select("closed_at")
      .not("closed_at", "is", null)
      .gte("closed_at", startStr + "T00:00:00.000Z")
      .lte("closed_at", endStr + "T23:59:59.999Z")

    const assignedPromise = supabase
      .from("tickets")
      .select("assigned_at")
      .not("assigned_at", "is", null)
      .gte("assigned_at", startStr + "T00:00:00.000Z")
      .lte("assigned_at", endStr + "T23:59:59.999Z")

    void Promise.all([
      closedPromise.then((r) => ({ data: r.data ?? [], error: r.error })),
      assignedPromise.then((r) => ({ data: r.data ?? [], error: r.error })),
    ]).then(async ([closedResult, assignedResult]) => {
      const closedByDay: Record<string, number> = {}
      let assignedByDay: Record<string, number> = {}
      const closedList = closedResult.error ? [] : (closedResult.data as { closed_at: string }[])
      let assignedList = assignedResult.error ? [] : (assignedResult.data as { assigned_at: string }[])

      closedList.forEach((row) => {
        const day = row.closed_at.slice(0, 10)
        closedByDay[day] = (closedByDay[day] ?? 0) + 1
      })

      if (assignedResult.error || assignedList.length === 0) {
        const fallback = await supabase
          .from("tickets")
          .select("created_at")
          .eq("status", "in_progress")
          .not("assigned_to_user_id", "is", null)
          .gte("created_at", startStr + "T00:00:00.000Z")
          .lte("created_at", endStr + "T23:59:59.999Z")
        const fallbackData = (fallback.data ?? []) as { created_at: string }[]
        fallbackData.forEach((row) => {
          const day = row.created_at.slice(0, 10)
          assignedByDay[day] = (assignedByDay[day] ?? 0) + 1
        })
      } else {
        assignedList.forEach((row) => {
          const day = row.assigned_at.slice(0, 10)
          assignedByDay[day] = (assignedByDay[day] ?? 0) + 1
        })
      }

      const data = buildDailyData(closedByDay, assignedByDay, startStr, endStr)
      setChartData(data)
    }).finally(() => setLoading(false))
  }, [supabase, startDate, endDate])

  const descriptionText =
    timeRange === "90d"
      ? "Total nos últimos 3 meses"
      : timeRange === "30d"
        ? "Últimos 30 dias"
        : "Últimos 7 dias"

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Chamados encerrados e em atendimento</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">{descriptionText}</span>
          <span className="@[540px]/card:hidden">{descriptionText}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Últimos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30 dias</ToggleGroupItem>
            <ToggleGroupItem value="7d">Últimos 7 dias</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Selecionar período"
            >
              <SelectValue placeholder="Últimos 3 meses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Últimos 3 meses
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 dias
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 dias
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="aspect-auto h-[250px] w-full flex items-center justify-center text-muted-foreground">
            Carregando...
          </div>
        ) : chartData.length === 0 ? (
          <div className="aspect-auto h-[250px] w-full flex items-center justify-center text-muted-foreground">
            Nenhum dado no período.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
              <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillEncerrados" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-encerrados)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-encerrados)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillEmAtendimento" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-em_atendimento)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-em_atendimento)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  return new Date(value).toLocaleDateString("pt-BR", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("pt-BR", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="encerrados"
                type="natural"
                fill="url(#fillEncerrados)"
                stroke="var(--color-encerrados)"
              />
              <Area
                dataKey="em_atendimento"
                type="natural"
                fill="url(#fillEmAtendimento)"
                stroke="var(--color-em_atendimento)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
