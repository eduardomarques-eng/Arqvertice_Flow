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

type InvalidReason =
  | "PERMISSIONS_UPDATED"
  | "ACCOUNT_DISABLED"
  | "UNAUTHENTICATED"
  | "TAB_CLOSED"
  | "BUILD_UPDATED"
  | null;

const REASON_COPY: Record<"PERMISSIONS_UPDATED" | "ACCOUNT_DISABLED", { title: string; body: string }> = {
  PERMISSIONS_UPDATED: {
    title: "Atualização de Permissões e Governança",
    body: "O administrador atualizou suas permissões de acesso, atribuições ou credenciais. Para garantir a consistência dos dados e carregar seu painel atualizado, encerre esta sessão e entre novamente.",
  },
  ACCOUNT_DISABLED: {
    title: "Conta Desativada",
    body: "Esta conta foi desativada pelo Administrador. Para mais informações, entre em contato com a gestão.",
  },
};

export function SessionGuard() {
  const pathname = usePathname();
  const [invalidReason, setInvalidReason] = useState<InvalidReason>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityMsRef = useRef<number>(30 * 60 * 1000);
  const redirectingRef = useRef(false);

  const forceImmediateLogout = useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    sessionStorage.removeItem("arqvertice_active_tab_session");
    sessionStorage.removeItem("arqvertice_tab_authenticated");
    sessionStorage.removeItem("arqvertice_build_id");
    fetch("/api/auth/logout", { method: "POST" })
      .catch(() => null)
      .finally(() => {
        window.location.replace("/");
      });
  }, []);

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
        if (data.reason === "PERMISSIONS_UPDATED" || data.reason === "ACCOUNT_DISABLED") {
          setInvalidReason(data.reason);
        } else if (data.reason === "BUILD_UPDATED") {
          setInvalidReason("BUILD_UPDATED");
          forceImmediateLogout();
        } else {
          setInvalidReason("UNAUTHENTICATED");
          forceImmediateLogout();
        }
      }
    } catch {
      // Ignora erro transitório de rede
    }
  }, [forceImmediateLogout]);

  useEffect(() => {
    if (isPublicRoute(pathname)) return;

    const tabSession = sessionStorage.getItem("arqvertice_active_tab_session");
    const tabAuth = sessionStorage.getItem("arqvertice_tab_authenticated");
    const tabBuildId = sessionStorage.getItem("arqvertice_build_id");
    const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID;

    if (!tabSession || tabAuth !== "true") {
      setInvalidReason("TAB_CLOSED");
      forceImmediateLogout();
      return;
    }

    if (currentBuildId && tabBuildId !== currentBuildId) {
      setInvalidReason("BUILD_UPDATED");
      forceImmediateLogout();
      return;
    }

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
        forceImmediateLogout();
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
  }, [pathname, checkSession, forceImmediateLogout]);

  const handleManualLogout = async () => {
    setIsLoggingOut(true);
    sessionStorage.removeItem("arqvertice_active_tab_session");
    sessionStorage.removeItem("arqvertice_tab_authenticated");
    sessionStorage.removeItem("arqvertice_build_id");
    try {
      await fetch("/api/auth/logout?reason=FORCED_LOGOUT", { method: "POST" }).catch(() => null);
    } finally {
      window.location.replace("/?updated=1");
    }
  };

  if (!invalidReason) return null;

  // Para aba fechada, sessão expirada ou novo build publicado: overlay limpo tela cheia sem exibir conteúdo atrás
  if (invalidReason === "TAB_CLOSED" || invalidReason === "BUILD_UPDATED" || invalidReason === "UNAUTHENTICATED") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <p className="text-xs font-medium text-slate-500">Redirecionando para autenticação...</p>
        </div>
      </div>
    );
  }

  const copy = REASON_COPY[invalidReason];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/95 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl border border-slate-200 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl text-amber-600 border border-amber-200">
          🛡️
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">{copy.title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">{copy.body}</p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleManualLogout}
            className="w-full min-h-[44px] rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
