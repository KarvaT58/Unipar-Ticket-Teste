# Firebase Cloud Messaging (FCM) — Push de notificações

O sistema envia **todas** as notificações (chat, anúncios, tarefas, atendimentos) também via Firebase Cloud Messaging, para o usuário receber push no navegador (e no celular se usar PWA).

## 1. Firebase

1. Crie um projeto em [Firebase Console](https://console.firebase.google.com).
2. Adicione um app **Web** (ícone `</>`).
3. Em **Project Settings** > **Cloud Messaging**:
   - Gere um par de chaves **Web Push certificates** (VAPID).
   - Copie a chave **pública** para `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Em **Project Settings** > **Service accounts**:
   - Gere uma nova chave privada (JSON).
   - Use `project_id`, `client_email` e `private_key` para `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` no `.env.local`.
5. No `.env.local`, preencha também as variáveis `NEXT_PUBLIC_FIREBASE_*` com o config do app Web.

## 2. Service worker (push em background)

O arquivo `public/firebase-messaging-sw.js` precisa usar o **mesmo** config do app:

- Abra `public/firebase-messaging-sw.js`.
- Substitua o objeto `firebaseConfig` pelos valores do seu projeto (os mesmos de `NEXT_PUBLIC_FIREBASE_*`).

Assim o push continua funcionando quando a aba está fechada.

## 3. Webhook no Supabase

Para cada inserção na tabela `notifications` disparar o envio de push:

1. No [Supabase Dashboard](https://supabase.com/dashboard) do projeto, vá em **Database** > **Webhooks**.
2. **Create a new hook**:
   - **Name:** `push-on-notification`
   - **Table:** `notifications`
   - **Events:** marque **Insert**
   - **URL:** `https://SEU_DOMINIO/api/push/webhook` (ex.: `https://meu-app.vercel.app/api/push/webhook`)
   - **HTTP Headers:** adicione `Authorization: Bearer SEU_SUPABASE_WEBHOOK_SECRET` (defina um segredo e coloque o mesmo valor em `SUPABASE_WEBHOOK_SECRET` no `.env` do servidor).
3. Salve.

Com isso, sempre que uma linha for inserida em `notifications`, o Supabase chama a URL e o backend envia o push via FCM para os dispositivos do usuário.

## 4. Resumo de variáveis

| Variável | Onde | Uso |
|----------|------|-----|
| `NEXT_PUBLIC_FIREBASE_*` | .env.local | Cliente (pedir permissão, token, toast em foreground) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | .env.local | Cliente (getToken) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | .env (servidor) | API route `/api/push/webhook` (enviar push) |
| `SUPABASE_WEBHOOK_SECRET` | .env (servidor) | Proteger o webhook (opcional) |
| `SUPABASE_SERVICE_ROLE_KEY` | .env (servidor) | Ler tabela `fcm_tokens` no webhook |

Se as variáveis do Firebase não estiverem definidas, o app continua funcionando; apenas o push FCM fica desativado.
