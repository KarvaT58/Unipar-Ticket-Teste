"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Loan } from "@/lib/emprestimos/types"

export function useOverdueLoans() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [overdueLoans, setOverdueLoans] = useState<Loan[]>([])

  const fetchOverdue = useCallback(() => {
    if (!supabase || !profile) {
      setOverdueLoans([])
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from("loans")
      .select("*")
      .eq("borrower_id", profile.id)
      .is("returned_at", null)
      .lt("return_date", today)
      .order("return_date", { ascending: true })
      .then(({ data }) => {
        setOverdueLoans((data as Loan[]) ?? [])
      })
  }, [supabase, profile])

  useEffect(() => {
    fetchOverdue()
  }, [fetchOverdue])

  return { overdueLoans, refetch: fetchOverdue }
}
