"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SessionGuard() {
  const router = useRouter();
  const [forcedLogoutModal, setForcedLogoutModal] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session-guard", { cache: "no-store" });
        if (res.status === 401 && !isCancelled) {
          const data = await res.json().catch(() => ({}));
          setForcedLogoutModal(
            data.reason ||
              "Sua sessão foi encerrada pelo Administrador devido a alterações em seus privilégios ou credenciais."
          );
        }
      } catch {
        // Ignora erro de rede temporário
      }
    }

    // Checa a cada 20 segundos e sempre que a aba voltar ao foco
    const interval = setInterval(checkSession, 20000);
    const onFocus = () => checkSession();
    window.addEventListener("focus", onFocus);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const handleRedirect = () => {
    window.location.href = "/login";
  };

  if (!forcedLogoutModal) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-rose-200 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl text-rose-600">
          🔒
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Sessão Encerrada pelo Administrador</h3>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">{forcedLogoutModal}</p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRedirect}
            className="w-full min-h-[44px] rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition shadow-md"
          >
            Fazer Login Novamente →
          </button>
        </div>
      </div>
    </div>
  );
}

