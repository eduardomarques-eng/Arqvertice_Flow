"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PrintButton } from "@/components/print-button";
import { ReportClientFinanceCard } from "./report-client-finance-card";
import type { ScheduleReport } from "@/lib/schedule-report";

export interface UnifiedScheduleReportProps {
  projectId: string;
  projectName: string;
  client: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string;
    loteQuadra: string;
    areaConstruida: string;
  };
  initialPayments: Array<{
    id: string;
    name: string;
    amount: string;
    amountNumber: number;
    dueDate: string;
    paidAt: string;
    stage: string;
    status: string;
    order: number;
  }>;
  financialRows?: Array<{ label: string; value: string }>;
  report: ScheduleReport;
  pdfUrl?: string;
  showBackLink?: boolean;
}

export function UnifiedScheduleReport({
  projectId,
  projectName,
  client,
  initialPayments,
  financialRows = [],
  report,
  pdfUrl = `/api/projects/${projectId}/cronograma/relatorio/pdf`,
  showBackLink = true,
}: UnifiedScheduleReportProps) {
  const finalFinancialRows = financialRows.length > 0 ? financialRows : report.financial?.rows || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 font-sans space-y-7">
      {/* ============================================================== */}
      {/* CABEÇALHO EXECUTIVO APPLE HIG DO ESTÚDIO                       */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs">
              ArqVértice Studio
            </span>
            <span className="text-xs font-semibold text-zinc-400">· Flow Engineering v2.4</span>
            <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Relatório Oficial
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">
            Relatório Oficial do Cronograma
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Acompanhamento Físico-Financeiro, Avanço das Disciplinas e Prazos Operacionais
          </p>
          <p className="mt-2 text-xs font-medium text-zinc-600">
            Edificação: <strong className="text-zinc-900">{projectName}</strong> · Emissão Oficial:{" "}
            {report.emittedAtLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 print-hidden">
          <PrintButton />
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar PDF Oficial
          </a>
        </div>
      </div>

      {/* KPI Badges Rápidos do Cronograma */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={report.statusGeralTone}>
          Avanço Ponderado: {report.overall.weightedProgress}%
        </Badge>
        <Badge tone="blue">Avanço Linear: {report.overall.progress}%</Badge>
        <Badge tone="neutral">
          {report.overall.completed} de {report.overall.total} etapas concluídas
        </Badge>
        {report.overall.running > 0 && (
          <Badge tone="blue">{report.overall.running} em andamento</Badge>
        )}
      </div>

      {/* ============================================================== */}
      {/* CARD DE CONEXÃO COM O ARQVÉRTICE PROJECT 3D                    */}
      {/* ============================================================== */}
      <div className="my-6 p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-zinc-700/50">
        <div>
          <span className="text-xs uppercase tracking-widest font-mono text-zinc-400">
            Ambiente de Imersão em Tempo Real
          </span>
          <h4 className="text-lg font-bold tracking-tight text-white mt-1">
            ArqVértice Project 3D
          </h4>
          <p className="text-xs text-zinc-300 max-w-xl mt-1">
            Gêmeo digital tridimensional da edificação com navegação interativa, estudo de insolação diurna e volumetria fotorrealista.
          </p>
        </div>
        <a
          href="https://arqvertic-project-3d.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-3 rounded-xl bg-white text-zinc-900 font-semibold text-xs tracking-wider uppercase hover:bg-zinc-100 transition-all flex items-center gap-2 whitespace-nowrap shadow-lg active:scale-95 shrink-0"
        >
          <span>Explorar Maquete 3D</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* ============================================================== */}
      {/* 1. DADOS CADASTRAIS & CONTROLE FINANCEIRO DAS PARCELAS          */}
      {/* ============================================================== */}
      <ReportCardSection title="1. Dados Cadastrais & Controle Financeiro das Parcelas">
        <ReportClientFinanceCard
          projectId={projectId}
          client={client}
          initialPayments={initialPayments}
          financialRows={finalFinancialRows}
        />
      </ReportCardSection>

      {/* ============================================================== */}
      {/* 2. PARECER TÉCNICO EXECUTIVO DO CRONOGRAMA EM TEMPO REAL        */}
      {/* ============================================================== */}
      <ReportCardSection title="2. Parecer Técnico Executivo do Cronograma">
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-slate-50/70 to-white p-4 shadow-2xs">
            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              {report.parecerEstruturado?.introducao || report.parecer[0]}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-blue-100/60 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Avanço Físico Ponderado Oficial:</span>
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white font-mono">
                  {report.overall.weightedProgress}%
                </span>
              </div>
              <div className="text-xs text-slate-500">
                (Progresso linear simples: {report.overall.progress}% · {report.overall.completed} concluídas, {report.overall.running} em andamento, {report.overall.pending} programadas)
              </div>
            </div>
          </div>

          {/* Disciplinas Estruturadas */}
          {report.parecerEstruturado?.disciplinas && (
            <div className="grid gap-3 sm:grid-cols-2">
              {report.parecerEstruturado.disciplinas.map((disc) => (
                <div key={disc.disciplina} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">{disc.disciplina}</span>
                    <Badge tone={disc.progresso === 100 ? "green" : disc.progresso > 0 ? "blue" : "neutral"}>
                      {disc.progresso}% concluído
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{disc.texto}</p>
                  <div className="mt-3">
                    <Progress value={disc.progresso} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Alinhamento Operacional e Mitigação de Riscos */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-emerald-950">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-sm">✅</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">
                  Alinhamento Operacional & Prazos
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  {report.parecerEstruturado?.alinhamentoOperacional || report.parecer.at(-1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ReportCardSection>

      {/* ============================================================== */}
      {/* 3. SÍNTESE DE ENTREGAS, PRAZOS E ALINHAMENTO TÉCNICO           */}
      {/* ============================================================== */}
      <ReportCardSection title="3. Síntese de Entregas, Prazos e Alinhamento Técnico">
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-3 pr-2 font-mono">#</th>
                <th className="py-2.5 px-2">Descrição da Etapa</th>
                <th className="py-2.5 px-2">Disciplina</th>
                <th className="py-2.5 px-2">Responsável</th>
                <th className="py-2.5 px-2">Data Limite</th>
                <th className="py-2.5 px-2 w-32">Avanço Físico</th>
                <th className="py-2.5 pr-3 pl-2">Status Operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {report.sinteseEntregas.stages.map((stage) => (
                <tr key={stage.order} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-slate-400">
                    {String(stage.order).padStart(2, "0")}
                  </td>
                  <td className="py-2.5 px-2 font-semibold text-slate-900">
                    {stage.name}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {stage.discipline}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">{stage.designer}</td>
                  <td className="py-2.5 px-2 text-slate-600 font-medium">{stage.dueDate}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <Progress value={stage.completion} />
                      </div>
                      <span className="font-semibold text-slate-900 text-[11px]">{stage.completion}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 pl-2">
                    <Badge
                      tone={
                        stage.completion === 100
                          ? "green"
                          : stage.alert.overdue
                          ? "red"
                          : stage.alert.blocked
                          ? "amber"
                          : stage.completion > 0
                          ? "blue"
                          : "neutral"
                      }
                    >
                      {stage.statusLabel} {stage.alertDetail ? `· ${stage.alertDetail}` : ""}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCardSection>

      {/* ============================================================== */}
      {/* RODAPÉ INSTITUCIONAL OFICIAL                                    */}
      {/* ============================================================== */}
      <footer className="border-t border-slate-200 pt-6">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
              ArqVértice Studio · Arquitetura, Estrutura & Engenharia
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Relatório Oficial do Cronograma · Emissão em {report.emittedAtLabel} · Versão 2.4 Oficial · Hash:{" "}
              <strong className="font-mono text-slate-800">{report.documentHash}</strong>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Documento oficial gerado e certificado digitalmente pelo Sistema ArqVértice Flow. Dispensa assinaturas manuscritas.
            </p>
          </div>
          {showBackLink && (
            <div className="mt-3 sm:mt-0 print-hidden">
              <Link
                href={`/admin/projetos/${projectId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                ← Voltar ao Painel do Projeto
              </Link>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function ReportCardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm overflow-hidden">
      <h2 className="border-l-4 border-blue-600 pl-3 text-xs font-bold uppercase tracking-wider text-slate-900">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

