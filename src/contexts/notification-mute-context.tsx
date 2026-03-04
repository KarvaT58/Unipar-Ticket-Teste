"use client"

import * as React from "react"

const STORAGE_KEY = "notification-sound-muted"

function getStored(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

type NotificationMuteContextType = {
  muted: boolean
  setMuted: (value: boolean) => void
}

const NotificationMuteContext = React.createContext<NotificationMuteContextType | undefined>(undefined)

export function NotificationMuteProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMutedState] = React.useState(false)

  React.useEffect(() => {
    setMutedState(getStored())
  }, [])

  const setMuted = React.useCallback((value: boolean) => {
    setMutedState(value)
    try {
      if (value) localStorage.setItem(STORAGE_KEY, "true")
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const value = React.useMemo(() => ({ muted, setMuted }), [muted, setMuted])

  return (
    <NotificationMuteContext.Provider value={value}>
      {children}
    </NotificationMuteContext.Provider>
  )
}

export function useNotificationMute() {
  const ctx = React.useContext(NotificationMuteContext)
  if (ctx === undefined) {
    return { muted: false, setMuted: () => {} }
  }
  return ctx
}
