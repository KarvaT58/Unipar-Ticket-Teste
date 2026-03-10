"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IconPhone, IconPlus, IconPencil, IconTrash, IconSearch } from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import type { RamalRow } from "./ramal-form-dialog"
import { RamalFormDialog } from "./ramal-form-dialog"

function isAdminRole(role: string | undefined): boolean {
  return role === "admin" || role === "adm"
}

export default function ListaRamaisPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [ramais, setRamais] = React.useState<RamalRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingRamal, setEditingRamal] = React.useState<RamalRow | null>(null)
  const [search, setSearch] = React.useState("")
  const isAdmin = isAdminRole(profile?.role)

  const fetchRamais = React.useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from("ramais")
      .select("id, sector_name, extension_number, person_name, created_at, updated_at")
      .order("sector_name")
      .order("extension_number")
    setLoading(false)
    if (error) {
      toast.error("Não foi possível carregar a lista de ramais.")
      return
    }
    setRamais((data as RamalRow[]) ?? [])
  }, [supabase])

  React.useEffect(() => {
    fetchRamais()
  }, [fetchRamais])

  const handleSaved = React.useCallback(() => {
    setEditingRamal(null)
    fetchRamais()
  }, [fetchRamais])

  const handleOpenAdd = React.useCallback(() => {
    setEditingRamal(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = React.useCallback((row: RamalRow) => {
    setEditingRamal(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!supabase || !isAdmin) return
      if (!confirm("Deseja realmente excluir este ramal?")) return
      const { error } = await supabase.from("ramais").delete().eq("id", id)
      if (error) {
        toast.error("Não foi possível excluir o ramal.")
        return
      }
      toast.success("Ramal excluído.")
      fetchRamais()
    },
    [supabase, isAdmin, fetchRamais]
  )

  const filteredRamais = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return ramais
    return ramais.filter(
      (r) =>
        r.sector_name.toLowerCase().includes(term) ||
        (r.person_name?.toLowerCase().includes(term) ?? false)
    )
  }, [ramais, search])

  return (
    <SidebarProvider
      className="h-svh max-h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-page-enter">
          <PageHeader
            title="Lista de ramais"
            description="Consulte a lista de ramais da empresa."
            icon={<IconPhone className="size-5" />}
          />
          <div className="flex-1 overflow-auto px-4 pb-6 lg:px-6 w-full">
            <div className="mx-auto w-full max-w-full space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Buscar por setor ou pessoa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {isAdmin && (
                <div className="flex items-center justify-end gap-2">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={handleOpenAdd} className="gap-2">
                        <IconPlus className="size-4" />
                        Adicionar ramal
                      </Button>
                    </DialogTrigger>
                    <RamalFormDialog
                      open={dialogOpen}
                      onOpenChange={setDialogOpen}
                      editingRamal={editingRamal}
                      onSaved={handleSaved}
                    />
                  </Dialog>
                </div>
              )}
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : ramais.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  Nenhum ramal cadastrado.
                  {isAdmin && " Use o botão acima para adicionar."}
                </div>
              ) : filteredRamais.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  Nenhum ramal corresponde à busca.
                </div>
              ) : (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Setor</TableHead>
                        <TableHead>Ramal</TableHead>
                        <TableHead>Pessoa</TableHead>
                        {isAdmin && (
                          <TableHead className="w-[100px] text-right">
                            Ações
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRamais.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.sector_name}
                          </TableCell>
                          <TableCell>{row.extension_number}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.person_name ?? "—"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => handleEdit(row)}
                                  title="Editar"
                                >
                                  <IconPencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(row.id)}
                                  title="Excluir"
                                >
                                  <IconTrash className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
