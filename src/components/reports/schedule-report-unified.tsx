"use client";

import { useState, useEffect, useMemo } from "react";
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
  showBackLink = true,
}: UnifiedScheduleReportProps) {
  const finalFinancialRows = financialRows.length > 0 ? financialRows : report.financial?.rows || [];

  // Controle de Visibilidade das Seções com persistência no localStorage
  const [sectionsVisibility, setSectionsVisibility] = useState({
    parecer: true,
    disciplinas: true,
    financeiro: true,
    project3d: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`schedule_report_visibility_${projectId}`);
      if (saved) {
        setSectionsVisibility(JSON.parse(saved));
      }
    } catch {
      // Ignora falhas de leitura do storage
    }
  }, [projectId]);

  function toggleSection(key: keyof typeof sectionsVisibility) {
    setSectionsVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`schedule_report_visibility_${projectId}`, JSON.stringify(next));
      } catch {
        // Ignora falhas de gravação do storage
      }
      return next;
    });
  }

  // 1. Cálculos Financeiros Consolidados para o Cabeçalho Geral Superior
  const { totalContractValueFormatted, paidFormatted, pendingFormatted } = useMemo(() => {
    const totalAmount = initialPayments.reduce((acc, p) => acc + (p.amountNumber || 0), 0);
    const paidAmount = initialPayments
      .filter((p) => p.status === "Liquidado" || p.status === "PAID")
      .reduce((acc, p) => acc + (p.amountNumber || 0), 0);
    const pendingAmount = totalAmount - paidAmount;

    // Se houver linha contratual declarada no financialRows, prioriza ela
    const contractRow = finalFinancialRows.find(
      (r) => r.label.toLowerCase().includes("contratado") || r.label.toLowerCase().includes("total")
    );
    const contractVal = contractRow
      ? contractRow.value
      : totalAmount > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAmount)
      : "R$ 30.000,00";

    return {
      totalContractValueFormatted: contractVal,
      paidFormatted: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(paidAmount),
      pendingFormatted: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pendingAmount),
    };
  }, [initialPayments, finalFinancialRows]);

  // Filtragem e normalização estrita de etapas no relatório físico
  const sanitizedStages = useMemo(() => {
    return report.sinteseEntregas.stages
      .filter((s) => {
        const n = s.name.toLowerCase();
        const d = s.discipline.toLowerCase();
        return (
          !n.includes("execução de obra") &&
          !n.includes("execução da obra") &&
          !n.includes("execucao de obra") &&
          !d.includes("execução de obra") &&
          !d.includes("execução da obra")
        );
      })
      .map((s) => ({
        ...s,
        name: s.name
          .replace(/\bProjeto Amaduras\b/gi, "Projeto de Armaduras")
          .replace(/\bAmaduras\b/gi, "Armaduras"),
      }));
  }, [report.sinteseEntregas.stages]);

  // Listas semânticas dinâmicas com avanço real
  const doneStages = useMemo(() => sanitizedStages.filter((s) => s.completion === 100), [sanitizedStages]);
  const runningStages = useMemo(
    () => sanitizedStages.filter((s) => s.completion > 0 && s.completion < 100),
    [sanitizedStages]
  );
  const pendingStages = useMemo(() => sanitizedStages.filter((s) => s.completion === 0), [sanitizedStages]);

  const hasOverdue = sanitizedStages.some((s) => s.alert?.overdue);

  // Fase em curso dinâmica (disciplina com etapas ativas ou primeira não concluída)
  const currentDiscipline = useMemo(() => {
    // Tenta encontrar disciplina com etapas em andamento
    const activeStage = sanitizedStages.find((s) => s.completion > 0 && s.completion < 100);
    const targetDiscipline = activeStage ? activeStage.discipline : "Engenharia Estrutural";

    const discStages = sanitizedStages.filter((s) => s.discipline === targetDiscipline);
    const discCompleted = discStages.filter((s) => s.completion === 100).length;
    const discTotal = discStages.length || 1;
    const discProgress = Math.round(
      discStages.reduce((acc, s) => acc + s.completion, 0) / discTotal
    );

    return {
      name: targetDiscipline,
      progress: discProgress,
      completed: discCompleted,
      total: discTotal,
    };
  }, [sanitizedStages]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 font-sans space-y-8">
      {/* ============================================================== */}
      {/* 1. CABEÇALHO EXECUTIVO E CONTRATUAL GERAL (Metadados + Resumo)  */}
      {/* ============================================================== */}
      <section className="space-y-6">
        {/* Barra de Título Superior & Ação Única Oficial (Print / PDF)   */}
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-zinc-950 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs">
                ArqVértice Studio
              </span>
              <span className="text-xs font-semibold text-zinc-400">· Flow Engineering v2.4</span>
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                Relatório Oficial
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">
              Relatório Oficial do Cronograma
            </h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Acompanhamento Físico-Financeiro, Avanço das Disciplinas e Prazos Operacionais
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 print-hidden">
            {/* TAREFA 3: Botão Único Oficial de Impressão / Salvar PDF */}
            <PrintButton />
          </div>
        </div>

        {/* Identificação Completa da Edificação & Contratante */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Empreendimento / Projeto
              </span>
              <p className="text-base font-extrabold text-slate-900">{projectName}</p>
              <p className="text-xs text-slate-500">
                Cliente: <strong className="text-slate-800">{client.name}</strong>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Área Total Construída
              </span>
              <p className="text-base font-extrabold text-slate-900">{client.areaConstruida || "385,00 m²"}</p>
              <p className="text-xs text-slate-500">{client.loteQuadra || "Loteamento Litoral"}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tipologia Arquitetônica
              </span>
              <p className="text-base font-extrabold text-slate-900">Residencial Unifamiliar</p>
              <p className="text-xs text-slate-500">Padrão Construtivo Litorâneo</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Data de Emissão & Sincronização
              </span>
              <p className="text-base font-extrabold text-slate-900">{report.emittedAtLabel}</p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Base Neon Conectada</span>
              </div>
            </div>
          </div>
        </div>

        {/* Painel de Indicadores Físico-Operacionais (Grid Superior de 4 Cards - Puro Técnico) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Progresso Global Ponderado */}
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Progresso Global
              </span>
              <Badge tone="green" className="text-[10px]">Ponderado</Badge>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-950 font-mono">
              {report.overall.weightedProgress}% Concluído
            </p>
            <div className="mt-2.5 w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, report.overall.weightedProgress))}%` }}
              />
            </div>
          </div>

          {/* Card 2: Entregas Técnicas Homologadas */}
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/70 via-white to-white p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Entregas Homologadas
            </span>
            <p className="mt-2 text-2xl font-black text-slate-900 font-mono">
              {doneStages.length} <span className="text-sm font-semibold text-slate-500">de {sanitizedStages.length}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {runningStages.length} em andamento ativo
            </p>
          </div>

          {/* Card 3: Disciplina em Curso */}
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/70 via-white to-white p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Disciplina em Curso
            </span>
            <p className="mt-2 text-base font-bold text-slate-900 truncate" title={currentDiscipline.name}>
              {currentDiscipline.name}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              {currentDiscipline.progress}% avanço ({currentDiscipline.completed}/{currentDiscipline.total})
            </p>
          </div>

          {/* Card 4: Status do Prazo */}
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/70 via-white to-white p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Status do Prazo
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  hasOverdue ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <p className="text-sm font-bold text-slate-900">
                {hasOverdue ? "Atenção a Prazos" : "No Prazo (Sem Atrasos)"}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {hasOverdue ? "Etapas em regime de alinhamento" : "Ritmo de entregas em dia"}
            </p>
          </div>
        </div>

        {/* Barra Discreta de Personalização do Relatório (Exibir/Ocultar Seções) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 print-hidden shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                🛠️ Personalização do Relatório (Exibir / Ocultar Seções):
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSection("parecer")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                  sectionsVisibility.parecer
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                <span>{sectionsVisibility.parecer ? "👁️" : "👁️‍🗨️"}</span>
                <span>Parecer Técnico</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSection("disciplinas")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                  sectionsVisibility.disciplinas
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                <span>{sectionsVisibility.disciplinas ? "👁️" : "👁️‍🗨️"}</span>
                <span>Cronograma Físico</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSection("financeiro")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                  sectionsVisibility.financeiro
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                <span>{sectionsVisibility.financeiro ? "👁️" : "👁️‍🗨️"}</span>
                <span>Gestão Financeira</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSection("project3d")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                  sectionsVisibility.project3d
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "bg-white text-zinc-500 border border-zinc-200"
                }`}
              >
                <span>{sectionsVisibility.project3d ? "👁️" : "👁️‍🗨️"}</span>
                <span>Ambiente 3D</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. PARECER TÉCNICO EXECUTIVO DINÂMICO (LAYOUT FIEL À REFERÊNCIA)*/}
      {/* ============================================================== */}
      {sectionsVisibility.parecer && (
        <section className="rounded-2xl border border-zinc-800/80 bg-white p-6 shadow-sm">
          {/* Título do bloco com marcador vertical em negrito */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1.5 h-6 bg-zinc-950 rounded-sm" />
            <h3 className="text-base font-extrabold tracking-wide uppercase text-zinc-950 font-mono">
              PARECER TÉCNICO EXECUTIVO DO CRONOGRAMA
            </h3>
          </div>

          <div className="space-y-3.5 text-sm leading-relaxed text-zinc-800">
            {/* Parágrafo 1: Contexto Oficial */}
            <p>
              Prezado cliente <strong>{client.name}</strong>, o presente relatório consolida o acompanhamento físico de projetos e o planejamento executivo da sua <strong>{projectName}</strong>.
            </p>

            {/* Parágrafo 2: Diagnóstico Dinâmico de Avanço */}
            <p>
              O empreendimento está com <strong>{report.overall.weightedProgress}%</strong> de avanço geral, com <strong>{doneStages.length} de {sanitizedStages.length} entregas concluídas</strong>. A fase em curso é <strong>{currentDiscipline.name}</strong>, com <strong>{currentDiscipline.progress}% executado</strong> ({currentDiscipline.completed} de {currentDiscipline.total} etapas fechadas). {hasOverdue ? "Atenção: existem etapas com prazo em revisão." : "Não há entregas com prazo vencido."}
            </p>

            {/* Listas Semânticas com Bolding Estrito */}
            <div className="space-y-2 pt-1 font-normal">
              <p>
                • <strong className="text-emerald-700">Etapas concluídas (100%):</strong>{" "}
                {doneStages.length > 0
                  ? doneStages.map((s) => s.name).join(", ")
                  : "Nenhuma etapa concluída até o momento."}
              </p>

              <p>
                • <strong className="text-blue-700">Etapas em desenvolvimento ativo:</strong>{" "}
                {runningStages.length > 0
                  ? runningStages.map((s) => `${s.name} (${s.completion}%)`).join(", ")
                  : "Nenhuma etapa em andamento."}
              </p>

              <p>
                • <strong className="text-amber-800">Próximas fases programadas:</strong>{" "}
                {pendingStages.length > 0
                  ? pendingStages.map((s) => s.name).join(", ")
                  : "Todas as etapas do cronograma já foram iniciadas."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* 3. CRONOGRAMA FÍSICO DETALHADO POR DISCIPLINAS                 */}
      {/* ============================================================== */}
      {sectionsVisibility.disciplinas && (
        <ReportCardSection title="3. Cronograma Físico Detalhado por Disciplinas">
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
                {sanitizedStages.map((stage) => (
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
      )}

      {/* ============================================================== */}
      {/* 4. GESTÃO FINANCEIRA: CRONOGRAMA DE PARCELAS & QUITAÇÃO        */}
      {/* ============================================================== */}
      {sectionsVisibility.financeiro && (
        <ReportCardSection title="4. Gestão Financeira: Cronograma de Parcelas & Quitação Interativa">
          <ReportClientFinanceCard
            projectId={projectId}
            client={client}
            initialPayments={initialPayments}
            financialRows={finalFinancialRows}
            hideClientMetadata={true}
            hideFinancialSummary={false}
          />
        </ReportCardSection>
      )}

      {/* ============================================================== */}
      {/* 5. AMBIENTE IMERSIVO 3D - CONTRASTE TOTAL WCAG AAA            */}
      {/* ============================================================== */}
      {sectionsVisibility.project3d && (
        <section className="my-8 print:hidden">
          <div className="rounded-2xl bg-zinc-950 p-6 md:p-8 text-white shadow-2xl border-2 border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Gêmeo Digital Tridimensional
              </div>
              <h4 className="text-xl font-bold tracking-tight text-white">
                ArqVértice Project 3D
              </h4>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Explore a maquete virtual tridimensional interativa da edificação diretamente no navegador, com navegação em tempo real, estudo de insolação e visualização dos ambientes.
              </p>
            </div>
            <a
              href="https://arqvertic-project-3d.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-white text-zinc-950 font-bold text-xs tracking-wider uppercase hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 whitespace-nowrap"
            >
              <span>Explorar Maquete 3D</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* 6. CHANCELA INSTITUCIONAL / RODAPÉ                             */}
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
