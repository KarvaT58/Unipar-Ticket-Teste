"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { IconSearch } from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SECTORS } from "@/lib/atendimento/sectors"
import { cn } from "@/lib/utils"
import type { Profile } from "@/contexts/auth-context"

type UserListPanelProps = {
  selectedUserId: string | null
  onSelectUser: (user: Profile | null) => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function UserListPanel({
  selectedUserId,
  onSelectUser,
}: UserListPanelProps) {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")

  const fetchProfiles = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setError(null)
    const { data, error: err } = await supabase
      .from("profiles")
      .select("id, name, email, department, role, avatar_url, user_status")
      .order("name")
    if (err) {
      setError(err.message || "Não foi possível carregar os colaboradores.")
      setProfiles([])
      setLoading(false)
      return
    }
    setProfiles((data as Profile[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const filtered = profiles.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    const matchDept =
      departmentFilter === "all" || p.department === departmentFilter
    return matchSearch && matchDept
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={departmentFilter}
          onValueChange={setDepartmentFilter}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SECTORS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-h-[200px] overflow-y-auto rounded-md border bg-muted/30">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Carregando colaboradores...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center text-sm text-muted-foreground">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); fetchProfiles(); }}
              className="text-primary hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Nenhum colaborador encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((user) => {
              const isSelected = selectedUserId === user.id
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => onSelectUser(isSelected ? null : user)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                      isSelected && "bg-primary/10 text-primary"
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0 rounded-full">
                      <AvatarImage
                        src={user.avatar_url ?? undefined}
                        alt={user.name}
                      />
                      <AvatarFallback className="rounded-full text-xs">
                        {getInitials(user.name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">
                        {user.name ?? "Sem nome"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {user.department || "—"}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
