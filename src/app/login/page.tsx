"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpdated = searchParams.get("updated") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || "E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }

      const role = data?.user?.role;
      if (role === "CLIENTE") {
        router.push("/portal");
      } else {
        router.push("/admin");
      }
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 sm:p-6">
      <header className="w-full max-w-md mx-auto pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          ← Voltar ao início
        </Link>
        <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
          ArqVértice Flow
        </span>
      </header>

      <main className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/70 text-[11px] font-mono text-zinc-300 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Acesso Corporativo & Portal
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Entrar no Sistema
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Informe suas credenciais homologadas para acessar seu ambiente operacional.
            </p>
          </div>

          {isUpdated && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
              Suas permissões de acesso foram atualizadas pelo administrador. Entre novamente para carregar seu painel atualizado.
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-zinc-300 mb-1.5"
              >
                E-mail Corporativo
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nome@arqvertice.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-zinc-300 mb-1.5"
              >
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-16 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400 hover:text-white"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Autenticando..." : "Entrar no Painel"}
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-md mx-auto pb-4 text-center text-[11px] text-zinc-600">
        ArqVértice Studio · Engenharia, Arquitetura & Gestão
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-xs text-zinc-400">
          Carregando autenticação...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
