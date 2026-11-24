"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const Cad2dViewport = dynamic(
  () => import("@/engines/cad-2d/cad-2d-viewport").then((m) => m.Cad2dViewport),
  {
    ssr: false,
    loading: () => <div className="h-[540px] w-full animate-pulse rounded-xl bg-slate-200/50" />,
  }
);

export interface WorkspaceRfiItem {
  id: string;
  code: string;
  title: string;
  description: string;
  status: "ABERTA" | "RESPONDIDA" | "ENCERRADA";
  markupType: "PIN" | "CLOUD" | "DIMENSION";
  coordX?: number | null;
  coordY?: number | null;
  pageNumber?: number | null;
  geometryJson?: string | null;
  cameraState?: {
    position: [number, number, number];
    target: [number, number, number];
    pinPosition?: [number, number, number];
    renderMode?: string;
    sectionPlanes?: { open: boolean; x: number; y: number; z: number };
  } | null;
  answer?: string | null;
  createdAt: string | Date;
  createdBy?: { name: string; role: string } | null;
}

export interface WorkspaceRevisionItem {
  id: string;
  revisionNumber: string;
  status: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  viewUrl?: string | null;
  viewFileName?: string | null;
  viewFileType?: string | null;
}

export function CdeWorkspaceViewer({
  revision,
  previousRevision,
  rfis,
  selectedRfiId,
  onSelectRfi,
  activeTool,
  onChangeTool,
  onCreate2dMarkup,
}: {
  revision: WorkspaceRevisionItem;
  previousRevision?: WorkspaceRevisionItem | null;
  rfis: WorkspaceRfiItem[];
  selectedRfiId?: string | null;
  onSelectRfi: (rfi: WorkspaceRfiItem) => void;
  activeTool: "PAN" | "PIN" | "CLOUD" | "DIMENSION";
  onChangeTool: (tool: "PAN" | "PIN" | "CLOUD" | "DIMENSION") => void;
  onCreate2dMarkup: (payload: {
    markupType: "PIN" | "CLOUD" | "DIMENSION";
    coordX: number;
    coordY: number;
    pageNumber: number;
    geometryJson?: string;
  }) => void;
}) {
  const hasDxf =
    revision.fileType === "DXF" ||
    revision.viewFileType === "DXF" ||
    revision.fileName.toLowerCase().endsWith(".dxf") ||
    Boolean(revision.viewFileName?.toLowerCase().endsWith(".dxf"));

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  // Visual Diff R00 vs R01
  const [isDiffActive, setIsDiffActive] = useState(false);
  const [diffOpacity, setDiffOpacity] = useState(50);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Barra Flutuante Estilo macOS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 bg-[#F5F5F7]/90 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-xl bg-slate-200/70 px-2.5 py-1 text-xs font-medium text-slate-900">
            Prancha 2D {hasDxf ? "(DXF)" : ""}
          </div>

          {/* Ferramentas de Markup */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-0.5 text-[11px] font-medium">
            {(
              [
                { key: "PAN", label: "✋ Mover" },
                { key: "PIN", label: "📍 Pino RFI" },
                { key: "CLOUD", label: "☁️ Nuvem" },
                { key: "DIMENSION", label: "📏 Cota" },
              ] as const
            ).map((tool) => (
              <button
                key={tool.key}
                type="button"
                onClick={() => {
                  onChangeTool(tool.key);
                }}
                className={`rounded-lg px-2 py-1 transition ${
                  activeTool === tool.key
                    ? "bg-[#18181B] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controles 2D: Zoom, Rotação, Páginas e Visual Diff */}
          <div className="flex flex-wrap items-center gap-2">
            {previousRevision && (
              <button
                type="button"
                onClick={() => setIsDiffActive(!isDiffActive)}
                className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
                  isDiffActive
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isDiffActive
                  ? `Diff Ativo (${previousRevision.revisionNumber} vs ${revision.revisionNumber})`
                  : `Comparar (${previousRevision.revisionNumber})`}
              </button>
            )}

            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="px-2 py-0.5 hover:bg-slate-100 rounded-lg"
                title="Diminuir Zoom"
              >
                -
              </button>
              <span className="px-1.5 font-mono text-[10px] text-slate-700">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="px-2 py-0.5 hover:bg-slate-100 rounded-lg"
                title="Aumentar Zoom"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                className="px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 rounded-lg"
                title="Ajustar à Tela"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 rounded-lg"
                title="Rotacionar 90°"
              >
                ↻
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
              <button
                type="button"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                className="hover:text-slate-900"
              >
                ‹
              </button>
              <span className="font-mono">Pág {pageNumber}</span>
              <button
                type="button"
                onClick={() => setPageNumber((p) => p + 1)}
                className="hover:text-slate-900"
              >
                ›
              </button>
            </div>
          </div>
      </div>

      {/* Controle Deslizante do Visual Diff */}
      {isDiffActive && previousRevision && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200/70 bg-rose-50/60 px-4 py-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-rose-800">
              Visual Diff: <span className="text-rose-600">{previousRevision.revisionNumber} (Vermelho)</span> vs{" "}
              <span className="text-emerald-700">{revision.revisionNumber} (Azul/Verde)</span>
            </span>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
            Opacidade Sobreposição ({diffOpacity}%):
            <input
              type="range"
              min={0}
              max={100}
              value={diffOpacity}
              onChange={(e) => setDiffOpacity(parseInt(e.target.value, 10))}
              className="w-32 accent-rose-600"
            />
          </label>
        </div>
      )}

      {/* Área Principal do Visualizador */}
      <div className="relative min-h-[520px] w-full overflow-hidden bg-[#F5F5F7]">
        <Cad2dViewport
          revision={revision}
          previousRevision={previousRevision}
          rfis={rfis}
          selectedRfiId={selectedRfiId}
          onSelectRfi={onSelectRfi}
          activeTool={activeTool}
          zoom={zoom}
          rotation={rotation}
          pageNumber={pageNumber}
          isDiffActive={isDiffActive}
          diffOpacity={diffOpacity}
          onCreate2dMarkup={onCreate2dMarkup}
        />
      </div>
    </div>
  );
}
