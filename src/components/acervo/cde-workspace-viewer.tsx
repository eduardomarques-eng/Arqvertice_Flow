"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ExtractedIfcTakeoff, Ifc3dRfiPin, RenderMode } from "@/components/acervo/viewer-3d-engine";
import { is3dAcervoFormat } from "@/lib/acervo/file-types";

const Dxf2dViewer = dynamic(
  () => import("@/components/acervo/dxf-2d-viewer").then((m) => m.Dxf2dViewer),
  {
    ssr: false,
    loading: () => <div className="h-[520px] w-full animate-pulse rounded-xl bg-slate-200/50" />,
  }
);

const Viewer3dEngine = dynamic(
  () => import("@/components/acervo/viewer-3d-engine").then((m) => m.Viewer3dEngine),
  {
    ssr: false,
    loading: () => <div className="h-[520px] w-full animate-pulse rounded-xl bg-slate-200/50" />,
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
    renderMode?: RenderMode;
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
  onCreate3dRfi,
  onExtractedIfcQuantities,
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
  onCreate3dRfi: (cameraState: {
    position: [number, number, number];
    target: [number, number, number];
    pinPosition: [number, number, number];
    renderMode?: RenderMode;
    sectionPlanes?: { open: boolean; x: number; y: number; z: number };
  }) => void;
  onExtractedIfcQuantities?: (items: ExtractedIfcTakeoff[]) => void;
}) {
  const isPrimary3d = is3dAcervoFormat(revision.fileType, revision.fileName);
  const isView3d = is3dAcervoFormat(revision.viewFileType, revision.viewFileName);
  const has3d = isPrimary3d || isView3d;

  const active3dUrl = isView3d ? revision.viewUrl : isPrimary3d ? revision.fileUrl : revision.viewUrl || revision.fileUrl;
  const active3dFileType = isView3d ? revision.viewFileType : isPrimary3d ? revision.fileType : revision.viewFileType || revision.fileType;
  const active3dFileName = isView3d ? revision.viewFileName : isPrimary3d ? revision.fileName : revision.viewFileName || revision.fileName;

  const hasDxf =
    revision.fileType === "DXF" ||
    revision.viewFileType === "DXF" ||
    revision.fileName.toLowerCase().endsWith(".dxf") ||
    Boolean(revision.viewFileName?.toLowerCase().endsWith(".dxf"));

  const [viewMode, setViewMode] = useState<"2D" | "3D">(has3d ? "3D" : "2D");

  // Auto-switch to 3D when selecting a 3D RFI from the lateral panel
  useEffect(() => {
    if (!selectedRfiId) return;
    const sel = rfis.find((r) => r.id === selectedRfiId);
    if (sel?.cameraState && viewMode !== "3D") {
      setViewMode("3D");
    }
  }, [selectedRfiId, rfis, viewMode]);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Visual Diff R00 vs R01
  const [isDiffActive, setIsDiffActive] = useState(false);
  const [diffOpacity, setDiffOpacity] = useState(50);

  // 2-click tools (CLOUD / DIMENSION)
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempDimensions, setTempDimensions] = useState<Array<{ x1: number; y1: number; x2: number; y2: number; distMeters: string }>>([]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const displayUrl = revision.viewUrl || revision.fileUrl;
  const prevDisplayUrl = previousRevision?.viewUrl || previousRevision?.fileUrl || "";
  const isPdfOrImage =
    !hasDxf &&
    (displayUrl.toLowerCase().includes(".pdf") ||
      displayUrl.toLowerCase().includes(".png") ||
      displayUrl.toLowerCase().includes(".jpg") ||
      displayUrl.toLowerCase().includes(".svg") ||
      revision.fileType === "PDF" ||
      revision.fileType === "IMG" ||
      revision.viewFileType === "PDF");

  const isPlaceholderUrl = displayUrl.includes("storage.arqvertice.com.br");

  function getRelativePercent(e: React.MouseEvent<HTMLDivElement>) {
    if (!canvasRef.current) return { x: 50, y: 50 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool === "PAN") return;
    const pt = getRelativePercent(e);

    if (activeTool === "PIN") {
      onCreate2dMarkup({
        markupType: "PIN",
        coordX: pt.x,
        coordY: pt.y,
        pageNumber,
      });
      return;
    }

    if (activeTool === "CLOUD") {
      if (!pendingPoint) {
        setPendingPoint(pt);
      } else {
        const x = Math.min(pendingPoint.x, pt.x);
        const y = Math.min(pendingPoint.y, pt.y);
        const w = Math.max(4, Math.abs(pt.x - pendingPoint.x));
        const h = Math.max(4, Math.abs(pt.y - pendingPoint.y));
        onCreate2dMarkup({
          markupType: "CLOUD",
          coordX: x + w / 2,
          coordY: y + h / 2,
          pageNumber,
          geometryJson: JSON.stringify({ x, y, w, h }),
        });
        setPendingPoint(null);
      }
      return;
    }

    if (activeTool === "DIMENSION") {
      if (!pendingPoint) {
        setPendingPoint(pt);
      } else {
        // Calibração visual aproximada (100% largura ~ 20.00m em escala 1:50)
        const dx = ((pt.x - pendingPoint.x) / 100) * 20;
        const dy = ((pt.y - pendingPoint.y) / 100) * 14;
        const dist = Math.sqrt(dx * dx + dy * dy).toFixed(2);
        setTempDimensions((prev) => [
          ...prev,
          { x1: pendingPoint.x, y1: pendingPoint.y, x2: pt.x, y2: pt.y, distMeters: `${dist} m` },
        ]);
        onCreate2dMarkup({
          markupType: "DIMENSION",
          coordX: (pendingPoint.x + pt.x) / 2,
          coordY: (pendingPoint.y + pt.y) / 2,
          pageNumber,
          geometryJson: JSON.stringify({
            x1: pendingPoint.x,
            y1: pendingPoint.y,
            x2: pt.x,
            y2: pt.y,
            distance: `${dist} m`,
          }),
        });
        setPendingPoint(null);
      }
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool !== "PAN") return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging || !dragStartRef.current) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
    dragStartRef.current = null;
  }

  const rfis3d: Ifc3dRfiPin[] = rfis.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status,
    cameraState: r.cameraState,
  }));

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Barra Flutuante Estilo macOS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 bg-[#F5F5F7]/90 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Seletor 2D / 3D BIM */}
          <div className="flex items-center rounded-xl bg-slate-200/70 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("2D")}
              className={`rounded-lg px-2.5 py-1 transition ${
                viewMode === "2D" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2D {hasDxf ? "(CAD DXF)" : "(Prancha)"}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3D")}
              className={`rounded-lg px-2.5 py-1 transition ${
                viewMode === "3D" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              3D {has3d ? `(${active3dFileType || "BIM"})` : "(Modelo)"}
            </button>
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
                  setPendingPoint(null);
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
        {viewMode === "2D" && (
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
                  setPanOffset({ x: 0, y: 0 });
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
        )}
      </div>

      {/* Controle Deslizante do Visual Diff */}
      {viewMode === "2D" && isDiffActive && previousRevision && (
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
        {viewMode === "3D" ? (
          <Viewer3dEngine
            modelUrl={active3dUrl}
            fileType={active3dFileType}
            fileName={active3dFileName}
            rfis3d={rfis3d}
            focusedRfiId={selectedRfiId}
            isPlacing3dPin={activeTool === "PIN"}
            onPlace3dPin={onCreate3dRfi}
            onSelectRfi={(rfiId) => {
              const found = rfis.find((r) => r.id === rfiId);
              if (found) onSelectRfi(found);
            }}
            onExtractedQuantities={onExtractedIfcQuantities}
          />
        ) : hasDxf ? (
          <Dxf2dViewer fileUrl={displayUrl} fileName={revision.viewFileName || revision.fileName} />
        ) : (
          <div
            className="flex h-[540px] w-full items-center justify-center overflow-hidden p-4 select-none"
            style={{
              cursor: activeTool === "PAN" ? (isDragging ? "grabbing" : "grab") : "crosshair",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="relative w-full max-w-[780px] h-[480px] rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden transition-transform duration-100 ease-out"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              {/* Renderização Principal (PDF Real ou Planta Vetorial Técnica) */}
              {isPdfOrImage && !isPlaceholderUrl ? (
                <iframe
                  src={`${displayUrl}#page=${pageNumber}&toolbar=0`}
                  title={revision.fileName}
                  className="h-full w-full border-0 pointer-events-none"
                />
              ) : (
                <div className="flex h-full w-full flex-col justify-between p-6 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] font-mono text-slate-500">
                    <span>PRANCHA TÉCNICA · {revision.fileName}</span>
                    <span>PÁG {pageNumber} · REVISÃO {revision.revisionNumber}</span>
                  </div>
                  {/* Desenho Arquitetônico Vetorial Limpo */}
                  <svg viewBox="0 0 600 340" className="w-full h-full">
                    <rect x="40" y="30" width="520" height="270" fill="none" stroke={isDiffActive ? "#059669" : "#18181B"} strokeWidth="3" />
                    <line x1="260" y1="30" x2="260" y2="200" stroke={isDiffActive ? "#059669" : "#18181B"} strokeWidth="2.5" />
                    <line x1="40" y1="200" x2="560" y2="200" stroke={isDiffActive ? "#059669" : "#18181B"} strokeWidth="2.5" />
                    <rect x="100" y="26" width="90" height="8" fill="#0284C7" opacity="0.6" />
                    <rect x="340" y="26" width="140" height="8" fill="#0284C7" opacity="0.6" />
                    <text x="120" y="120" fontSize="12" fill="#475569" fontFamily="monospace">SALA ESTAR · 42.5 m²</text>
                    <text x="360" y="120" fontSize="12" fill="#475569" fontFamily="monospace">SUÍTE MASTER · 31.8 m²</text>
                    <text x="240" y="255" fontSize="12" fill="#475569" fontFamily="monospace">VARANDA GOURMET · 28.0 m²</text>
                  </svg>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] font-mono text-slate-400">
                    <span>CARIMBO ARQVÉRTICE FLOW CDE</span>
                    <span>ESCALA 1:50</span>
                  </div>
                </div>
              )}

              {/* Sobreposição Visual Diff (Revisão Anterior Tingida em Vermelho) */}
              {isDiffActive && previousRevision && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ opacity: diffOpacity / 100 }}
                >
                  {prevDisplayUrl && !prevDisplayUrl.includes("storage.arqvertice.com.br") ? (
                    <iframe
                      src={`${prevDisplayUrl}#page=${pageNumber}&toolbar=0`}
                      title={previousRevision.fileName}
                      className="h-full w-full border-0 mix-blend-multiply"
                      style={{ filter: "sepia(1) hue-rotate(-50deg) saturate(4)" }}
                    />
                  ) : (
                    <svg viewBox="0 0 600 340" className="w-full h-full">
                      <rect x="40" y="30" width="520" height="270" fill="none" stroke="#E11D48" strokeWidth="2.5" strokeDasharray="6 4" />
                      <line x1="245" y1="30" x2="245" y2="200" stroke="#E11D48" strokeWidth="2.5" />
                      <line x1="40" y1="185" x2="560" y2="185" stroke="#E11D48" strokeWidth="2.5" />
                      <text x="255" y="175" fontSize="10" fill="#E11D48" fontFamily="monospace">
                        ALTERAÇÃO {previousRevision.revisionNumber} ➔ {revision.revisionNumber}
                      </text>
                    </svg>
                  )}
                </div>
              )}

              {/* Camada SVG de Markups (Nuvens, Cotas) e Pinos 2D */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {rfis.map((rfi) => {
                  if (rfi.markupType === "CLOUD" && rfi.geometryJson) {
                    try {
                      const g = JSON.parse(rfi.geometryJson) as { x: number; y: number; w: number; h: number };
                      return (
                        <rect
                          key={`cloud-${rfi.id}`}
                          x={g.x}
                          y={g.y}
                          width={g.w}
                          height={g.h}
                          fill="rgba(225, 29, 72, 0.08)"
                          stroke="#E11D48"
                          strokeWidth="0.6"
                          strokeDasharray="1.5 1"
                          rx="1.5"
                        />
                      );
                    } catch {
                      return null;
                    }
                  }
                  if (rfi.markupType === "DIMENSION" && rfi.geometryJson) {
                    try {
                      const g = JSON.parse(rfi.geometryJson) as { x1: number; y1: number; x2: number; y2: number };
                      return (
                        <line
                          key={`dim-${rfi.id}`}
                          x1={g.x1}
                          y1={g.y1}
                          x2={g.x2}
                          y2={g.y2}
                          stroke="#0284C7"
                          strokeWidth="0.6"
                        />
                      );
                    } catch {
                      return null;
                    }
                  }
                  return null;
                })}
                {tempDimensions.map((d, idx) => (
                  <line
                    key={`tdim-${idx}`}
                    x1={d.x1}
                    y1={d.y1}
                    x2={d.x2}
                    y2={d.y2}
                    stroke="#0284C7"
                    strokeWidth="0.6"
                    strokeDasharray="1 1"
                  />
                ))}
              </svg>

              {/* Pinos Clicáveis */}
              <div className="pointer-events-none absolute inset-0">
                {rfis.map((rfi) => {
                  if (rfi.coordX == null || rfi.coordY == null) return null;
                  const isSel = selectedRfiId === rfi.id;
                  return (
                    <button
                      key={rfi.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRfi(rfi);
                      }}
                      style={{ left: `${rfi.coordX}%`, top: `${rfi.coordY}%` }}
                      className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono font-bold shadow-md transition ${
                        isSel
                          ? "bg-rose-600 text-white scale-125 ring-4 ring-rose-300/60 z-20"
                          : rfi.status === "ENCERRADA"
                          ? "bg-emerald-600 text-white"
                          : "bg-[#18181B] text-white hover:scale-110"
                      }`}
                      title={`${rfi.code}: ${rfi.title}`}
                    >
                      {rfi.code.replace("RFI-", "")}
                    </button>
                  );
                })}

                {pendingPoint && (
                  <div
                    style={{ left: `${pendingPoint.x}%`, top: `${pendingPoint.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-rose-600 ring-4 ring-rose-300/60"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
