"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectFinanceManager } from "./project-finance-manager";
import { CommercialSummary } from "@/components/proposals/commercial-summary";
import { ProposalActions } from "@/components/proposals/proposal-actions";
import { BriefingLinkManager } from "@/components/briefing/briefing-link-manager";
import { ProjectDeliverablesTab } from "@/components/deliverables/project-deliverables-tab";
import type { DeliverableCardItem } from "@/components/deliverables/deliverable-card";
import { ProjectChecklistTab } from "@/components/deliverables/project-checklist-tab";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentList } from "@/components/documents/document-list";
import { ReportVisibilityControl } from "@/components/reports/report-visibility-control";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ChecklistItemData } from "@/server/actions/checklist";

export type TabKey = "plantas" | "cronograma" | "geral" | "checklist" | "pranchas";
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
    columns: Array<{ id: string; label: string; cards: Array<{ id: string; name: string; discipline: string | null; completion: number; dueDate: Date | string | null; designer: string | null; status: string }> }>;
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
    if (param === "pranchas" || param === "plantas") return "plantas";
    if (param === "cronograma" || param === "geral" || param === "checklist") return "cronograma";
    return "plantas"; // Padrão: Módulo 1 (Plantas Cadastradas)
  };

  // Determina a sub-aba do cronograma ativa
  const resolveCronoSubTab = (param: TabKey | null): CronoSubTabKey => {
    if (param === "geral") return "financeiro";
    if (param === "checklist") return "checklist";
    return "etapas";
  };

  const [mainModule, setMainModule] = useState<MainModuleKey>(resolveMainModule(tabParam));
  const [cronoSubTab, setCronoSubTab] = useState<CronoSubTabKey>(resolveCronoSubTab(tabParam));

  // Sincroniza com parâmetros de busca
  useEffect(() => {
    if (tabParam) {
      setMainModule(resolveMainModule(tabParam));
      setCronoSubTab(resolveCronoSubTab(tabParam));
    }
  }, [tabParam]);

  const switchMainModule = (mod: MainModuleKey) => {
    setMainModule(mod);
    const targetTab = mod === "plantas" ? "plantas" : cronoSubTab === "financeiro" ? "geral" : cronoSubTab === "checklist" ? "checklist" : "cronograma";
    const url = new URL(window.location.href);
    url.searchParams.set("tab", targetTab);
    window.history.replaceState({}, "", url.toString());
  };

  const switchCronoSubTab = (sub: CronoSubTabKey) => {
    setCronoSubTab(sub);
    const targetTab = sub === "financeiro" ? "geral" : sub === "checklist" ? "checklist" : "cronograma";
    const url = new URL(window.location.href);
    url.searchParams.set("tab", targetTab);
    window.history.replaceState({}, "", url.toString());
  };

  const totalStages = board?.totals?.stages ?? 0;
  const completion = board?.totals?.completion ?? 0;
  const overdue = board?.totals?.overdue ?? 0;
  const allCards = (board?.columns || []).flatMap((c) => c.cards || []);

  // Métricas do Checklist de Obra
  const totalChecklist = checklistItems.length;
  const completedChecklist = checklistItems.filter((i) => i.isCompleted).length;
  const checklistRate = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Address fields
  const addressObj = (project.address || {}) as Record<string, string>;
  const addressFormatted = addressObj.formatted || addressObj.localizacao || "Loteamento Praia Bela, Litoral Sul";
  const loteQuadra = addressObj.loteQuadra || addressObj.lote || "Lote 14, Quadra B";
  const areaConstruida = addressObj.areaConstruida || addressObj.area || "385,00 m²";

  return (
    <div className="space-y-6 font-sans">
      {/* ============================================================== */}
      {/* TAREFA 1: SELETOR DE MÓDULOS APPLE HIG NO TOPO DO PROJETO      */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MÓDULO 1: PLANTAS CADASTRADAS (ACERVO TÉCNICO) */}
        <button
          type="button"
          onClick={() => switchMainModule("plantas")}
          className={`group relative flex items-start gap-4 rounded-3xl p-5 text-left transition-all duration-200 border ${
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
              Plantas Cadastradas (Acervo Técnico)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
              Pranchas normativas, memoriais de cálculo e renders 3D em alta resolução
            </p>
          </div>
        </button>

        {/* MÓDULO 2: CRONOGRAMA FÍSICO & RELATÓRIOS */}
        <button
          type="button"
          onClick={() => switchMainModule("cronograma")}
          className={`group relative flex items-start gap-4 rounded-3xl p-5 text-left transition-all duration-200 border ${
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
          <ProjectDeliverablesTab
            projectId={project.id}
            initialDeliverables={deliverables}
            initialMatrix={deliverableMatrix}
            stages={stages}
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
            <div className="flex space-x-1 rounded-2xl bg-slate-200/70 p-1.5 shadow-inner">
              {[
                { key: "etapas" as CronoSubTabKey, label: "Avanço Físico & 14 Etapas", icon: "📈", badge: `${completion}%` },
                { key: "financeiro" as CronoSubTabKey, label: "Visão Geral & Financeiro", icon: "💰", badge: `${installments.length} parcelas` },
                { key: "checklist" as CronoSubTabKey, label: "Checklist de Obra", icon: "✅", badge: `${checklistRate}%` },
              ].map((sub) => {
                const active = cronoSubTab === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => switchCronoSubTab(sub.key)}
                    className={`flex items-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition-all duration-200 ${
                      active
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    <span>{sub.icon}</span>
                    <span>{sub.label}</span>
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

            <div className="flex items-center gap-2">
              <Link
                href={`/admin/projetos/${project.id}/cronograma`}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                Quadro Kanban →
              </Link>
              <Link
                href={`/admin/projetos/${project.id}/relatorio`}
                className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
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
                      Avanço Físico das 14 Etapas Canônicas
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {totalStages} etapa(s) cadastradas · {completion}% de avanço linear médio ponderado
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
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
                    <span className="text-blue-600 font-bold">{completion}%</span>
                  </div>
                  <Progress value={completion} />
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
                      {allCards.map((c, idx) => (
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
                            {c.dueDate ? new Date(c.dueDate).toLocaleDateString("pt-BR") : "—"}
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
                            <Badge tone={c.completion === 100 ? "green" : c.completion > 0 ? "blue" : "neutral"}>
                              {c.completion === 100 ? "Concluída" : c.completion > 0 ? "Em andamento" : "Não iniciada"}
                            </Badge>
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

          {/* Sub-Aba 2: Visão Geral & Financeiro */}
          {cronoSubTab === "financeiro" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Card de Ficha Rápida da Edificação */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Localização / Lote</p>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">{loteQuadra}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{addressFormatted}</p>
                </Card>

                <Card className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Área Construída</p>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">{areaConstruida}</p>
                  <p className="text-xs text-slate-500">{project.type || "Residencial Alto Padrão"}</p>
                </Card>

                <Card className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cliente / Contratante</p>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">{project.client?.name || "Não informado"}</p>
                  <p className="text-xs text-slate-500">{project.client?.phone || project.client?.email || "Contato cadastrado"}</p>
                </Card>

                <Card className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status Operacional</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-slate-900">Em Execução Ativa</span>
                  </div>
                  <p className="text-xs text-slate-500">{completion}% do escopo físico concluído</p>
                </Card>
              </div>

              {/* Módulo Financeiro com toggles de parcelas */}
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
    </div>
  );
}
