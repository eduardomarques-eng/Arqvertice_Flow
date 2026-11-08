"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PrintButton } from "@/components/print-button";
import { ReportClientFinanceCard } from "./report-client-finance-card";
import { SheetMatrixView } from "@/components/deliverables/sheet-matrix-view";
import { getProjectAccessLogs } from "@/server/actions/deliverables";
import { DISCIPLINE_LABELS } from "@/lib/sheet-metadata-parser";
import type { ScheduleReport } from "@/lib/schedule-report";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ProjectDiscipline, ProjectStagePhase, AcervoCategory, ApprovalStatus } from "@prisma/client";

export interface AdminAccessLogItem {
  id: string;
  projectId: string;
  deliverableId: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: "VIEW" | "DOWNLOAD";
  sheetTitle: string;
  createdAt: Date | string;
  deliverable?: {
    id: string;
    sheetCode: string | null;
    title: string;
    subtitle: string | null;
    discipline: string;
    phaseFolder?: string | null;
    version: string;
  } | null;
}

export interface AdminDeliverableItem {
  id: string;
  sheetCode: string | null;
  title: string;
  subtitle: string | null;
  subject: string;
  discipline: ProjectDiscipline;
  phaseFolder: ProjectStagePhase;
  category: AcervoCategory;
  version: string;
  isClientView: boolean;
  status: ApprovalStatus;
  fileUrl: string;
  fileSize: string | null;
  createdAt: Date | string;
  stage?: { name: string } | null;
  environment?: { name: string } | null;
}

interface AdminGeneralReportProps {
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
  financialRows: Array<{ label: string; value: string }>;
  report: ScheduleReport;
  deliverableMatrix: DeliverableMatrix;
  deliverables: AdminDeliverableItem[];
  initialAccessLogs: AdminAccessLogItem[];
  pdfUrl?: string;
}

const PHASE_SECTIONS = [
  { key: "PROJETO_PRELIMINAR" as ProjectStagePhase, label: "Projeto Preliminar", icon: "📐", description: "Estudos preliminares, plantas de layout e conceitos volumétricos" },
  { key: "PROJETO_LEGAL" as ProjectStagePhase, label: "Projeto Legal", icon: "🏛️", description: "Aprovações municipais, licenças ambientais, condomínio e ARTs" },
  { key: "PROJETO_EXECUTIVO" as ProjectStagePhase, label: "Projeto Executivo", icon: "🏗️", description: "Arquitetura executiva, detalhamentos, Estrutural TQS e MEP Revit" },
];

