import Image from "next/image"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Lateral esquerda: fundo vermelho #df1631, igual à referência */}
      <div
        className="flex flex-col justify-between p-6 text-white md:p-10 lg:p-12"
        style={{ backgroundColor: "#df1631" }}
      >
        <div className="flex flex-col gap-6">
          {/* Logo: caixa com borda branca e fundo branco bem suave */}
          <div className="inline-flex w-fit items-center justify-center rounded-lg border-2 border-white bg-white/10 px-4 py-2.5">
            <Image
              src="/logo-unipar.png"
              alt="UNIPAR"
              width={140}
              height={42}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl lg:text-4xl">
              Sistema de Chamados
            </h1>
            <p className="max-w-md text-sm text-white/95 md:text-base">
              Gerencie seus chamados de forma eficiente e acompanhe o status em tempo real.
            </p>
          </div>
        </div>
        {/* Três cards: borda branca fina, fundo quase transparente */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="rounded-lg border border-white bg-white/5 px-4 py-3">
            <p className="font-semibold text-white">Integração</p>
            <p className="text-sm text-white/90">Entre setores</p>
          </div>
          <div className="rounded-lg border border-white bg-white/5 px-4 py-3">
            <p className="font-semibold text-white">Atendimento</p>
            <p className="text-sm text-white/90">Especializado</p>
          </div>
          <div className="rounded-lg border border-white bg-white/5 px-4 py-3">
            <p className="font-semibold text-white">Monitoramento</p>
            <p className="text-sm text-white/90">Em tempo real</p>
          </div>
        </div>
      </div>

      {/* Painel direito: fundo branco, card do formulário */}
      <div className="flex flex-col items-center justify-center bg-white p-6 md:p-10">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-lg md:p-8">
          <LoginForm />
        </div>
        <p className="mt-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} UNIPAR. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
