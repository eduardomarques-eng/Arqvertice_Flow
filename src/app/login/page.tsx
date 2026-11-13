"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

function LoginForm() {
  const searchParams = useSearchParams();
  const isUpdated = searchParams.get("updated") === "1";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });

    if (!response.ok) {
      setError((await response.json()).error ?? "Não foi possível entrar.");
    } else {
      const user = (await response.clone().json()).user as { role: string };
      window.location.assign(
        user.role === "ADMIN"
          ? "/admin"
          : user.role === "EQUIPE" || user.role === "OPERADOR"
          ? "/equipe"
          : "/portal"
      );
    }
    setPending(false);
  }

  return (
    <form
      action={submit}
      className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-sm backdrop-blur"
    >
      <Brand />

      {/* Banner Informativo Discreto de Atualização de Permissões */}
      {isUpdated && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2 animate-in fade-in">
          <span>🛡️</span>
          <span>Suas permissões foram atualizadas. Faça login para acessar seu ambiente.</span>
        </div>
      )}

      {/* "Esqueci a senha" fica logo abaixo da marca, antes do formulário. */}
      <p className="mt-5 text-sm text-slate-500">
        Acesse o estúdio ou o portal do cliente.{" "}
        <Link
          href="/recuperar-senha"
          className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700"
        >
          Esqueci a senha
        </Link>
      </p>

      <h1 className="mt-8 text-2xl font-bold text-slate-950">Entrar</h1>

      <label className="mt-6 block text-sm font-semibold text-slate-700">
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Senha
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-6 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      <Brand
        decorative
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[5] opacity-[0.06] select-none mix-blend-multiply sm:scale-[7]"
      />

      <Suspense fallback={<div className="w-full max-w-md h-96 bg-white/50 rounded-2xl animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
