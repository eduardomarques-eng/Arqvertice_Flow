import { Suspense } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

/**
 * Entrada única da aplicação com autenticação explícita obrigatória.
 * Nenhum usuário entra automaticamente sem autenticar-se novamente na tela inicial.
 */
export default async function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      <Brand decorative className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[5] opacity-[0.06] select-none mix-blend-multiply sm:scale-[7]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-sm backdrop-blur">
        <Brand />

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Arquitetura e Engenharia</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Acompanhe o seu projeto, receba propostas e contratos, e fale directamente com o estúdio.
        </p>

        <Suspense fallback={<div className="mt-8 h-48 animate-pulse rounded-xl bg-slate-100" />}>
          <LoginForm />
        </Suspense>

        <div className="mt-8 space-y-3">
          <Link href="/cadastro" className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50">
            Criar conta de cliente
          </Link>
          <Link href="/recuperar-senha" className="block pt-2 text-center text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700">
            Esqueci a senha
          </Link>
        </div>
      </div>
    </main>
  );
}
