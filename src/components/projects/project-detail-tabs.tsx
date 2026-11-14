"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
import { formatDateBR } from "@/lib/formatters";
import type { DeliverableCardItem } from "@/components/deliverables/deliverable-card";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";

// Code splitting com next/dynamic (ssr: false) para abas pesadas
const ProjectAcervoTab = dynamic(
  () => import("@/components/deliverables/project-acervo-tab").then((mod) => mod.ProjectAcervoTab),
  { ssr: false }
);

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
  documents: Array<{
    id: string;
    name: string;
    mimeType: string | null;
    sizeBytes: bigint | null;
    visibility: "INTERNAL" | "CLIENT";
    createdAt: Date;
  }>;
  deliverables: DeliverableCardItem[];
  deliverableMatrix: DeliverableMatrix;
  stages: Array<{ id: string; name: string; discipline?: string | null }>;
  completion: number;
  overdueCount: number;
  basePath?: string;
}

export function ProjectDetailTabs({
  project,
  documents = [],
  deliverables = [],
  deliverableMatrix,
  stages = [],
  completion = 0,
  overdueCount = 0,
  basePath = "/admin",
}: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"acervo" | "documentos">("acervo");
  const kanbanHref =
    basePath === "/equipe"
      ? `/equipe/cronograma/${project.id}`
      : `${basePath}/projetos/${project.id}/cronograma`;

  return (
    <div className="space-y-6">
      {/* RECORD PAGE HEADER CONSOLIDADO */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{project?.name ?? "Projeto"}</h1>
              <Badge tone="neutral" className="text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {project?.type || "Residencial"}
              </Badge>
              <Badge
                tone={project?.status === "EM_ANDAMENTO" || project?.status === "IN_PROGRESS" ? "green" : "neutral"}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              >
                {project?.status === "EM_ANDAMENTO" || project?.status === "IN_PROGRESS"
                  ? "Em Andamento"
                  : project?.status ?? "Ativo"}
              </Badge>
            </div>
            <div className="text-sm text-zinc-500 flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">Cliente:</span>
                <span className="font-semibold text-zinc-800">{project?.client?.name ?? "Cliente não informado"}</span>
              </div>
              {project?.startDate && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 font-medium">Início:</span>
                  <span className="text-zinc-700 font-medium">{formatDateBR(project.startDate)}</span>
                </div>
              )}
              {project?.expectedEndDate && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 font-medium">Previsão:</span>
                  <span className="text-zinc-700 font-medium">{formatDateBR(project.expectedEndDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={kanbanHref}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition active:scale-[0.98]"
            >
              <span>📊</span>
              <span>Abrir no Kanban</span>
            </Link>
            <Link
              href={`${basePath}/projetos/${project.id}/relatorio`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-xl transition active:scale-[0.98]"
            >
              <span>📄</span>
              <span>Relatório PDF</span>
            </Link>
            <Link
              href={`${basePath}/financeiro?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition active:scale-[0.98]"
            >
              <span>💰</span>
              <span>Gestão Financeira</span>
            </Link>
          </div>
        </div>

        {/* Barra de Progresso Físico Geral */}
        <div className="mt-5 pt-5 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-600">Progresso Físico Geral</span>
              <span className="font-bold text-zinc-900">{completion}% concluído</span>
            </div>
            <Progress value={completion} className="h-2.5 bg-zinc-100" />
          </div>
          <div className="flex items-center justify-start sm:justify-end gap-3 text-xs">
            {overdueCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                ⚠️ {overdueCount} {overdueCount === 1 ? "etapa atrasada" : "etapas atrasadas"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                ✓ Cronograma em dia
              </span>
            )}
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          onClick={() => setActiveTab("acervo")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === "acervo"
              ? "bg-zinc-900 text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
          }`}
        >
          📁 Acervo Técnico & Entregáveis
        </button>
        <button
          onClick={() => setActiveTab("documentos")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === "documentos"
              ? "bg-zinc-900 text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
          }`}
        >
          📑 Documentos ({documents.length})
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {activeTab === "acervo" && (
        <ProjectAcervoTab
          projectId={project.id}
          projectName={project.name}
          initialDeliverables={deliverables}
          initialMatrix={deliverableMatrix}
          stages={stages.map((s) => ({
            id: s.id,
            name: s.name,
            discipline: s.discipline as any,
          }))}
        />
      )}

      {activeTab === "documentos" && (
        <Card className="p-6 bg-white border-zinc-200 rounded-2xl">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-zinc-900">Documentos e Arquivos do Projeto</h3>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <p className="text-sm">Nenhum documento anexado a este projeto ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {documents.map((doc) => (
                  <li key={doc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">{doc.name}</p>
                      <p className="text-xs text-zinc-400">{formatDateBR(doc.createdAt)}</p>
                    </div>
                    <Badge tone={doc.visibility === "CLIENT" ? "blue" : "neutral"} className="text-xs">
                      {doc.visibility === "CLIENT" ? "Visível p/ Cliente" : "Interno"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
