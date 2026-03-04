"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { IconEye, IconEyeOff } from "@tabler/icons-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Erro ao entrar. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={onSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-gray-500">
            Entre com suas credenciais para acessar
          </p>
        </div>
        {!supabase && (
          <p className="rounded-md bg-amber-50 p-3 text-center text-sm text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
            Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local e reinicie o servidor.
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
        <Field>
          <FieldLabel htmlFor="email" className="text-gray-700">
            E-mail
          </FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="ti.cas@unipar.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border-gray-200 bg-white text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password" className="text-gray-700">
            Senha
          </FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border-gray-200 bg-white pr-9 text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? (
                <IconEyeOff className="size-4" />
              ) : (
                <IconEye className="size-4" />
              )}
            </button>
          </div>
        </Field>
        <Field>
          <Button
            type="submit"
            className="w-full rounded-lg font-semibold"
            disabled={loading || !supabase}
          >
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
