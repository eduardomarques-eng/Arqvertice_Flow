"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/privacidade",
  "/cookies",
  "/termos",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return pathname.startsWith("/briefing/") || pathname.startsWith("/briefing-proposta/");
}

type InvalidReason = "PERMISSIONS_UPDATED" | "ACCOUNT_DISABLED" | "UNAUTHENTICATED" | "TAB_CLOSED" | null;

const REASON_COPY: Record<Exclude<InvalidReason, null>, { title: string; body: string }> = {
  PERMISSIONS_UPDATED: {
    title: "Atualização de Permissões e Governança",
    body: "O administrador atualizou suas permissões de acesso, atribuições ou credenciais. Para garantir a consistência dos dados e carregar seu painel atualizado, encerre esta sessão e entre novamente.",
  },
  ACCOUNT_DISABLED: {
    title: "Conta Desativada",
    body: "Esta conta foi desativada pelo Administrador. Para mais informações, entre em contato com a gestão.",
  },
  TAB_CLOSED: {
    title: "Nova Sessão Necessária",
    body: "Esta aba foi fechada ou aberta fora de uma sessão ativa. Por motivos de segurança, faça login novamente para acessar o ArqVértice Flow.",
  },
  UNAUTHENTICATED: {
    title: "Sessão Expirada",
    body: "Sua sessão expirou por inatividade ou tempo limite. Faça login novamente para continuar.",
  },
};

export function SessionGuard() {
  const pathname = usePathname();
  const [invalidReason, setInvalidReason] = useState<InvalidReason>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityMsRef = useRef<number>(30 * 60 * 1000);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/session-status?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.valid) {
          setInvalidReason(null);
          if (typeof data.inactivityTimeoutMin === "number" && data.inactivityTimeoutMin >= 5) {
            inactivityMsRef.current = data.inactivityTimeoutMin * 60 * 1000;
          }
        }
        return;
      }
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        const reason: Exclude<InvalidReason, null> =
          data.reason === "PERMISSIONS_UPDATED" ||
          data.reason === "ACCOUNT_DISABLED" ||
          data.reason === "UNAUTHENTICATED"
            ? data.reason
            : "UNAUTHENTICATED";
        setInvalidReason(reason);
      }
    } catch {
      // Ignora erro transitório de rede
    }
  }, []);

  useEffect(() => {
    if (isPublicRoute(pathname)) return;

    // Tab guard: exige que a aba tenha sido autenticada na sessão atual
    const tabSession = sessionStorage.getItem("arqvertice_active_tab_session");
    const tabAuth = sessionStorage.getItem("arqvertice_tab_authenticated");
    if (!tabSession || tabAuth !== "true") {
      setInvalidReason("TAB_CLOSED");
      return;
    }

    // Delay inicial para consolidar cookies após login/navegação
    const timer = setTimeout(() => {
      checkSession();
    }, 1000);

    const interval = setInterval(checkSession, 15000);

    const onFocus = () => checkSession();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const resetInactivity = () => {
      sessionStorage.setItem("arqvertice_last_activity", String(Date.now()));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        setInvalidReason("UNAUTHENTICATED");
      }, inactivityMsRef.current);
    };
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, resetInactivity));
    resetInactivity();

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      events.forEach((evt) => window.removeEventListener(evt, resetInactivity));
    };
  }, [pathname, checkSession]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const reason = invalidReason;
    sessionStorage.removeItem("arqvertice_active_tab_session");
    sessionStorage.removeItem("arqvertice_tab_authenticated");
    try {
      const query = reason === "PERMISSIONS_UPDATED" ? "?reason=FORCED_LOGOUT" : "";
      await fetch(`/api/auth/logout${query}`, { method: "POST" }).catch(() => null);
    } finally {
      window.location.href = reason === "PERMISSIONS_UPDATED" ? "/?updated=1" : "/";
    }
  };

  if (!invalidReason) return null;

  const copy = REASON_COPY[invalidReason];

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-zinc-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl border border-zinc-200 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl text-amber-600 border border-amber-200">
          🛡️
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">
            {copy.title}
          </h3>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {copy.body}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleLogout}
            className="w-full min-h-[44px] rounded-xl bg-zinc-950 px-5 py-3 text-xs font-bold text-white hover:bg-zinc-800 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoggingOut ? (
              <span>Encerrando sessão...</span>
            ) : (
              <>
                <span>Sair e Entrar Novamente</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
