import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";
import {
  STRICT_NECESSARY_COOKIES,
  COOKIE_CATEGORIES,
  LEGAL_CONTROLLER,
  PRIVACY_POLICY_VERSION,
  AI_TRANSPARENCY,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Cookies | ArqVértice Flow",
  description: "Como o ArqVértice Flow utiliza cookies, tags e tecnologias similares, com opções de consentimento ajustável.",
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <Brand showTagline={false} />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Privacidade
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        Política de Cookies
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Este site usa cookies, tags e tecnologias similares para melhorar a
        navegação, analisar o tráfego, personalizar conteúdo e tornar a
        interação mais eficiente. Utilize este documento para entender o que é
        coletado, por que e como você pode gerenciar as preferências.
      </p>

      <Card className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">1. O que são cookies?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Cookies são pequenos arquivos de texto armazenados no seu dispositivo
          quando você acessa um site. Eles ajudam a reconhecer o navegador,
          lembrar preferências e fornecer serviços solicitados.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">2. Cookies estritamente necessários</h2>
        <p className="mt-2 text-sm text-slate-600">
          Sem eles, o serviço não funciona corretamente. Você não pode optar por
          desativá-los, mas podem ser revogados ao encerrar a sessão ou por
          intervenção no seu navegador.
        </p>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          {STRICT_NECESSARY_COOKIES.map((c) => (
            <li key={c.name}>
              <span className="font-medium text-slate-800">{c.name}</span> — {c.purpose} —
              <span className="text-slate-500">{c.retention}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">3. Categorias aceitáveis</h2>
        <p className="mt-2 text-sm text-slate-600">
          Clique em <strong className="text-slate-800">Definir preferências</strong>
          para aceitar apenas o necessário ou personalizar cada categoria.
        </p>
        <ul className="mt-2 space-y-3 px-5 text-sm text-slate-600">
          {COOKIE_CATEGORIES.map((c) => (
            <li key={c.category}>
              <div className="font-semibold text-slate-800">{c.name}</div>
              <p className="text-slate-600">{c.purpose}</p>
              <p className="text-xs text-slate-400">{c.retention}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 border-amber-200 bg-amber-50/50">
        <h2 className="text-xl font-bold text-amber-900">Preferências de cookies</h2>
        <p className="mt-2 text-sm text-amber-800">
          O banner de consentimento fica visível na primeira visita. Você pode
          alterar as preferências a qualquer momento.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">4. Cookies de terceiros</h2>
        <p className="mt-2 text-sm text-slate-600">
          A plataforma pode integrar serviços de analytics, suporte e
          comunicação. Esses provedores operam seus próprios cookies. Verifique
          os avisos específicos no seu site ou em <Link className="text-blue-600" href="https://www.example.com">
           Configure de privacidade
          </Link>.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">5. Como gerenciar cookies</h2>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          <li>Use as opções de consentimento do banner.</li>
          <li>Altere o navegador: opções de privacidade /History /Cookies.</li>
          <li>Revogue o consentimento via painel do cliente ou e-mail para {LEGAL_CONTROLLER.privacyEmail}.</li>
        </ul>
      </Card>

      <Card className="mt-6 border-amber-200 bg-amber-50/50">
        <h2 className="text-xl font-bold text-amber-900">Privacy by design</h2>
        <p className="mt-2 text-sm text-amber-800">
          O ArqVértice Flow aplica <strong className="text-amber-900">auth default
          móvel</strong>: dados sensíveis são recuperados do servidor, e
          consentimento de cookies é registrado quando aceito.
        </p>
      </Card>

      <p className="mt-8 text-xs text-slate-400">
        Versão {PRIVACY_POLICY_VERSION} · Última atualização: disponível no
        painel de privacidade.
      </p>
    </main>
  );
}
