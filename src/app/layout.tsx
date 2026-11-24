import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { PwaRegister } from "@/components/acervo/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { IdleTimerProvider } from "@/components/idle-timer-provider";

export const metadata: Metadata = {
  title: {
    default: "ArqVértice OS",
    template: "%s · ArqVértice OS",
  },
  description: "Base moderna para gestão de projetos, obras e relacionamento com clientes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ArqVértice",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-[#F5F5F7] text-slate-900 dark:bg-[#09090B] dark:text-slate-300 transition-colors duration-200">
        <ThemeProvider>
          <IdleTimerProvider>
            <PwaRegister />
            <CookieConsentBanner />
            {children}
          </IdleTimerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

