"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
import { formatDateBR, formatCurrencyBRL } from "@/lib/formatters";
import { CommercialSummary } from "@/components/proposals/commercial-summary";
import { ProposalActions } from "@/components/proposals/proposal-actions";
import { BriefingLinkManager } from "@/components/briefing/briefing-link-manager";
import type { DeliverableCardItem } from "@/components/deliverables/deliverable-card";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentList } from "@/components/documents/document-list";
import { ReportVisibilityControl } from "@/components/reports/report-visibility-control";
import type { StageFormData } from "@/components/schedule/stage-form-modal";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ChecklistItemData } from "@/server/actions/checklist";

// Code splitting com next/dynamic (ssr: false) para abas e modais pesados
const StageFormModal = dynamic(
  () => import("@/components/schedule/stage-form-modal").then((mod) => mod.StageFormModal),
  { ssr: false }
);

const ProjectFinanceManager = dynamic(
  () => import("./project-finance-manager").then((mod) => mod.ProjectFinanceManager),
  { ssr: false }
);

const ProjectAcervoTab = dynamic(
  () => import("@/components/deliverables/project-acervo-tab").then((mod) => mod.ProjectAcervoTab),
  { ssr: false }
);

const ProjectChecklistTab = dynamic(
  () => import("@/components/deliverables/project-checklist-tab").then((mod) => mod.ProjectChecklistTab),
  { ssr: false }
);

export type TabKey = "acervo" | "plantas" | "cronograma" | "geral" | "financeiro" | "checklist" | "pranchas" | "etapas";
export type MainModuleKey = "plantas" | "cronograma";
export type CronoSubTabKey = "etapas" | "financeiro" | "checklist";

