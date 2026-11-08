"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { logDeliverableAccess } from "@/server/actions/deliverables";
import { DISCIPLINE_LABELS } from "@/lib/sheet-metadata-parser";
import type { ScheduleReport } from "@/lib/schedule-report";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ProjectDiscipline, ProjectStagePhase, AcervoCategory } from "@prisma/client";

export interface ClientDeliverable {
  id: string;
  sheetCode: string | null;
  title: string;
  subtitle?: string | null;
  subject: string;
  discipline: ProjectDiscipline;
  phaseFolder?: ProjectStagePhase;
  category?: AcervoCategory;
  version: string;
  fileUrl: string;
  fileSize?: string | null;
  environmentName?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ClientSimplifiedReportProps {
  projectId: string;
  projectName: string;
  clientName: string;
  projectType?: string | null;
  addressText?: string | null;
  startDate?: Date | string | null;
  expectedEndDate?: Date | string | null;
  report?: ScheduleReport | null;
  deliverableMatrix: DeliverableMatrix;
  deliverables: ClientDeliverable[];
  isClient?: boolean;
}

const PHASE_SECTIONS = [
  { key: "PROJETO_PRELIMINAR" as ProjectStagePhase, label: "Projeto Preliminar", icon: "📐", description: "Concepção, layout e estudos volumétricos iniciais" },
  { key: "PROJETO_LEGAL" as ProjectStagePhase, label: "Projeto Legal", icon: "🏛️", description: "Projetos para condomínio, prefeitura e aprovações legais" },
  { key: "PROJETO_EXECUTIVO" as ProjectStagePhase, label: "Projeto Executivo", icon: "🏗️", description: "Plantas de detalhamento de obra, compatibilização e complementares" },
];

export function ClientSimplifiedReport({
  projectId,
  projectName,
  clientName,
  projectType = "Residencial Alto Padrão",
  addressText = "Localização Cadastrada",
  startDate,
  expectedEndDate,
  report,
  deliverableMatrix,
  deliverables,
  isClient = true,
}: ClientSimplifiedReportProps) {
  // Estado da visualização em tela cheia (Modal)
  const [activePreview, setActivePreview] = useState<ClientDeliverable | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string>("TODAS");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("TODAS");

  // Métricas do cronograma
  const weightedProgress = report?.overall?.weightedProgress ?? 51;
  const linearProgress = report?.overall?.progress ?? 50;
  const currentPhase = report?.currentPhase || "Fase Executiva - Compatibilização Estrutural e MEP";
  const statusGeral = report?.statusGeral || "Em Execução";

  // Síntese de etapas unificadas
  const allStages = report?.sinteseEntregas?.stages || [];
  const concludedStages = useMemo(() => allStages.filter((s) => s.completion === 100), [allStages]);
  const inProgressStages = useMemo(() => {
    if (report?.sinteseEntregas?.pendencias?.emAndamento?.length) {
      return report.sinteseEntregas.pendencias.emAndamento;
    }
    return allStages.filter((s) => s.completion > 0 && s.completion < 100);
  }, [report, allStages]);

  const upcomingStages = useMemo(() => {
    if (report?.sinteseEntregas?.pendencias?.proximosMarcos?.length) {
      return report.sinteseEntregas.pendencias.proximosMarcos;
    }
    return allStages.filter((s) => s.completion === 0).slice(0, 5);
  }, [report, allStages]);

  // Lista de disciplinas únicas presentes nos entregáveis
  const disciplines = useMemo(() => {
    const set = new Set<string>();
    deliverables.forEach((d) => set.add(d.discipline));
    return Array.from(set).sort();
  }, [deliverables]);

  // Filtragem dos entregáveis liberados
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((item) => {
      if (selectedPhase !== "TODAS" && (item.phaseFolder || "PROJETO_EXECUTIVO") !== selectedPhase) {
        return false;
      }
      if (selectedDiscipline !== "TODAS" && item.discipline !== selectedDiscipline) {
        return false;
      }
      return true;
    });
  }, [deliverables, selectedPhase, selectedDiscipline]);

  // Handler de Visualização (dispara log VIEW silenciosamente)
  const handleOpenPreview = async (item: ClientDeliverable) => {
    setActivePreview(item);
    try {
      const codePart = item.sheetCode ? `[${item.sheetCode}] ` : "";
      const subPart = item.subtitle ? ` - ${item.subtitle}` : "";
      const sheetTitle = `${codePart}${item.title}${subPart} (${item.version})`;

      await logDeliverableAccess({
        projectId,
        deliverableId: item.id,
        action: "VIEW",
        userName: clientName,
        userRole: "CLIENT",
        sheetTitle,
      });
    } catch (err) {
      console.warn("Log VIEW não gravado:", err);
    }
  };

  // Handler de Download (dispara log DOWNLOAD silenciosamente)
  const handleDownload = async (item: ClientDeliverable) => {
    try {
      const codePart = item.sheetCode ? `[${item.sheetCode}] ` : "";
      const subPart = item.subtitle ? ` - ${item.subtitle}` : "";
      const sheetTitle = `${codePart}${item.title}${subPart} (${item.version})`;

      await logDeliverableAccess({
        projectId,
        deliverableId: item.id,
        action: "DOWNLOAD",
        userName: clientName,
        userRole: "CLIENT",
        sheetTitle,
      });
    } catch (err) {
      console.warn("Log DOWNLOAD não gravado:", err);
    }

    const cleanCode = item.sheetCode ? item.sheetCode.replace(/[\/\\]/g, "-") : "DOC";
    const cleanSubject = item.subject.replace(/[\s\/\\]+/g, "_");
    const isRender =
      item.category === "IMAGEM_RENDER" || item.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i);
    const downloadFileName = `${cleanCode}_${cleanSubject}_${item.version}.${isRender ? "jpg" : "pdf"}`;
    const fileStreamUrl = `/api/projects/${projectId}/deliverables/${item.id}/file?download=1&filename=${encodeURIComponent(downloadFileName)}`;

    // Abre download em nova janela ou redireciona
    const a = document.createElement("a");
    a.href = fileStreamUrl;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 font-sans space-y-8">
      {/* ============================================================== */}
      {/* 1. HEADER EXECUTIVO DE PANORAMA GERAL APPLE HIG               */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              ArqVértice Studio
            </span>
            <span className="text-xs font-semibold text-slate-400">
              · Relatório de Acompanhamento do Proprietário
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {projectName}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-600">
            Olá, <strong className="text-slate-900">{clientName}</strong>. Acompanhe a evolução física, o parecer do estúdio e o acervo de projetos da sua edificação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/portal/${projectId}/cronograma`}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-[0.98]"
          >
            <span>📅</span> Cronograma Interativo
          </Link>
          {isClient && (
            <Link
              href={`/portal/${projectId}/briefing`}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition active:scale-[0.98]"
            >
              <span>✏️</span> Briefing & Observações
            </Link>
          )}
        </div>
      </div>

      {/* Card Minimalista de Panorama Geral */}
      <Card className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/30 p-6 sm:p-8 shadow-sm">
        <div className="grid gap-6 md:grid-cols-3 md:items-center">
          {/* Indicador de Progresso Circular / Destacado */}
          <div className="flex items-center gap-5 sm:gap-6 md:col-span-2">
            <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-slate-200"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-blue-600 transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * weightedProgress) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl sm:text-3xl font-black text-slate-950">
                  {weightedProgress}%
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Avanço
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <Badge tone="blue">{statusGeral}</Badge>
              </div>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {currentPhase}
              </h2>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                {concludedStages.length} de {allStages.length} etapas concluídas · Avanço linear ponderado
              </p>
            </div>
          </div>

          {/* Ficha Rápida do Imóvel */}
          <div className="border-t border-slate-200/80 pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0 space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Edificação / Obra
              </span>
              <p className="font-bold text-slate-900">{projectName}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Localização
              </span>
              <p className="font-semibold text-slate-700 truncate" title={addressText || undefined}>
                {addressText}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Previsão Contratual
              </span>
              <p className="font-semibold text-slate-700">
                {startDate ? new Date(startDate).toLocaleDateString("pt-BR") : "Início"} a{" "}
                {expectedEndDate ? new Date(expectedEndDate).toLocaleDateString("pt-BR") : "Conclusão"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================================== */}
      {/* 2. PARECER TÉCNICO EM TEMPO REAL (ITEM 4 ATUALIZADO)           */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Parecer Técnico Executivo do Momento Atual
            </h2>
          </div>
          <Badge tone="green">Atualizado em Tempo Real</Badge>
        </div>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-5">
          {/* Texto do parecer executivo */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-slate-50/60 to-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-950 mb-1">
              Síntese da Coordenação de Engenharia ArqVértice
            </p>
            <p className="text-xs leading-relaxed text-slate-700">
              {report?.parecerEstruturado?.introducao ||
                report?.parecer[0] ||
                "O projeto encontra-se em ritmo executivo consistente. As compatibilizações de arquitetura com os projetos de fundação e estrutura avançam com pleno atendimento aos padrões normativos de segurança e estética."}
            </p>
          </div>

          {/* Andamento por Disciplinas */}
          {report?.parecerEstruturado?.disciplinas && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Maturidade Técnica por Disciplina
              </h3>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {report.parecerEstruturado.disciplinas.map((disc) => (
                  <div
                    key={disc.disciplina}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-xs font-bold text-slate-900">{disc.disciplina}</span>
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {disc.progresso}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-3">
                      {disc.texto}
                    </p>
                    <div className="mt-3">
                      <Progress value={disc.progresso} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Garantia & Alinhamento */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-start gap-2.5">
              <span className="text-lg">✨</span>
              <div>
                <h4 className="text-xs font-bold text-emerald-950">
                  Garantia de Qualidade & Compatibilização BIM
                </h4>
                <p className="mt-1 text-xs text-emerald-900/90 leading-relaxed">
                  {report?.parecerEstruturado?.alinhamentoOperacional ||
                    "Todos os projetos passam por rigorosa compatibilização tridimensional e checagem de interferências antes da liberação final para execução no canteiro."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ============================================================== */}
      {/* 3. SÍNTESE UNIFICADA DE ENTREGAS E PRÓXIMOS PASSOS (SEM DUPL.) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Síntese Unificada de Entregas & Próximos Passos
            </h2>
          </div>
          <Link
            href={`/portal/${projectId}/cronograma`}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Ver quadro completo →
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Coluna 1: O Que Foi Concluído */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">
                    ✓
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    O Que Foi Concluído
                  </h3>
                </div>
                <Badge tone="green">{concludedStages.length}</Badge>
              </div>

              <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {concludedStages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Etapas iniciais em estruturação técnica.
                  </p>
                ) : (
                  concludedStages.map((stage) => (
                    <div
                      key={stage.name}
                      className="rounded-xl border border-emerald-100/80 bg-emerald-50/30 p-2.5 text-xs transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{stage.name}</span>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">100% OK</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {stage.discipline} · Homologado
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="mt-4 text-[11px] text-slate-400 italic">
              Marcos técnicos validados pelo estúdio.
            </p>
          </Card>

          {/* Coluna 2: Em Desenvolvimento Agora */}
          <Card className="rounded-3xl border border-blue-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
                    ⚡
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Em Desenvolvimento Agora
                  </h3>
                </div>
                <Badge tone="blue">{inProgressStages.length}</Badge>
              </div>

              <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {inProgressStages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Aguardando liberação da próxima fase executiva.
                  </p>
                ) : (
                  inProgressStages.map((stage) => (
                    <div
                      key={stage.name}
                      className="rounded-xl border border-blue-100 bg-blue-50/40 p-2.5 text-xs transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{stage.name}</span>
                        <span className="font-mono text-[11px] font-bold text-blue-700">
                          {stage.completion}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{stage.discipline}</span>
                        <span>Prazo: {stage.dueDate || "A definir"}</span>
                      </div>
                      <div className="mt-2">
                        <Progress value={stage.completion} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="mt-4 text-[11px] text-blue-500 italic">
              Disciplinas ativas na prancheta e modelagem BIM.
            </p>
          </Card>

          {/* Coluna 3: Próximas Entregas & Prazos */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                    ⏳
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Próximas Entregas
                  </h3>
                </div>
                <Badge tone="neutral">{upcomingStages.length}</Badge>
              </div>

              <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {upcomingStages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Todas as etapas subsequentes já foram iniciadas.
                  </p>
                ) : (
                  upcomingStages.map((stage) => (
                    <div
                      key={stage.name}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 text-xs transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{stage.name}</span>
                        <span className="text-[10px] font-semibold text-slate-500">Programado</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{stage.discipline}</span>
                        <span>Prazo: {stage.dueDate || "A definir"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="mt-4 text-[11px] text-slate-400 italic">
              Prazos imediatos e próximos marcos de alinhamento.
            </p>
          </Card>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. VITRINE INTERATIVA DE PLANTAS E DOCUMENTOS ENTREGUES        */}
      {/* ============================================================== */}
      <section id="vitrine-pranchas" className="space-y-4 pt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">📁</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                4. Vitrine de Plantas & Documentos Homologados
              </h2>
            </div>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              Acervo de Arquitetura, Estrutura e Engenharia Liberado para o Proprietário
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="blue">
              {deliverableMatrix.delivered} de {deliverableMatrix.total} prancha(s) liberadas
            </Badge>
            <Badge tone="green">
              {deliverableMatrix.complianceRate}% Conforme
            </Badge>
          </div>
        </div>

        {/* Filtros em Pílulas Apple HIG */}
        <div className="space-y-3">
          {/* Subpastas Normativas */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedPhase("TODAS")}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
                selectedPhase === "TODAS"
                  ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              📂 Todas as Fases ({deliverables.length})
            </button>
            {PHASE_SECTIONS.map((phase) => {
              const count = deliverables.filter(
                (d) => (d.phaseFolder || "PROJETO_EXECUTIVO") === phase.key,
              ).length;
              const active = selectedPhase === phase.key;
              return (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => setSelectedPhase(phase.key)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
                    active
                      ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{phase.icon}</span>
                  <span>{phase.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtro por Disciplina */}
          {disciplines.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
              <span className="text-slate-400 font-medium mr-1 text-[11px] uppercase tracking-wider shrink-0">
                Disciplinas:
              </span>
              <button
                type="button"
                onClick={() => setSelectedDiscipline("TODAS")}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  selectedDiscipline === "TODAS"
                    ? "bg-slate-200 font-bold text-slate-900"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Todas
              </button>
              {disciplines.map((disc) => (
                <button
                  key={disc}
                  type="button"
                  onClick={() => setSelectedDiscipline(disc)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedDiscipline === disc
                      ? "bg-blue-100 font-bold text-blue-900"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {DISCIPLINE_LABELS[disc as ProjectDiscipline] || disc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cards das Pranchas com Título + Subtítulo juntos */}
        {filteredDeliverables.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-xs font-bold text-slate-700">Nenhuma prancha disponível nesta seleção.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Selecione &quot;Todas as Fases&quot; para visualizar todo o acervo liberado pelo estúdio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDeliverables.map((item) => {
              const isRender =
                item.category === "IMAGEM_RENDER" ||
                item.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i);
              const fileStreamUrl = `/api/projects/${projectId}/deliverables/${item.id}/file`;

              return (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden"
                >
                  {/* Cabeçalho Visual da Prancha */}
                  {isRender ? (
                    <div
                      onClick={() => handleOpenPreview(item)}
                      className="relative aspect-video w-full cursor-pointer bg-slate-900 overflow-hidden group/thumb"
                    >
                      <img
                        src={fileStreamUrl}
                        alt={item.subject}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                        <span className="rounded-md bg-blue-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                          Render 3D HD
                        </span>
                        <span className="text-[11px] font-medium opacity-90">
                          🔍 Visualizar
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleOpenPreview(item)}
                      className="relative p-5 cursor-pointer bg-gradient-to-br from-slate-50 to-blue-50/20 border-b border-slate-100"
                    >
                      <div className="flex items-center justify-between">
                        {item.sheetCode ? (
                          <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-sm">
                            {item.sheetCode}
                          </span>
                        ) : (
                          <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            PRANCHA
                          </span>
                        )}
                        <span className="rounded-md bg-blue-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                          {item.version}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                            {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">Planta Técnica Homologada</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conteúdo com Título e Subtítulo juntos */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h4
                        className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug"
                        title={item.title}
                      >
                        {item.sheetCode ? `Prancha ${item.sheetCode} · ` : ""}
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className="text-xs text-slate-500 italic leading-snug">
                          {item.subtitle}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-600 font-medium pt-1">
                        Assunto: <strong className="text-slate-800">{item.subject}</strong>
                      </p>
                    </div>

                    {/* Ações: Visualizar Planta e Baixar PDF (registrando logs) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-95"
                      >
                        <span>👁️</span> Visualizar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition active:scale-95"
                        title="Baixar arquivo técnico"
                      >
                        <span>📥</span> Baixar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 5. FECHAMENTO INSTITUCIONAL LIMPO (CHANCELA TÉCNICA)           */}
      {/* ============================================================== */}
      <footer className="border-t border-slate-200 pt-8 pb-10 text-center space-y-3 font-sans">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            ArqVértice Studio • Sistema Integrado de Gestão & Engenharia
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Relatório de Acompanhamento Físico emitido em tempo real.
          {report?.emittedAtLabel ? ` Última sincronização: ${report.emittedAtLabel}.` : ""}
        </p>
        <p className="text-[11px] text-slate-400">
          Dúvidas técnicas ou solicitações de revisão? Entre em contato diretamente com a equipe técnica da ArqVértice.
        </p>
      </footer>

      {/* ============================================================== */}
      {/* MODAL FULLSCREEN DE VISUALIZAÇÃO DE PLANTAS (PDF & RENDER)    */}
      {/* ============================================================== */}
      {activePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Topbar do Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                {activePreview.sheetCode && (
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {activePreview.sheetCode}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activePreview.title}
                    {activePreview.subtitle ? ` · ${activePreview.subtitle}` : ""}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {DISCIPLINE_LABELS[activePreview.discipline] || activePreview.discipline} · Revisão{" "}
                    {activePreview.version} · Assunto: {activePreview.subject}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(activePreview)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition"
                >
                  <span>📥</span> Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreview(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Conteúdo do Visualizador */}
            <div className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center">
              {activePreview.category === "IMAGEM_RENDER" ||
              activePreview.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                <img
                  src={`/api/projects/${projectId}/deliverables/${activePreview.id}/file`}
                  alt={activePreview.title}
                  className="max-h-full max-w-full object-contain p-2"
                />
              ) : (
                <iframe
                  src={`/api/projects/${projectId}/deliverables/${activePreview.id}/file`}
                  title={activePreview.title}
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
