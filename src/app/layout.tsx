import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { PwaRegister } from "@/components/acervo/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "ArqVértice Flow",
    template: "%s · ArqVértice Flow",
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
    <html lang="pt-BR">
      <body className="antialiased min-h-screen">
        <PwaRegister />
        <CookieConsentBanner />
        {children}
      </body>
    </html>
  );
}

