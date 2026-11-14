"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Service worker registrado
        })
        .catch((err) => {
          console.warn("Falha no registro do Service Worker CDE:", err);
        });

      function handleOnline() {
        setIsOffline(false);
      }
      function handleOffline() {
        setIsOffline(true);
      }

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      setIsOffline(!navigator.onLine);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-lg animate-in slide-in-from-bottom-2">
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
      <span>Modo Offline Ativo — Exibindo cache local do CDE</span>
    </div>
  );
}
