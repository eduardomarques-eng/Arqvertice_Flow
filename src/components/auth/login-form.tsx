"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/auth-routes";
import { isPathAllowed } from "@/lib/route-isolation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpdated = searchParams.get("updated") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") || email).trim().toLowerCase();
    const submittedPassword = String(formData.get("password") || password);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: submittedEmail,
          password: submittedPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setError(
            retryAfter
              ? `Muitas tentativas de acesso. Aguarde ${retryAfter} segundos e tente novamente.`
              : "Muitas tentativas de acesso. Aguarde alguns instantes e tente novamente."
          );
        } else {
          setError(data?.error || "E-mail ou senha inválidos.");
        }
        setLoading(false);
        return;
      }

      sessionStorage.setItem("arqvertice_active_tab_session", "1");
      sessionStorage.setItem("arqvertice_tab_authenticated", "true");
      sessionStorage.setItem(
        "arqvertice_build_id",
        data?.user?.buildId || process.env.NEXT_PUBLIC_BUILD_ID || ""
      );
      sessionStorage.setItem("arqvertice_last_activity", String(Date.now()));
      const role = data?.user?.role;
      const nextParam = searchParams.get("next");
      const defaultRoute = getDefaultRouteForRole(role);
      let targetRoute = defaultRoute;
      if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
        if (isPathAllowed(nextParam, role)) {
          targetRoute = nextParam;
        }
      }
      router.push(targetRoute);
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      {isUpdated && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          Suas permissões de acesso foram atualizadas pelo administrador. Entre novamente para carregar seu painel.
        </div>
      )}

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium text-slate-600 mb-1.5"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nome@arqvertice.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium text-slate-600 mb-1.5"
        >
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 pl-3.5 pr-16 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 hover:text-slate-600"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Autenticando..." : "Entrar"}
      </button>
    </form>
  );
}