interface ProjectDetailTabsProps {
  project: {
    id: string;
    name: string;
    type: string | null;
    status: string;
    budget: number | null;
    startDate: Date | null;
    expectedEndDate: Date | null;
    address: Record<string, unknown> | null;
    client?: { name: string; phone: string | null; email: string | null } | null;
  };
  linkStatus: { briefingStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED"; linkStatus: "NOT_STARTED" | "ACTIVE" | "REVOKED" } | null;
  reports: Array<{ id: string; title: string; status: "PREPARING" | "INTERNAL" | "RELEASED" | "ARCHIVED" }>;
  documents: Array<{ id: string; name: string; mimeType: string | null; sizeBytes: bigint | null; visibility: "INTERNAL" | "CLIENT"; createdAt: Date }>;
  commercial: unknown;
  board: {
    columns: Array<{ id: string; label: string; cards: Array<{ id: string; name: string; discipline: string | null; completion: number; dueDate: Date | string | null; designer: string | null; status: string; isVisibleInKanban?: boolean }> }>;
    totals: { stages: number; completion: number; overdue: number };
  } | null;
  installments: Array<{ id: string; description: string; amount: number; dueDate: Date; paidDate: Date | null; status: string; linkedStageId: string | null; order: number }>;
  deliverables: DeliverableCardItem[];
  deliverableMatrix: DeliverableMatrix;
  stages: Array<{ id: string; name: string; discipline?: string | null }>;
  checklistItems?: ChecklistItemData[];
}

export function ProjectDetailTabs({
  project,
  linkStatus,
  reports,
  documents,
  commercial,
  board,
  installments,
  deliverables,
  deliverableMatrix,
  stages,
  checklistItems = [],
}: ProjectDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lê a aba inicial da URL
  const tabParam = searchParams.get("tab") as TabKey | null;

  // Determina o módulo principal ativo
  const resolveMainModule = (param: TabKey | null): MainModuleKey => {
    if (param === "acervo" || param === "pranchas" || param === "plantas") return "plantas";
    if (param === "cronograma" || param === "etapas" || param === "geral" || param === "financeiro" || param === "checklist") return "cronograma";
    return "plantas"; // Padrão: Módulo 1 (Acervo Técnico)
  };

  // Determina a sub-aba do cronograma ativa
  const resolveCronoSubTab = (param: TabKey | null): CronoSubTabKey => {
    if (param === "financeiro" || param === "geral") return "financeiro";
    if (param === "checklist") return "checklist";
    return "etapas";
  };

  const [mainModule, setMainModule] = useState<MainModuleKey>(resolveMainModule(tabParam));
  const [cronoSubTab, setCronoSubTab] = useState<CronoSubTabKey>(resolveCronoSubTab(tabParam));
  const [selectedStageToEdit, setSelectedStageToEdit] = useState<StageFormData | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [triggerUploadSignal, setTriggerUploadSignal] = useState(0);

  const handleOpenNewDeliverable = () => {
    if (mainModule !== "plantas") {
      switchMainModule("plantas");
    }
    setTriggerUploadSignal((prev) => prev + 1);
  };

  // Sincroniza com parâmetros de busca
  useEffect(() => {
    if (tabParam) {
      setMainModule(resolveMainModule(tabParam));
      setCronoSubTab(resolveCronoSubTab(tabParam));
    }
  }, [tabParam]);

  const switchMainModule = (mod: MainModuleKey) => {
    setMainModule(mod);
    const targetTab = mod === "plantas" ? "acervo" : cronoSubTab === "financeiro" ? "financeiro" : cronoSubTab === "checklist" ? "checklist" : "cronograma";
    const url = new URL(window.location.href);
    url.searchParams.set("tab", targetTab);
    window.history.replaceState({}, "", url.toString());
  };

  const switchCronoSubTab = (sub: CronoSubTabKey) => {
    setCronoSubTab(sub);
    const targetTab = sub === "financeiro" ? "financeiro" : sub === "checklist" ? "checklist" : "cronograma";
    const url = new URL(window.location.href);
    url.searchParams.set("tab", targetTab);
    window.history.replaceState({}, "", url.toString());
  };

  const totalStages = board?.totals?.stages ?? 0;
  const completion = board?.totals?.completion ?? 0;
  const overdue = board?.totals?.overdue ?? 0;
  const allCards = (board?.columns || []).flatMap((c) => c.cards || []);

  // Estados com reatividade otimista em tempo real
  const [stagesList, setStagesList] = useState(allCards);
  const [liveCompletion, setLiveCompletion] = useState(completion);

  useEffect(() => {
    const fresh = (board?.columns || []).flatMap((c) => c.cards || []);
    setStagesList(fresh);
    setLiveCompletion(board?.totals?.completion ?? 0);
  }, [board]);

  const handleStageSaved = (savedStage: {
    id?: string;
    name: string;
    completion?: number;
    discipline?: string | null;
    designer?: string | null;
    dueDate?: string | Date | null;
    isVisibleInKanban?: boolean;
  }) => {
    setStagesList((current) => {
      const existingIdx = current.findIndex((s) => s.id === savedStage.id);
      let nextList = [...current];
      if (existingIdx >= 0) {
        nextList[existingIdx] = {
          ...nextList[existingIdx],
          ...savedStage,
          dueDate: savedStage.dueDate ? new Date(savedStage.dueDate) : nextList[existingIdx].dueDate,
          completion: savedStage.completion ?? nextList[existingIdx].completion,
        };
      } else {
        nextList.push({
          id: savedStage.id || `temp-${Date.now()}`,
          name: savedStage.name,
          discipline: savedStage.discipline || null,
          designer: savedStage.designer || null,
          dueDate: savedStage.dueDate ? new Date(savedStage.dueDate) : null,
          completion: savedStage.completion ?? 0,
          status: (savedStage.completion ?? 0) === 100 ? "COMPLETED" : (savedStage.completion ?? 0) > 0 ? "IN_PROGRESS" : "NOT_STARTED",
          isVisibleInKanban: savedStage.isVisibleInKanban ?? true,
        });
      }
      const newCompletion = Math.round(
        nextList.reduce((acc, s) => acc + s.completion, 0) / (nextList.length || 1)
      );
      setLiveCompletion(newCompletion);
      return nextList;
    });
  };

  // Métricas do Checklist de Obra
  const totalChecklist = checklistItems.length;
  const completedChecklist = checklistItems.filter((i) => i.isCompleted).length;
  const checklistRate = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Address fields
  const addressObj = (project.address || {}) as Record<string, string>;
  const addressFormatted = addressObj.formatted || addressObj.localizacao || "Loteamento Praia Bela, Litoral Sul";
  const loteQuadra = addressObj.loteQuadra || addressObj.lote || "Lote 14, Quadra B";
  const areaConstruida = addressObj.areaConstruida || addressObj.area || "385,00 m²";
  const formattedBudget = project.budget
    ? formatCurrencyBRL(project.budget)
    : "R$ 30.000,00";

  return (
    <div className="space-y-6 font-sans">
      {/* ============================================================== */}
      {/* 1. ARQUITETURA "RECORD PAGE HEADER" (SALESFORCE LIGHTNING)    */}
      {/* ============================================================== */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs">
        {/* Barra de Registro Fixa (Record Banner) */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 border border-blue-200/60 text-2xl shadow-xs">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200/50">
                  {project.type || "Residencial Alto Padrão"}
                </span>
                <span className="text-xs font-semibold text-zinc-400">· Edificação</span>
                <span className="text-xs text-zinc-500">
                  Cliente: <strong className="text-zinc-800 font-semibold">{project.client?.name ?? "Não informado"}</strong>
                </span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                {project.name}
              </h1>
            </div>
          </div>

          {/* Botões de Ação Global à direita */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenNewDeliverable}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition active:scale-95 shadow-xs"
            >
              <span className="text-blue-600 font-black">+</span> Nova Prancha
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedStageToEdit(null);
                setIsStageModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition active:scale-95 shadow-xs"
            >
              <span className="text-blue-600 font-black">+</span> Nova Etapa
            </button>
            <Link
              href={`/admin/projetos/${project.id}/relatorio`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition active:scale-95 shadow-xs"
            >
              <span>📊</span> Visualizar Relatório
            </Link>
          </div>
        </div>

        {/* Grid de Métricas Principais em linha compacta (Inline Field Set) */}
        <div className="mt-5 pt-4 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Área Total
            </span>
            <span className="font-bold text-zinc-900 text-sm mt-0.5 block font-mono">
              {areaConstruida}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Valor Global
            </span>
            <span className="font-bold text-zinc-900 text-sm mt-0.5 block font-mono">
              {formattedBudget}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Progresso Físico
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-16 h-2 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${liveCompletion}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-zinc-900">
                {liveCompletion}% Concluído
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Status Executivo
            </span>
            <div className="mt-1">
              {overdue > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {overdue} Pendência(s)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Fases Liberadas
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SELETOR DE MÓDULOS PRINCIPAIS (ACERVO vs CRONOGRAMA)           */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MÓDULO 1: PLANTAS CADASTRADAS (ACERVO TÉCNICO) */}
        <button
          type="button"
          onClick={() => switchMainModule("plantas")}
          className={`group relative flex items-start gap-4 rounded-3xl p-5 text-left border active:scale-[0.98] transition-transform duration-75 select-none ${
            mainModule === "plantas"
              ? "bg-white border-blue-600 shadow-md ring-2 ring-blue-600/20"
              : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white shadow-xs"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl transition ${
              mainModule === "plantas"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600"
            }`}
          >
            📁
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  mainModule === "plantas" ? "text-blue-600" : "text-slate-400"
                }`}
              >
                Módulo 1
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  mainModule === "plantas"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {deliverables.length} itens no acervo
              </span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
              Acervo Técnico
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
              Repositório por Disciplina e Fases · Pranchas normativas, memoriais e renders 3D
            </p>
          </div>
        </button>

        {/* MÓDULO 2: CRONOGRAMA FÍSICO & RELATÓRIOS */}
        <button
          type="button"
          onClick={() => switchMainModule("cronograma")}
          className={`group relative flex items-start gap-4 rounded-3xl p-5 text-left border active:scale-[0.98] transition-transform duration-75 select-none ${
            mainModule === "cronograma"
              ? "bg-white border-blue-600 shadow-md ring-2 ring-blue-600/20"
              : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white shadow-xs"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl transition ${
              mainModule === "cronograma"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600"
            }`}
          >
            📊
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  mainModule === "cronograma" ? "text-blue-600" : "text-slate-400"
                }`}
              >
                Módulo 2
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  mainModule === "cronograma"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {completion}% concluído
              </span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
              Cronograma Físico & Relatórios
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
              Etapas executivas, subpastas operacionais, checklists e relatórios oficiais
            </p>
          </div>
        </button>
      </div>

      {/* ============================================================== */}
      {/* EXIBIÇÃO DO MÓDULO 1: PLANTAS CADASTRADAS (ACERVO TÉCNICO)     */}
      {/* ============================================================== */}
      {mainModule === "plantas" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <ProjectAcervoTab
            projectId={project.id}
            projectName={project.name}
            initialDeliverables={deliverables}
            initialMatrix={deliverableMatrix}
            stages={stages}
            triggerUploadSignal={triggerUploadSignal}
          />

          {/* Arquivos Gerais / Documentos Privados */}
          <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900">Documentos Privados & Arquivos Gerais</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Arquivos de apoio, contratos assinados e recibos armazenados de forma restrita do estúdio.
            </p>
            <div className="mt-4">
              <DocumentUploader projectId={project.id} />
              <DocumentList documents={documents} />
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* EXIBIÇÃO DO MÓDULO 2: CRONOGRAMA FÍSICO & RELATÓRIOS          */}
      {/* ============================================================== */}
      {mainModule === "cronograma" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Sub-navegação do Cronograma */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div className="flex space-x-1 rounded-2xl bg-slate-200/70 p-1.5 shadow-inner overflow-x-auto scrollbar-none flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 max-w-full">
              {[
                { key: "etapas" as CronoSubTabKey, label: "Avanço Físico & Etapas", icon: "📈", badge: `${completion}%` },
                { key: "financeiro" as CronoSubTabKey, label: "Gestão Financeira", icon: "💰", badge: `${installments.length} parcelas` },
                { key: "checklist" as CronoSubTabKey, label: "Checklist & Liberações", icon: "✅", badge: `${checklistRate}%` },
              ].map((sub) => {
                const active = cronoSubTab === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => switchCronoSubTab(sub.key)}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl py-2 px-3 text-xs font-bold active:scale-[0.98] transition-transform duration-75 select-none ${
                      active
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    <span>{sub.icon}</span>
                    <span className="whitespace-nowrap">{sub.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        active ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-700"
                      }`}
                    >
                      {sub.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Link
                href={`/admin/projetos/${project.id}/cronograma`}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-transform duration-75 select-none shadow-xs"
              >
                Quadro Kanban →
              </Link>
              <Link
                href={`/admin/projetos/${project.id}/relatorio`}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform duration-75 select-none shadow-xs"
              >
                Relatório Técnico Executivo
              </Link>
            </div>
          </div>

          {/* Sub-Aba 1: Avanço Físico & 14 Etapas */}
          {cronoSubTab === "etapas" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Controle Físico-Financeiro
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">
                      Avanço Físico das Etapas do Cronograma
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {stagesList.length} etapa(s) cadastradas · {liveCompletion}% de avanço linear médio ponderado
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStageToEdit(null);
                        setIsStageModalOpen(true);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition active:scale-95"
                    >
                      + Nova Etapa
                    </button>
                    <Link
                      href={`/admin/projetos/${project.id}/cronograma`}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      Abrir Quadro Kanban Interativo →
                    </Link>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-semibold">
                    <span>Progresso Consolidado do Empreendimento</span>
                    <span className="text-blue-600 font-bold">{liveCompletion}%</span>
                  </div>
                  <Progress value={liveCompletion} />
                </div>

                {overdue > 0 && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Há {overdue} etapa(s) com data limite expirada demandando alinhamento prioritário.</span>
                  </div>
                )}
              </Card>

              {/* Tabela das 14 Etapas */}
              <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm overflow-hidden">
                <h4 className="text-sm font-bold text-slate-900 mb-3">Etapas do Empreendimento</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 pl-3 pr-2">#</th>
                        <th className="py-2.5 px-2">Etapa</th>
                        <th className="py-2.5 px-2">Disciplina</th>
                        <th className="py-2.5 px-2">Responsável</th>
                        <th className="py-2.5 px-2">Data Limite</th>
                        <th className="py-2.5 px-2 w-36">Avanço Físico</th>
                        <th className="py-2.5 pr-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {stagesList.map((c, idx) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-slate-400">
                            {String(idx + 1).padStart(2, "0")}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-900">{c.name}</td>
                          <td className="py-2.5 px-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                              {c.discipline || "Geral"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">{c.designer || "Eduardo Marques"}</td>
                          <td className="py-2.5 px-2 font-medium text-slate-600">
                            {formatDateBR(c.dueDate)}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <Progress value={c.completion} />
                              </div>
                              <span className="font-bold text-slate-900 text-[11px]">{c.completion}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Badge tone={c.completion === 100 ? "green" : c.completion > 0 ? "blue" : "neutral"}>
                                {c.completion === 100 ? "Concluída" : c.completion > 0 ? "Em andamento" : "Não iniciada"}
                              </Badge>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStageToEdit({
                                    name: `${c.name} (Cópia)`,
                                    discipline: c.discipline,
                                    designer: c.designer,
                                    dueDate: c.dueDate,
                                    completion: 0,
                                  });
                                  setIsStageModalOpen(true);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs active:scale-95"
                                title="Duplicar etapa"
                              >
                                📑 Duplicar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Controle de Relatórios */}
              <div>
                <ReportVisibilityControl
                  projectId={project.id}
                  reports={reports.map((r) => ({ id: r.id, title: r.title, status: r.status }))}
                />
              </div>
            </div>
          )}

          {/* Sub-Aba 2: Gestão Financeira */}
          {cronoSubTab === "financeiro" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Módulo Financeiro com criação e edição de parcelas */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Controle de Desembolso
                    </span>
                    <h3 className="mt-1 text-base font-bold text-slate-900">
                      Gestão Financeira & Parcelas Contratuais
                    </h3>
                  </div>
                  <Badge tone="blue">{installments.length} parcelas</Badge>
                </div>
                <div className="mt-4">
                  <ProjectFinanceManager
                    projectId={project.id}
                    initialInstallments={installments.map((item) => ({ ...item, amount: Number(item.amount ?? 0) }))}
                    stages={stages}
                  />
                </div>
              </div>

              {/* Proposta Comercial & Briefing Integrado */}
              <div className="grid gap-6 lg:grid-cols-2">
                {commercial ? (
                  <div>
                    <CommercialSummary summary={commercial as never} />
                  </div>
                ) : null}

                <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Apresentação & Proposta Comercial</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Gere apresentações comerciais versionadas com link público seguro e memorial descritivo.
                    </p>
                    <div className="mt-4">
                      <ProposalActions projectId={project.id} />
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <Link
                      href={`/admin/projetos/${project.id}/relatorio`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Abrir Relatório Técnico Executivo Oficial →
                    </Link>
                  </div>
                </Card>
              </div>

              {/* Briefing do Cliente */}
              <BriefingLinkManager
                projectId={project.id}
                clientName={project.client?.name}
                clientPhone={project.client?.phone}
                initialStatus={
                  linkStatus?.briefingStatus === "COMPLETED" || linkStatus?.briefingStatus === "SUBMITTED"
                    ? "SUBMITTED"
                    : linkStatus?.briefingStatus === "IN_PROGRESS"
                      ? "IN_PROGRESS"
                      : "NOT_STARTED"
                }
                initialLinkStatus={linkStatus?.linkStatus === "ACTIVE" ? "ACTIVE" : "REVOKED"}
              />
            </div>
          )}

          {/* Sub-Aba 3: Checklist de Obra */}
          {cronoSubTab === "checklist" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <ProjectChecklistTab
                projectId={project.id}
                initialItems={checklistItems}
                stages={stages}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal de Criação / Duplicação de Etapa */}
      <StageFormModal
        projectId={project.id}
        initialStage={selectedStageToEdit}
        isOpen={isStageModalOpen}
        onClose={() => {
          setIsStageModalOpen(false);
          setSelectedStageToEdit(null);
        }}
        onSaved={handleStageSaved}
      />
    </div>
  );
}
