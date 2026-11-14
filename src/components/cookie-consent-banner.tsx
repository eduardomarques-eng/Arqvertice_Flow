"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  COOKIE_CATEGORIES,
  PRIVACY_POLICY_VERSION,
} from "@/lib/legal";
import { getConsentState, setConsentState, hasConsent } from "@/lib/consent";

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(true);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>({
    strict: true,
    analytical: false,
    marketing: false,
    functional: false,
    unclassified: false,
  });

  useEffect(() => {
    setMounted(true);
    const hasSeen = sessionStorage.getItem("arqvertice_consent_seen");
    const consent = hasConsent();
    if (hasSeen || consent) {
      setAccepted(true);
      return;
    }
    setAccepted(false);
  }, []);

  const handleAcceptAll = () => {
    const categories: PreferenceKey[] = ["strict", "analytical", "marketing", "functional", "unclassified"];
    setConsentState({
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      consentedCategories: categories,
      consentGiven: true,
      acceptedAt: new Date().toISOString(),
    });
    setAccepted(true);
    setOpen(false);
    sessionStorage.setItem("arqvertice_consent_seen", "1");
  };

  const handleAcceptSelected = () => {
    const categories: PreferenceKey[] = [];
    Object.entries(preferences).forEach(([key, value]) => {
      if (value) categories.push(CATEGORY_KEYMAP[key] ?? (key as PreferenceKey));
    });

    setConsentState({
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      consentedCategories: categories,
      consentGiven: true,
      acceptedAt: new Date().toISOString(),
    });

    setAccepted(true);
    setOpen(false);
    sessionStorage.setItem("arqvertice_consent_seen", "1");
  };

  const handleDismiss = () => {
    // Apenas cookies essenciais
    setConsentState({
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      consentedCategories: ["strict"],
      consentGiven: true,
      acceptedAt: new Date().toISOString(),
    });
    setAccepted(true);
    setOpen(false);
    sessionStorage.setItem("arqvertice_consent_seen", "1");
  };

  const toggleCategory = (key: PreferenceKey) => {
    if (key === "strict") return; // Essenciais não podem ser desativados
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Garante zero divergência entre SSR e o DOM do cliente (Hydration Safe)
  if (!mounted || accepted) return null;

  return (
    <div
      id="arqvertice-consent-banner"
      className="fixed bottom-0 left-0 right-0 z-[2147483646] pointer-events-none p-4"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur px-5 py-4">
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
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700 ml-1"
              >
                Ver política
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
          >
            {open ? "Ocultar preferências" : "Gerenciar preferências"}
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Apenas essenciais
            </Button>
            <Button size="sm" onClick={handleAcceptAll} className="bg-slate-900 text-white hover:bg-slate-800">
              Aceitar todos
            </Button>
          </div>
        </div>

        {open && (
          <Card className="mt-3 border-slate-200 p-3">
            <div className="space-y-2">
              {COOKIE_CATEGORIES.map((c) => (
                <label
                  key={c.category}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 cursor-pointer"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    <span className="block text-xs text-slate-400">{c.purpose}</span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={c.category === "strict"}
                    checked={c.category === "strict" ? true : preferences[c.category as PreferenceKey]}
                    onChange={() => toggleCategory(c.category as PreferenceKey)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button size="sm" onClick={handleAcceptSelected} className="bg-slate-900 text-white hover:bg-slate-800">
                Salvar preferências
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
