import type { ServiceAccount } from "firebase-admin/app"
import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app"
import { getMessaging, type Messaging } from "firebase-admin/messaging"

let messaging: Messaging | null = null

function getFirebaseAdminApp(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (!projectId || !clientEmail || !privateKey) return null
  if (getApps().length > 0) return getApp() as App
  const credential = cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  } as ServiceAccount)
  return initializeApp({ credential })
}

export function getAdminMessaging(): Messaging | null {
  if (!messaging) {
    const app = getFirebaseAdminApp()
    if (!app) return null
    messaging = getMessaging(app)
  }
  return messaging
}

export function isAdminConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}
