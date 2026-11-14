"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDateBR } from "@/lib/formatters";

export interface ProjectCardData {
  id: string;
  name: string;
  type?: string | null;
  status: string;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  client: {
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  stages?: Array<{
    id: string;
    completion: number;
    status: string;
    dueDate?: Date | null;
  }>;
  team?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

interface ProjectsExecutiveGridProps {
  projects: ProjectCardData[];
  basePath: "/admin" | "/equipe";
}

const STATUS_CONFIG: Record<string, { label: string; tone: "green" | "blue" | "amber" | "neutral" }> = {
  IN_PROGRESS: { label: "Em Andamento", tone: "blue" },
  PLANNING: { label: "Planejamento", tone: "amber" },
  COMPLETED: { label: "Concluído", tone: "green" },
  PAUSED: { label: "Pausado", tone: "neutral" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};

export function ProjectsExecutiveGrid({ projects, basePath }: ProjectsExecutiveGridProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const statusMeta = STATUS_CONFIG[project.status] || { label: project.status, tone: "neutral" };
        const stageList = project.stages || [];
        const completion =
          stageList.length > 0
            ? Math.round(stageList.reduce((acc, s) => acc + (s.completion || 0), 0) / stageList.length)
            : 0;

        const teamMembers = project.team || [];
        const kanbanHref =
          basePath === "/equipe"
            ? `/equipe/cronograma/${project.id}`
            : `/admin/projetos/${project.id}/cronograma`;

        return (
          <Card
            key={project.id}
            className="flex flex-col justify-between border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="space-y-3.5">
              {/* Topo do Card */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Link
                    href={`${basePath}/projetos/${project.id}`}
                    className="font-bold text-base text-slate-900 hover:text-blue-600 transition-colors line-clamp-1"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs font-medium text-slate-500">{project.type || "Residencial de Alto Padrão"}</p>
                </div>
                <Badge tone={statusMeta.tone} className="text-[11px] font-semibold">
                  {statusMeta.label}
                </Badge>
              </div>

              {/* Informações do Cliente */}
              <div className="rounded-xl bg-slate-50/80 p-2.5 text-xs text-slate-600 space-y-1 border border-slate-100">
                <p className="font-semibold text-slate-800">
                  <span className="text-slate-400 font-normal">Cliente:</span> {project.client.name}
                </p>
                {(project.client.phone || project.client.email) && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    {project.client.phone || project.client.email}
                  </p>
                )}
              </div>

              {/* Prazos */}
              {(project.startDate || project.expectedEndDate) && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>
                    Início: {project.startDate ? formatDateBR(project.startDate) : "—"}
                  </span>
                  <span>
                    Previsão: {project.expectedEndDate ? formatDateBR(project.expectedEndDate) : "—"}
                  </span>
                </div>
              )}

              {/* Avanço Físico % */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Avanço Físico</span>
                  <span className="text-slate-900 font-bold">{completion}%</span>
                </div>
                <Progress value={completion} className="h-2" />
                <p className="text-[11px] text-slate-400">
                  {stageList.length} {stageList.length === 1 ? "etapa no cronograma" : "etapas no cronograma"}
                </p>
              </div>

              {/* Equipe Alocada */}
              {teamMembers.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Equipe Técnica Alocada
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teamMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                      >
                        {m.name} ({m.role})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ações e Links Diretos */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`${basePath}/projetos/${project.id}`}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition"
                >
                  Ficha Técnica →
                </Link>
                <Link
                  href={kanbanHref}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition"
                >
                  Abrir Kanban 📊
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <Link
                  href={`${basePath}/financeiro?projectId=${project.id}`}
                  className="inline-flex items-center justify-center rounded-lg py-1 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                >
                  💰 Pagamentos
                </Link>
                <Link
                  href={`${basePath}/acervo?projectId=${project.id}`}
                  className="inline-flex items-center justify-center rounded-lg py-1 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition"
                >
                  📁 Acervo Técnico
                </Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