export function AdminGeneralReport({
  projectId,
  projectName,
  client,
  initialPayments,
  financialRows,
  report,
  deliverableMatrix,
  deliverables,
  initialAccessLogs,
  pdfUrl = `/api/projects/${projectId}/cronograma/relatorio/pdf`,
}: AdminGeneralReportProps) {
  // Estado dos logs de auditoria
  const [logs, setLogs] = useState<AdminAccessLogItem[]>(initialAccessLogs);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionFilter, setActionFilter] = useState<"ALL" | "VIEW" | "DOWNLOAD">("ALL");

  const reloadLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await getProjectAccessLogs(projectId);
      setLogs(res as AdminAccessLogItem[]);
    } catch (err) {
      console.error("Erro ao atualizar logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Métricas agregadas de logs
  const totalViews = useMemo(() => logs.filter((l) => l.action === "VIEW").length, [logs]);
  const totalDownloads = useMemo(() => logs.filter((l) => l.action === "DOWNLOAD").length, [logs]);
  const clientLogs = useMemo(
    () => logs.filter((l) => l.userRole === "CLIENT" || l.userRole === "CLIENTE"),
    [logs],
  );
  const lastClientAccess = clientLogs[0];

  // Logs filtrados
  const filteredLogs = useMemo(() => {
    if (actionFilter === "ALL") return logs;
    return logs.filter((l) => l.action === actionFilter);
  }, [logs, actionFilter]);

  // Agrupamento de pranchas por subpastas normativas
  const deliverablesByPhase = useMemo(() => {
    return PHASE_SECTIONS.map((phase) => ({
      ...phase,
      items: deliverables.filter(
        (d) => (d.phaseFolder || "PROJETO_EXECUTIVO") === phase.key,
      ),
    }));
  }, [deliverables]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans space-y-8">
      {/* ============================================================== */}
      {/* CABEÇALHO EXECUTIVO APPLE HIG DO ESTÚDIO                       */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
              ArqVértice Studio
            </span>
            <span className="text-xs font-semibold text-slate-400">· Flow Engineering v2.4</span>
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Painel do Admin
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Relatório Geral Executivo & Auditoria Técnica
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Acompanhamento Físico-Financeiro, Matriz de Pranchas e Logs de Acesso
          </p>
          <p className="mt-2 text-xs font-medium text-slate-600">
            Empreendimento: <strong className="text-slate-900">{projectName}</strong> · Emissão Oficial:{" "}
            {report.emittedAtLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 print-hidden">
          <PrintButton />
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar PDF Oficial
          </a>
        </div>
      </div>

      {/* KPI Badges Rápidos */}
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
        {deliverableMatrix.total > 0 && (
          <Badge tone="green">
            Pranchas: {deliverableMatrix.delivered}/{deliverableMatrix.total} liberadas ({deliverableMatrix.complianceRate}%)
          </Badge>
        )}
        <Badge tone="neutral">
          {logs.length} acessos registrados na auditoria
        </Badge>
      </div>

      {/* ============================================================== */}
      {/* 1. DADOS CADASTRAIS & CONTROLE FINANCEIRO DAS PARCELAS          */}
      {/* ============================================================== */}
      <ReportCardSection title="1. Dados Cadastrais & Controle Financeiro das Parcelas">
        <ReportClientFinanceCard
          projectId={projectId}
          client={client}
          initialPayments={initialPayments}
          financialRows={financialRows}
        />
      </ReportCardSection>

      {/* ============================================================== */}
      {/* 2. PARECER TÉCNICO EXECUTIVO DO CRONOGRAMA EM TEMPO REAL        */}
      {/* ============================================================== */}
      <ReportCardSection title="2. Parecer Técnico Executivo do Cronograma">
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-slate-50/70 to-white p-4 shadow-sm">
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
                <div key={disc.disciplina} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
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
      {/* 3. MATRIZ GERAL DE PRANCHAS (ENTREGUES VS. PENDENTES)          */}
      {/* ============================================================== */}
      <ReportCardSection title="3. Matriz Geral de Pranchas por Subpasta Normativa">
        <div className="space-y-6">
          <SheetMatrixView matrix={deliverableMatrix} projectId={projectId} isClientView={false} />

          {/* Listagem das Pranchas Cadastradas por Subpasta */}
          <div className="space-y-5">
            {deliverablesByPhase.map((phase) => (
              <div key={phase.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{phase.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{phase.label}</h3>
                      <p className="text-[11px] text-slate-500">{phase.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700">
                    {phase.items.length} prancha(s) cadastrada(s)
                  </span>
                </div>

                {phase.items.length === 0 ? (
                  <div className="py-5 text-center text-xs text-slate-400 italic">
                    Nenhuma prancha cadastrada nesta fase. Aguardando elaboração técnica e upload.
                  </div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-2.5 pl-2">Código</th>
                          <th className="py-2.5 px-2">Título & Subtítulo</th>
                          <th className="py-2.5 px-2">Assunto</th>
                          <th className="py-2.5 px-2">Disciplina</th>
                          <th className="py-2.5 px-2">Revisão</th>
                          <th className="py-2.5 px-2">Visão Cliente</th>
                          <th className="py-2.5 pr-2 text-right">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {phase.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 pl-2 font-mono font-bold text-blue-700">
                              {item.sheetCode || "—"}
                            </td>
                            <td className="py-2.5 px-2">
                              <p className="font-semibold text-slate-900 leading-snug">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5">{item.subtitle}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-slate-700">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                {item.subject}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-mono font-bold text-slate-800">
                              {item.version}
                            </td>
                            <td className="py-2.5 px-2">
                              {item.isClientView ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  ✓ Liberada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  Restrita (Interna)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-2 text-right font-mono text-[11px] text-slate-500">
                              {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ReportCardSection>

      {/* ============================================================== */}
      {/* 4. PAINEL DE CONTROLE DE LOGS (AUDITORIA EM TEMPO REAL)        */}
      {/* ============================================================== */}
      <ReportCardSection title="4. Auditoria de Segurança: Painel de Controle de Logs">
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold text-slate-600">
                Rastreamento instantâneo de visualizações em tela cheia e downloads de arquivos técnicos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reloadLogs}
                disabled={loadingLogs}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs active:scale-95 transition"
              >
                <svg
                  className={`h-3.5 w-3.5 text-slate-500 ${loadingLogs ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {loadingLogs ? "Sincronizando..." : "Atualizar Logs"}
              </button>
            </div>
          </div>

          {/* Cards de Métricas Agregadas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Total de Visualizações
              </p>
              <p className="mt-1 text-3xl font-extrabold text-blue-950 font-mono">
                {totalViews}
              </p>
              <p className="mt-0.5 text-[11px] text-blue-600">
                Consultas técnicas no visualizador
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Downloads Concluídos
              </p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-950 font-mono">
                {totalDownloads}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-600">
                Baixas de pranchas PDF e imagens
              </p>
            </div>

            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Último Acesso do Cliente
              </p>
              <p className="mt-1 text-sm font-bold text-purple-950 truncate">
                {lastClientAccess
                  ? new Date(lastClientAccess.createdAt).toLocaleString("pt-BR")
                  : "Ainda sem acessos"}
              </p>
              <p className="mt-0.5 text-[11px] text-purple-600 truncate">
                {lastClientAccess
                  ? `${lastClientAccess.userName} (${lastClientAccess.action === "DOWNLOAD" ? "Baixou" : "Visualizou"})`
                  : "Aguardando primeiro acesso no portal"}
              </p>
            </div>
          </div>

          {/* Filtros Rápidos de Ação */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Filtrar por:
            </span>
            <button
              type="button"
              onClick={() => setActionFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                actionFilter === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todas ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("DOWNLOAD")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                actionFilter === "DOWNLOAD"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Apenas Downloads ({totalDownloads})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("VIEW")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                actionFilter === "VIEW"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Apenas Visualizações ({totalViews})
            </button>
          </div>

          {/* Tabela de Auditoria */}
          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-xs font-semibold text-slate-600">
                Nenhum log registrado para este filtro.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pl-4 pr-2">Data / Hora</th>
                    <th className="py-2.5 px-2">Usuário / Role</th>
                    <th className="py-2.5 px-2">Ação</th>
                    <th className="py-2.5 px-2">Planta / Arquivo</th>
                    <th className="py-2.5 pr-4 pl-2">Disciplina / Fase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredLogs.slice(0, 50).map((log) => {
                    const isClient =
                      log.userRole === "CLIENT" || log.userRole === "CLIENTE";
                    const isAdmin = log.userRole === "ADMIN";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 pl-4 pr-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>

                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">
                              {log.userName}
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                isClient
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isAdmin
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isClient ? "Cliente" : isAdmin ? "Admin" : "Equipe"}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-2">
                          {log.action === "DOWNLOAD" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              📥 BAIXOU PDF
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              👁️ VISUALIZOU
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-2 font-medium text-slate-800">
                          {log.sheetTitle}
                        </td>

                        <td className="py-2.5 pr-4 pl-2 text-slate-500 font-mono text-[11px]">
                          {log.deliverable?.discipline
                            ? DISCIPLINE_LABELS[log.deliverable.discipline as ProjectDiscipline] || log.deliverable.discipline
                            : "—"}
                          {log.deliverable?.phaseFolder ? ` · ${log.deliverable.phaseFolder}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ReportCardSection>

      {/* ============================================================== */}
      {/* 5. SÍNTESE DE ENTREGAS, PRAZOS E ALINHAMENTO TÉCNICO           */}
      {/* ============================================================== */}
      <ReportCardSection title="5. Síntese de Entregas, Prazos e Alinhamento Técnico">
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-3 pr-2">#</th>
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
      {/* RODAPÉ INSTITUCIONAL OFICIAL (SEM BLOCO DE ASSINATURAS MANUAIS)*/}
      {/* ============================================================== */}
      <footer className="border-t border-slate-200 pt-6">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
              ArqVértice Studio · Arquitetura, Estrutura & Engenharia
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Relatório Técnico de Acompanhamento Físico · Emissão em {report.emittedAtLabel} · Versão 2.4 Oficial · Hash:{" "}
              <strong className="font-mono text-slate-800">{report.documentHash}</strong>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Documento oficial gerado e certificado digitalmente pelo Sistema ArqVértice Flow. Dispensa assinaturas manuscritas.
            </p>
          </div>
          <div className="mt-3 sm:mt-0 print-hidden">
            <Link
              href={`/admin/projetos/${projectId}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              ← Voltar ao Painel do Projeto
            </Link>
          </div>
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
