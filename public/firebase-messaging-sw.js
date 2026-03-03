/* eslint-disable no-restricted-globals */
/**
 * Firebase Cloud Messaging Service Worker — push em background.
 * Substitua firebaseConfig pelos valores do seu projeto no Firebase Console.
 * Coloque este arquivo em public/firebase-messaging-sw.js (já está).
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js")

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
}

firebase.initializeApp(firebaseConfig)
const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Notificação"
  const options = {
    body: payload.notification?.body ?? "",
    icon: "/favicon.ico",
    data: payload.data ?? {},
    tag: payload.data?.notificationId ?? "notification",
  }
  self.registration.showNotification(title, options)
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const type = data.type
  let path = "/dashboard"
  if (type === "chat_message" || type === "chat_priority_message") {
    if (data.chat_conversation_id) path = `/dashboard/chat-interno?conversation=${data.chat_conversation_id}`
  } else if (type === "new_announcement") {
    path = "/dashboard/anuncios-eventos"
  } else if (data.ticket_id) {
    path = `/dashboard/atendimentos/${data.ticket_id}`
  } else if (data.task_id || type === "task_deadline") {
    path = "/dashboard/tarefas"
  }
  const url = new URL(path, self.location.origin).href
  event.waitUntil(clients.openWindow(url))
})
