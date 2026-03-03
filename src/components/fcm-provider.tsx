"use client"

import * as React from "react"
import { getToken, onMessage } from "firebase/messaging"
import { useAuth } from "@/contexts/auth-context"
import { getFirebaseMessaging } from "@/lib/firebase/client"
import { vapidKey, isFirebaseConfigured } from "@/lib/firebase/config"
import { toast } from "sonner"

const REGISTER_URL = "/api/push/register"

async function registerFCMToken(token: string): Promise<boolean> {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  })
  return res.ok
}

/**
 * When user is logged in and Firebase is configured, requests notification permission,
 * gets FCM token, registers it with the backend, and shows a toast for foreground messages.
 */
export function FCMProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const registeredRef = React.useRef(false)

  React.useEffect(() => {
    if (!profile?.id || !isFirebaseConfigured() || !vapidKey) return
    if (registeredRef.current) return

    let cancelled = false
    ;(async () => {
      try {
        const messaging = await getFirebaseMessaging()
        if (!messaging || cancelled) return
        const permission = await Notification.requestPermission()
        if (permission !== "granted" || cancelled) return
        const token = await getToken(messaging, { vapidKey })
        if (!token || cancelled) return
        const ok = await registerFCMToken(token)
        if (ok) registeredRef.current = true
      } catch {
        // Permission denied or FCM not available
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  React.useEffect(() => {
    if (!isFirebaseConfigured()) return
    let unsubscribe: (() => void) | undefined
    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return
      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "Notificação"
        const body = payload.notification?.body ?? ""
        toast.info(title, { description: body })
      })
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  return <>{children}</>
}
