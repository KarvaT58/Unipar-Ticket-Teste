"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"

const INACTIVITY_MS = 20 * 60 * 1000 // 20 minutes
const CHECK_INTERVAL_MS = 30 * 1000 // check every 30 seconds

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const

export function InactivityHandler() {
  const { profile, signOut } = useAuth()
  const lastActivityRef = useRef<number>(Date.now())

  const checkInactivity = useCallback(() => {
    if (!profile) return
    if (Date.now() - lastActivityRef.current >= INACTIVITY_MS) {
      signOut()
    }
  }, [profile, signOut])

  useEffect(() => {
    if (!profile) return

    const onActivity = () => {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, onActivity)
    })

    const interval = setInterval(checkInactivity, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, onActivity)
      })
      clearInterval(interval)
    }
  }, [profile, checkInactivity])

  return null
}
