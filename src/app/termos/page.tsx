import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";
import {
  LEGAL_CONTROLLER,
  LEGAL_BASES,
  DATA_PURPOSES,
  AI_TRANSPARENCY,
  PRIVACY_POLICY_VERSION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso | ArqVértice Flow",
  description: "Termos de uso, licenciamento de projetos, preços e regras de cancelamento do ArqVértice Flow.",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <Brand showTagline={false} />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Legislação
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        Termos de Uso — ArqVértice Flow
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Ao utilizar o ArqVértice Flow você concorda com as condições abaixo. Em
        caso de divergência, o ambiente de maior confiança é o painel
        administrativo do escritório, que sempre rege a interpretação dos
        contratos.
      </p>
      <Card className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">1. Controle do tratamento de dados</h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">Controle / Responsável:</strong>
          <br />
          ArqVértice Studio — Eduardo César Costa Marques<br />
          CNPJ 66.773.164/0001-60 · São Paulo, SP<br />
          E-mail: <Link href={`mailto:${LEGAL_CONTROLLER.privacyEmail}`} className="text-blue-600">
            {LEGAL_CONTROLLER.privacyEmail}
          </Link>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">Parceiro estrutural de dados:</strong>
          <br />
          Emanoel Luan Almeida da Rocha · CNPJ 51.510.575/0001-95 — apenas nos
          processos em que a entrega é compartilhada, mediante autorização
          expressa do titular.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">2. Bases legais aplicáveis (LGPD)</h2>
        {Object.entries(LEGAL_BASES).map(([key, value]) => (
          <div key={key} className="mt-2 flex gap-3">
            <span className="shrink-0 font-semibold text-slate-700">{key}</span>
            <p className="text-sm text-slate-600">{value}</p>
          </div>
        ))}
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">3. Finalidades dos dados</h2>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          {DATA_PURPOSES.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">4. Licença de propriedade intelectual</h2>
        <p className="mt-2 text-sm text-slate-600">
          Os projetos, desenhos, modelagens e artefatos gerados no ArqVértice Flow
          são de propriedade do ArqVértice Studio. Ao concluir o pagamento e
          aprovar a entrega, o cliente recebe <strong className="text-slate-900">licença
          não exclusiva e limitada</strong> para uso interno da obra no seu
          empreendimento, sem difusão, reimpressão ou uso comercial sem
          autorização prévia.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">5. Transparência de preços</h2>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          <li>Valores em BRL; a proposta congela o preço por versão.</li>
          <li>Notas fiscais emitidas em nome de ArqVértice Studio.</li>
        </ul>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">6. Cancelamento e reembolso</h2>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          <li>Cancelamento sem penalização até 15 dias após a assinatura.</li>
          <li>Após 15 dias, reembolso proporcional ao não executado, só em caso de falha ou justa causa.</li>
          <li>Pagamentos via provedores certificados — nunca armazenados na plataforma.</li>
        </ul>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-900">7. Inteligência Artificial — Aviso de Transparência</h2>
        <p className="mt-2 text-sm text-slate-600">{AI_TRANSPARENCY.notice}</p>
        <ul className="mt-2 list-disc space-y-1 px-5 text-sm text-slate-600">
          <li>IA sugere, resume e auxilia; o profissional aprova.</li>
          <li>O cliente pode solicitar edição humana a qualquer momento.</li>
          <li>Nenhum conteúdo do cliente treina modelos externos.</li>
        </ul>
      </Card>
      <Card className="mt-6 border-amber-200 bg-amber-50/50">
        <h2 className="text-xl font-bold text-amber-900">Dados de pagamento</h2>
        <p className="mt-2 text-sm text-amber-800">
          O checkout seguro é feito por provedor autorizado; dados não ficam no
          ArqVértice Flow.
        </p>
      </Card>
      <Card className="mt-6 border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">8. Seus direitos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Conforme art. 18 da LGPD: acesso, retificação, anonimização, obliteração,
          portabilidade e revogação de consentimento. Envie para
          <Link className="text-blue-600" href="mailto:privacidade@arqvertice.com">
            {" "}
            privacidade@arqvertice.com
          </Link>.
        </p>
      </Card>
      <p className="mt-8 text-xs text-slate-400">
        Versão {PRIVACY_POLICY_VERSION} · Última atualização em conformidade com
        a legislação vigente.
      </p>
    </main>
  );
}
