import Image from "next/image"

import { LoginForm } from "@/components/login-form"
import {
  IconHeadset,
  IconMessageCircle,
  IconCheckbox,
  IconPackage,
  IconBulb,
  IconCalendarEvent,
} from "@tabler/icons-react"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Coluna esquerda: identidade + explicativo — visual profissional */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-primary p-6 text-primary-foreground md:p-10 lg:p-12 dark:bg-primary/95">
        {/* Detalhe sutil de profundidade */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/5 via-transparent to-transparent pointer-events-none" aria-hidden />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-primary-foreground/[0.03] rounded-full blur-3xl pointer-events-none" aria-hidden />

        <div className="relative flex flex-col gap-10">
          {/* Logo com apresentação profissional */}
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center justify-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-3 shadow-sm">
              <Image
                src="/logo-unipar.png"
                alt="UNIPAR"
                width={140}
                height={42}
                className="h-10 w-auto object-contain"
                priority
              />
            </div>
            <div className="space-y-4 border-l-2 border-primary-foreground/30 pl-5">
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl lg:text-[2rem] lg:leading-tight">
                Sistema de Chamados e Gestão
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-primary-foreground/90 md:text-base">
                Central de atendimento, ferramentas colaborativas e controle de empréstimos em um só lugar.
              </p>
            </div>
          </div>

          {/* Funcionalidades em lista organizada */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">
              O que você encontra no sistema
            </p>
            <ul className="grid gap-4 text-sm text-primary-foreground/95 sm:grid-cols-2">
              <li className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <IconHeadset className="size-4 text-white" />
                </span>
                <span className="pt-0.5">Atendimentos e fila de chamados em tempo real</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <IconMessageCircle className="size-4 text-white" />
                </span>
                <span className="pt-0.5">Chat interno e grupos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <IconCheckbox className="size-4 text-white" />
                </span>
                <span className="pt-0.5">Tarefas e acompanhamento</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <IconPackage className="size-4 text-white" />
                </span>
                <span className="pt-0.5">Empréstimos e controle de itens</span>
              </li>
              <li className="flex items-start gap-3 sm:col-span-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <IconCalendarEvent className="size-4 text-white" />
                </span>
                <span className="pt-0.5">Anúncios, eventos e envio de ideias</span>
              </li>
              <li className="flex items-start gap-3 sm:col-span-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <IconBulb className="size-4 text-white" />
                </span>
                <span className="pt-0.5">Ajuda e lista de ramais integrados</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Cards de diferenciais — visual corporativo */}
        <div className="relative mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-semibold text-white">Integração</p>
            <p className="mt-0.5 text-xs text-primary-foreground/80">Entre setores</p>
          </div>
          <div className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-semibold text-white">Atendimento</p>
            <p className="mt-0.5 text-xs text-primary-foreground/80">Especializado</p>
          </div>
          <div className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-semibold text-white">Monitoramento</p>
            <p className="mt-0.5 text-xs text-primary-foreground/80">Em tempo real</p>
          </div>
        </div>
      </div>

      {/* Coluna direita: área de login centralizada — usa tokens do tema (claro/escuro) */}
      <div className="flex flex-col items-center justify-center bg-background p-6 md:p-10">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg md:p-8">
          <LoginForm />
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} UNIPAR. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
