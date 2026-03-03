"use client"

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { getMessaging, isSupported, type Messaging } from "firebase/messaging"
import { firebaseConfig } from "./config"

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  }
  return app
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null
  const supported = await isSupported()
  if (!supported) return null
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!messaging) {
    messaging = getMessaging(firebaseApp)
  }
  return messaging
}
