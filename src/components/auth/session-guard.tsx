"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

export function SessionGuard() {
  const pathname = usePathname();
  const [invalidReason, setInvalidReason] = useState<
    "PERMISSIONS_UPDATED" | "ACCOUNT_DISABLED" | "UNAUTHENTICATED" | "TAB_CLOSED" | null
  >(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const hasMounted = useRef(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/auth/session-status?t=${Date.now()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }
      );
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        const reason = data.reason || "PERMISSIONS_UPDATED";
        setInvalidReason(reason);
      }
    } catch {
      // Ignora erro transitório de rede
    }
  }, []);

  useEffect(() => {
    // Não executar na página de login (/) para evitar loop de redirecionamento
    if (pathname === "/") return;

    // 1. Tab guard: se a aba foi fechada e reaberta, ou não existe flag de autenticação,
    //    exige novo login (fechou a página = exige novo login).
    const tabSession = sessionStorage.getItem("arqvertice_active_tab_session");
    const tabAuth = sessionStorage.getItem("arqvertice_tab_authenticated");
    if (!tabSession || tabAuth !== "true") {
      setInvalidReason("TAB_CLOSED");
      return;
    }

    // 2. Delay de 1000ms antes da primeira verificação para garantir que
    //    os cookies do login já estejam consolidados no navegador.
    const timer = setTimeout(() => {
      checkSession();
    }, 1000);

    // 3. Verificação periódica a cada 10 segundos
    const interval = setInterval(checkSession, 10000);

    // 4. Verificação ao focar a janela ou mudar visibilidade
    const onFocus = () => checkSession();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // 5. Timeout por inatividade: 30 minutos sem interação encerra a sessão
    const resetInactivity = () => {
      sessionStorage.setItem("arqvertice_last_activity", String(Date.now()));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        setInvalidReason("UNAUTHENTICATED");
      }, INACTIVITY_MS);
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
  }, [pathname, checkSession, INACTIVITY_MS]);

  // 4. Verificação a cada mudança de rota (exceto /)
  useEffect(() => {
    if (pathname === "/") return;
    checkSession();
  }, [pathname, checkSession]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    sessionStorage.removeItem("arqvertice_active_tab_session");
    try {
      await fetch("/api/auth/logout?reason=FORCED_LOGOUT", {
        method: "POST",
      }).catch(() => null);
    } finally {
      window.location.href = "/?updated=1";
    }
  };

  if (!invalidReason) return null;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-zinc-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl border border-zinc-200 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl text-amber-600 border border-amber-200">
          🛡️
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">
            Atualização de Permissões e Governança
          </h3>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {invalidReason === "TAB_CLOSED"
              ? "Esta aba ou janela foi fechada. Por motivos de segurança, é necessário fazer login novamente para acessar o ArqVértice Flow."
              : invalidReason === "ACCOUNT_DISABLED"
              ? "Esta conta foi desativada pelo Administrador. Para mais informações, entre em contato com a gestão."
              : "O administrador atualizou suas permissões de acesso, atribuições ou credenciais. Para garantir a consistência dos dados e carregar seu painel atualizado, encerre esta sessão e entre novamente."}
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
