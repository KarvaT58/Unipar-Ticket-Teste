import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const token = typeof body?.token === "string" ? body.token.trim() : null
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }
    const { error } = await supabase.from("fcm_tokens").upsert(
      { user_id: user.id, token },
      { onConflict: "user_id,token" }
    )
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
