"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { DISCIPLINE_LABELS } from "@/lib/sheet-metadata-parser";
import type { ProjectDiscipline, DeliverableType } from "@prisma/client";

export interface ClientDeliverableItem {
  id: string;
  sheetCode: string | null;
  subject: string;
  title: string;
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

export function ClientDeliverablesGallery({
  projectId,
  deliverables,
}: ClientDeliverablesGalleryProps) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("TODAS");
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("TODOS");

  // Visualizadores Fullscreen
  const [activePdf, setActivePdf] = useState<ClientDeliverableItem | null>(null);
  const [activeImage, setActiveImage] = useState<ClientDeliverableItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Ambientes únicos presentes
  const environments = useMemo(() => {
    const set = new Set<string>();
    deliverables.forEach((d) => {
      if (d.environmentName) set.add(d.environmentName);
    });
    return Array.from(set).sort();
  }, [deliverables]);

  // Disciplinas únicas presentes
  const disciplines = useMemo(() => {
    const set = new Set<string>();
    deliverables.forEach((d) => set.add(d.discipline));
    return Array.from(set).sort();
  }, [deliverables]);

  // Lista filtrada
  const filtered = useMemo(() => {
    return deliverables.filter((item) => {
      if (selectedDiscipline !== "TODAS" && item.discipline !== selectedDiscipline) {
        return false;
      }
      if (selectedEnvironment !== "TODOS" && item.environmentName !== selectedEnvironment) {
        return false;
      }
      return true;
    });
  }, [deliverables, selectedDiscipline, selectedEnvironment]);

  const handleOpenItem = (item: ClientDeliverableItem) => {
    const isImage =
      item.type === "RENDER_3D" ||
      item.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i);

    if (isImage) {
      setZoomLevel(1);
      setActiveImage(item);
    } else {
      setActivePdf(item);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Barra de Filtros Horizontais Apple HIG (iOS / macOS pills) */}
      <div className="space-y-3">
        {/* Filtro por Disciplina */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedDiscipline("TODAS")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              selectedDiscipline === "TODAS"
                ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Todas as Disciplinas ({deliverables.length})
          </button>
          {disciplines.map((disc) => {
            const count = deliverables.filter((d) => d.discipline === disc).length;
            const active = selectedDiscipline === disc;
            return (
              <button
                key={disc}
                type="button"
                onClick={() => setSelectedDiscipline(disc)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  active
                    ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {DISCIPLINE_LABELS[disc as ProjectDiscipline] || disc} ({count})
              </button>
            );
          })}
        </div>

        {/* Filtro por Ambiente (se houver ambientes cadastrados) */}
        {environments.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-slate-400 font-medium mr-1 text-[11px] uppercase tracking-wider shrink-0">
              Ambientes:
            </span>
            <button
              type="button"
              onClick={() => setSelectedEnvironment("TODOS")}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                selectedEnvironment === "TODOS"
                  ? "bg-slate-200 font-bold text-slate-900"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Todos
            </button>
            {environments.map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setSelectedEnvironment(env)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  selectedEnvironment === env
                    ? "bg-blue-100 font-bold text-blue-900"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Galeria de Entregáveis */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-3 text-xs font-bold text-slate-700">Nenhuma prancha encontrada neste filtro</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Experimente selecionar &quot;Todas as Disciplinas&quot; para conferir o acervo completo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const isRender =
              item.type === "RENDER_3D" ||
              item.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i);

            // Nome padronizado para download
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
                {/* Visual Header / Thumbnail */}
                {isRender ? (
                  <div
                    onClick={() => handleOpenItem(item)}
                    className="relative aspect-video w-full cursor-pointer bg-slate-900 overflow-hidden group/thumb"
                  >
                    {/* Imagem de Render */}
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
                      <span className="text-[11px] font-medium flex items-center gap-1 opacity-90">
                        🔍 Clique para Zoom
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleOpenItem(item)}
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
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {item.version}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                          {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                        </p>
                        <p className="text-[11px] text-slate-500">Documento Técnico PDF</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conteúdo do Card */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4
                      className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1"
                      title={item.subject}
                    >
                      {item.subject}
                    </h4>
                    <p
                      className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed"
                      title={item.title}
                    >
                      {item.title}
                    </p>

                    {item.environmentName && (
                      <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                        <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Ambiente: {item.environmentName}</span>
                      </div>
                    )}
                  </div>

                  {/* Rodapé de Ações do Cliente */}
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleOpenItem(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 px-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {isRender ? "Ver Render" : "Abrir Prancha"}
                    </button>

                    <a
                      href={downloadUrl}
                      download={downloadFileName}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                      title="Baixar arquivo oficial"
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

      {/* 3. Visualizador em Tela Cheia para Prancha PDF */}
      {activePdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/90">
              <div className="flex items-center gap-3">
                {activePdf.sheetCode && (
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {activePdf.sheetCode}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">{activePdf.subject}</h3>
                  <p className="text-[11px] text-slate-500">
                    Versão {activePdf.version} · {DISCIPLINE_LABELS[activePdf.discipline] || activePdf.discipline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/projects/${projectId}/deliverables/${activePdf.id}/file?download=1`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar PDF
                </a>
                <button
                  type="button"
                  onClick={() => setActivePdf(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                  title="Fechar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative flex-1 bg-slate-900 overflow-hidden">
              <iframe
                src={`/api/projects/${projectId}/deliverables/${activePdf.id}/file`}
                className="h-full w-full border-0 bg-white"
                title={activePdf.subject}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Lightbox com Zoom Suave para Renders 3D */}
      {activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-6xl flex-col items-center justify-center">
            {/* Top Bar com Controles de Zoom */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/80 to-transparent">
              <div className="text-white">
                <h3 className="text-sm font-bold">{activeImage.subject}</h3>
                <p className="text-xs text-slate-300">
                  {activeImage.environmentName ? `${activeImage.environmentName} · ` : ""}Render 3D Corona
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-slate-900/80 border border-slate-700 p-1 text-white">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-xs"
                    title="Diminuir Zoom"
                  >
                    −
                  </button>
                  <span className="px-2 font-mono text-xs font-bold">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-xs"
                    title="Aumentar Zoom"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="px-2 py-1 hover:bg-slate-800 rounded-lg text-[10px] text-slate-400"
                  >
                    Reset
                  </button>
                </div>

                <a
                  href={`/api/projects/${projectId}/deliverables/${activeImage.id}/file?download=1`}
                  download
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
                >
                  Baixar Imagem HD
                </a>

                <button
                  type="button"
                  onClick={() => setActiveImage(null)}
                  className="rounded-xl bg-slate-800/80 p-2 text-white hover:bg-slate-700 transition"
                  title="Fechar Lightbox (ESC)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Imagem Central com Zoom */}
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4 pt-16">
              <img
                src={`/api/projects/${projectId}/deliverables/${activeImage.id}/file`}
                alt={activeImage.subject}
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl transition-transform duration-150 cursor-grab active:cursor-grabbing"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

