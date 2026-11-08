"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { DISCIPLINE_LABELS } from "@/lib/sheet-metadata-parser";
import type {
  ProjectDiscipline,
  DeliverableType,
  ProjectStagePhase,
  AcervoCategory,
} from "@prisma/client";

export interface ClientDeliverableItem {
  id: string;
  sheetCode: string | null;
  subject: string;
  title: string;
  subtitle?: string | null;
  phaseFolder?: ProjectStagePhase;
  category?: AcervoCategory;
  discipline: ProjectDiscipline;
  type: DeliverableType;
  version: string;
  fileUrl: string;
  fileSize?: string | null;
  environmentName?: string | null;
  updatedAt: Date | string;
}

interface ClientDeliverablesGalleryProps {
  projectId: string;
  deliverables: ClientDeliverableItem[];
}

const PHASE_SECTIONS = [
  { key: "PROJETO_PRELIMINAR", label: "Projeto Preliminar", icon: "📐" },
  { key: "PROJETO_LEGAL", label: "Projeto Legal", icon: "🏛️" },
  { key: "PROJETO_EXECUTIVO", label: "Projeto Executivo", icon: "🏗️" },
] as const;

export function ClientDeliverablesGallery({
  projectId,
  deliverables,
}: ClientDeliverablesGalleryProps) {
  const [selectedPhase, setSelectedPhase] = useState<string>("TODAS");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("TODAS");

  // Visualizadores Fullscreen
  const [activeItem, setActiveItem] = useState<ClientDeliverableItem | null>(null);

  // Disciplinas únicas presentes
  const disciplines = useMemo(() => {
    const set = new Set<string>();
    deliverables.forEach((d) => set.add(d.discipline));
    return Array.from(set).sort();
  }, [deliverables]);

  // Lista filtrada
  const filtered = useMemo(() => {
    return deliverables.filter((item) => {
      if (selectedPhase !== "TODAS" && item.phaseFolder !== selectedPhase) {
        return false;
      }
      if (selectedDiscipline !== "TODAS" && item.discipline !== selectedDiscipline) {
        return false;
      }
      return true;
    });
  }, [deliverables, selectedPhase, selectedDiscipline]);

  return (
    <div className="space-y-6 font-sans">
      {/* Filtros em Pílulas Apple HIG */}
      <div className="space-y-3">
        {/* Filtro por Subpasta de Fase */}
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
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
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

      {/* Grid de Cards dos Entregáveis */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-xs font-bold text-slate-700">Nenhum documento disponível nesta seleção</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Selecione &quot;Todas as Fases&quot; para consultar o acervo completo liberado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const isRender =
              item.category === "IMAGEM_RENDER" ||
              item.type === "RENDER_3D" ||
              item.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i);

            const cleanCode = item.sheetCode ? item.sheetCode.replace(/[\/\\]/g, "-") : "DOC";
            const cleanSubject = item.subject.replace(/[\s\/\\]+/g, "_");
            const downloadFileName = `${cleanCode}_${cleanSubject}_${item.version}.${isRender ? "jpg" : "pdf"}`;
            const fileStreamUrl = `/api/projects/${projectId}/deliverables/${item.id}/file`;
            const downloadUrl = `${fileStreamUrl}?download=1&filename=${encodeURIComponent(downloadFileName)}`;

            return (
              <div
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden"
              >
                {/* Visual Header / Miniatura */}
                {isRender ? (
                  <div
                    onClick={() => setActiveItem(item)}
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
                        🔍 Clique para Visualizar
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setActiveItem(item)}
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

                {/* Conteúdo do Card com Título e Subtítulo */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4
                      className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug"
                      title={item.title}
                    >
                      {item.title}
                    </h4>
                    {item.subtitle ? (
                      <p className="text-xs text-slate-600 italic line-clamp-1" title={item.subtitle}>
                        — {item.subtitle}
                      </p>
                    ) : null}

                    <div className="pt-1.5 flex items-center gap-1.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        🏷️ {item.subject}
                      </span>
                    </div>
                  </div>

                  {/* Ações Diretas: Visualizar & Download (alimentam o Log) */}
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveItem(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 px-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {isRender ? "Ver Render" : "Pré-visualizar"}
                    </button>

                    <a
                      href={downloadUrl}
                      download={downloadFileName}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                      title="Baixar PDF Oficial"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Visualizador em Tela Cheia para o Cliente */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/90">
              <div className="flex items-center gap-3">
                {activeItem.sheetCode && (
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {activeItem.sheetCode}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">{activeItem.title}</h3>
                  <p className="text-[11px] text-slate-500">
                    {activeItem.subtitle ? `${activeItem.subtitle} · ` : ""}
                    Revisão {activeItem.version} · {DISCIPLINE_LABELS[activeItem.discipline] || activeItem.discipline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/projects/${projectId}/deliverables/${activeItem.id}/file?download=1`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar PDF
                </a>
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
              <iframe
                src={`/api/projects/${projectId}/deliverables/${activeItem.id}/file`}
                className="h-full w-full border-0 bg-white"
                title={activeItem.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
