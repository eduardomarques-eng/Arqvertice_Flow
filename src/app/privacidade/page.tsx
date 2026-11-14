import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";
import {
  LEGAL_CONTROLLER,
  LEGAL_PARTNER,
  LEGAL_BASES,
  DATA_PURPOSES,
  DATA_SUBJECT_RIGHTS,
  PRIVACY_POLICY_VERSION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade | ArqVértice Flow",
  description: "Como o ArqVértice Flow trata, protege e gerencia seus dados pessoais em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <Brand showTagline={false} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        Política de Privacidade
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        O ArqVértice Flow recolhe, utiliza e armazena dados pessoais de forma
        transparente, segura e conforme a Lei Geral de Proteção de Dados
        (LGPD — Lei nº 13.709/2018).
      </p>
      <Card className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">1. Quem é o kontrolador</h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">ArqVértice Studio</strong>
          — Eduardo César Costa Marques · CNPJ 66.773.164/0001-60<br />
          São Paulo, SP, Brasil<br />
          E-mail: <Link href={`mailto:${LEGAL_CONTROLLER.privacyEmail}`} className="text-blue-600">
            {LEGAL_CONTROLLER.privacyEmail}
          </Link>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">Parceiro estrutural:</strong>
          <br />
          Emanoel Luan Almeida da Rocha · CNPJ 51.510.575/0001-95 — atua apenas
          em processos com compartilhamento de entrega, mediante autorização
          expressa do titular.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">2. Bases legais (LGPD)</h2>
        {Object.entries(LEGAL_BASES).map(([key, value]) => (
          <div key={key} className="mt-2 flex gap-3">
            <span className="shrink-0 font-semibold text-slate-700">{key}</span>
            <p className="text-sm text-slate-600">{value}</p>
          </div>
        ))}
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">3. Finalidades do tratamento</h2>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          {DATA_PURPOSES.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">4. Dados pessoais tratados</h2>
        <p className="mt-2 text-sm text-slate-600">
          Cadastros: nome, e-mail, telefone/WhatsApp, documento, endereço.
          Desempenho de projeto: arquivos, mensagens, análises de comportamento.
          Pagamentos: provedor autorizado; não armazenados na plataforma.
          <br />
          Técnicos: endereço IP, navegador, páginas visitadas. IA: métricas
          agregadas, sem conteúdo identificável do cliente.
        </p>
      </Card>
      <Card className="mt-6 border-amber-200 bg-amber-50/50">
        <h2 className="text-xl font-bold text-amber-900">5. Cookie consentimento</h2>
        <p className="mt-2 text-sm text-amber-800">
          O cliente decide sobre cookies não estritamente necessários por meio do
          banner de consentimento. O consentimento é registrado e pode ser
          revogado a qualquer momento no painel ou no navegador.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">6. Inteligência Artificial</h2>
        <p className="mt-2 text-sm text-slate-600">{AI_TRANSPARENCY.notice}</p>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">Segurança:</strong> a IA não salva
          conteúdo do cliente em modelos externos; saída sempre revisável; o
          cliente pode optar por edição humana a qualquer momento.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">7. Seus direitos (art. 18 LGPD)</h2>
        <ul className="mt-2 space-y-3 px-5 text-sm text-slate-600">
          {DATA_SUBJECT_RIGHTS.map(({ right, description }) => (
            <li key={right}>
              <span className="font-semibold text-slate-800">{right}: </span>
              <span className="text-slate-600">{description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-slate-600">
          Envie para <Link className="text-blue-600" href="mailto:privacidade@arqvertice.com">
            privacidade@arqvertice.com
          </Link>. Resposta em até 15 dias úteis.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">8. Segurança e retenção</h2>
        <p className="mt-2 text-sm text-slate-600">
          Criptografia em trânsito e repouso, controle de acesso por papel
          (RBAC), auditoria de acesso e log, e monitoramento contínuo. Dados são
          mantidos enquanto necessário ao objetivo contratual; registros
          identificáveis são anonimizados quando não mais necessários, salvo
          prazo legal de fiscalização.
        </p>
      </Card>
      <p className="mt-8 text-xs text-slate-400">
        Versão {PRIVACY_POLICY_VERSION} · Última atualização em conformidade com
        a legislação vigente.
      </p>
    </main>
  );
}
