import { createClient } from "@supabase/supabase-js"

/**
 * Supabase client with service role key. Use only in server-side code (e.g. API routes)
 * that must bypass RLS (e.g. reading FCM tokens for any user when sending push).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key)
}
