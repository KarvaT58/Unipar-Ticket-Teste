"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export type Profile = {
  id: string
  name: string
  email: string
  department: string
  role: string
  avatar_url?: string | null
  user_status?: string | null
}

type AuthContextType = {
  profile: Profile | null
  isLoading: boolean
  setProfile: (p: Profile | null) => void
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [isLoading, setLoading] = React.useState(true)
  const supabase = createClient()
  const router = useRouter()

  const fetchProfile = React.useCallback(
    async (userId: string) => {
      if (!supabase) return
      const { data: base } = await supabase
        .from("profiles")
        .select("id, name, email, department, role, avatar_url")
        .eq("id", userId)
        .single()
      if (!base) {
        setProfile(null)
        return
      }
      const { data: extra } = await supabase
        .from("profiles")
        .select("user_status")
        .eq("id", userId)
        .single()
      setProfile({
        ...base,
        user_status: extra?.user_status ?? null,
      } as Profile)
    },
    [supabase]
  )

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  React.useEffect(() => {
    if (!supabase || !profile?.id) return
    const channel = supabase
      .channel("profile-status-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const next = payload.new as { user_status?: string | null }
          if (next && "user_status" in next) {
            setProfile((prev) => (prev ? { ...prev, user_status: next.user_status ?? null } : null))
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile?.id])

  const signOut = React.useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setProfile(null)
    router.push("/login")
  }, [supabase, router])

  return (
    <AuthContext.Provider
      value={{ profile, isLoading, setProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
