"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  COOKIE_CATEGORIES,
  PRIVACY_POLICY_VERSION,
} from "@/lib/legal";
import { getConsentState, setConsentState } from "@/lib/consent";

type PreferenceKey = "strict" | "analytical" | "marketing" | "functional" | "unclassified";

const CATEGORY_KEYMAP: Record<string, PreferenceKey> = {
  strict: "strict",
  analytical: "analytical",
  marketing: "marketing",
  functional: "functional",
  unclassified: "unclassified",
};

export function CookieConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>({
    strict: true,
    analytical: false,
    marketing: false,
    functional: false,
    unclassified: false,
  });

  useEffect(() => {
    const hasSeen = sessionStorage.getItem("arqvertice_consent_seen");
    const saved = getConsentState();
    if (hasSeen || saved.consentGiven) return;

    const banner = document.createElement("div");
    banner.id = "arqvertice-consent-banner";
    banner.className =
      "fixed bottom-0 left-0 right-0 z-[2147483646] pointer-events-none";
    banner.innerHTML = `
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-t-2xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Política de Privacidade
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Utilizamos cookies para funcionalidade essencial, analytics e
              comunicação. Ao continuar, você concorda com o uso conforme nossa
              <a
                href="/privacidade"
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {" "}
                Política de Privacidade
              </a>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              sessionStorage.setItem("arqvertice_consent_seen", "1");
            }}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    return () => document.getElementById("arqvertice-consent-banner")?.remove();
  }, []);

  const handleAccept = async () => {
    const categories: PreferenceKey[] = [];
    Object.entries(preferences).forEach(([key, value]) => {
      if (value) categories.push(CATEGORY_KEYMAP[key] ?? key as PreferenceKey);
    });

    setConsentState({
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      consentedCategories: categories,
      acceptedAt: new Date().toISOString(),
    });

    setAccepted(true);
    setOpen(false);
    sessionStorage.setItem("arqvertice_consent_seen", "1");
  };

  const toggleCategory = (key: PreferenceKey) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (accepted) return null;

  return (
    <div
      id="arqvertice-consent-banner"
      className="fixed bottom-0 left-0 right-0 z-[2147483646] pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-t-2xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {pathname?.startsWith("/portal") ? "Seus dados" : "Privacidade"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              O ArqVértice Flow utiliza cookies para funcionalidade essencial,
              analytics e comunicação. Você decide quais categorias aceitar.
              <a
                href="/privacidade"
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {" "}
                Ver política
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {open && (
          <Card className="mt-3 border-slate-200">
            <div className="space-y-2">
              {COOKIE_CATEGORIES.map((c) => (
                <label
                  key={c.category}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                >
                  <span className="text-sm text-slate-700">{c.name}</span>
                  <input
                    type="checkbox"
                    checked={preferences[c.category]}
                    onChange={() => toggleCategory(c.category)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Recusar
              </Button>
              <Button size="sm" onClick={handleAccept}>
                Aceitar escolha
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
