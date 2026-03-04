"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { IconBulb, IconPlus, IconUsers, IconUser } from "@tabler/icons-react"
import type { EditingIdea } from "./idea-submit-form"
import { IdeaList } from "./idea-list"
import { IdeaSubmitForm } from "./idea-submit-form"
import { MyIdeasList } from "./my-ideas-list"

function canViewIdeas(profile: { department: string; role: string } | null): boolean {
  if (!profile) return false
  return (
    profile.department === "TI" ||
    profile.department === "ADMINISTRAÇÃO" ||
    profile.role === "admin"
  )
}

export default function IdeiasPage() {
  const { profile } = useAuth()
  const isPrivileged = canViewIdeas(profile)
  const [editingIdea, setEditingIdea] = React.useState<EditingIdea | null>(null)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const handleSaved = React.useCallback(() => {
    setEditingIdea(null)
    setRefreshTrigger((prev) => prev + 1)
    setDialogOpen(false)
  }, [])

  const handleCancelEdit = React.useCallback(() => {
    setEditingIdea(null)
    setDialogOpen(false)
  }, [])

  const handleEditIdea = React.useCallback((idea: EditingIdea) => {
    setEditingIdea(idea)
    setDialogOpen(true)
  }, [])

  const myIdeasContent = (
    <div className="w-full max-w-full space-y-6 pt-2">
      <div className="flex items-center gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setEditingIdea(null)}
              className="gap-2"
            >
              <IconPlus className="size-4" />
              Criar ideia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <IdeaSubmitForm
              editingIdea={editingIdea}
              onCancelEdit={handleCancelEdit}
              onSaved={handleSaved}
              inDialog
            />
          </DialogContent>
        </Dialog>
      </div>
      {profile && (
        <>
          <Separator className="my-6" />
          <MyIdeasList
            onEdit={handleEditIdea}
            refreshTrigger={refreshTrigger}
          />
        </>
      )}
    </div>
  )

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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader
            title="Ideias"
            description="Envie sugestões de forma anônima."
            icon={<IconBulb className="size-5" />}
          />
          <div className="flex-1 overflow-auto px-4 pb-6 lg:px-6 w-full">
            {isPrivileged ? (
              <Tabs defaultValue="minhas" className="w-full pt-2">
                <TabsList className="mb-4">
                  <TabsTrigger value="minhas" className="gap-2">
                    <IconUser className="size-4" />
                    Minhas ideias
                  </TabsTrigger>
                  <TabsTrigger value="outros" className="gap-2">
                    <IconUsers className="size-4" />
                    Ideias dos outros
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="minhas" className="mt-0">
                  {myIdeasContent}
                </TabsContent>
                <TabsContent value="outros" className="mt-0">
                  <IdeaList />
                </TabsContent>
              </Tabs>
            ) : (
              myIdeasContent
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
