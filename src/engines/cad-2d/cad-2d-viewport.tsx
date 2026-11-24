"use client";

import { useRef, useState } from "react";
import { Dxf2dViewer } from "./dxf-2d-viewer";
import type { WorkspaceRfiItem, WorkspaceRevisionItem } from "@/components/acervo/cde-workspace-viewer";

interface Cad2dViewportProps {
  revision: WorkspaceRevisionItem;
  previousRevision?: WorkspaceRevisionItem | null;
  rfis: WorkspaceRfiItem[];
  selectedRfiId?: string | null;
  onSelectRfi: (rfi: WorkspaceRfiItem) => void;
  activeTool: "PAN" | "PIN" | "CLOUD" | "DIMENSION";
  zoom: number;
  rotation: number;
  pageNumber: number;
  isDiffActive: boolean;
  diffOpacity: number;
  onCreate2dMarkup: (payload: {
    markupType: "PIN" | "CLOUD" | "DIMENSION";
    coordX: number;
    coordY: number;
    pageNumber: number;
    geometryJson?: string;
  }) => void;
}

export function Cad2dViewport({
  revision,
  previousRevision,
  rfis,
  selectedRfiId,
  onSelectRfi,
  activeTool,
  zoom,
  rotation,
  pageNumber,
  isDiffActive,
  diffOpacity,
  onCreate2dMarkup,
}: Cad2dViewportProps) {
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempDimensions, setTempDimensions] = useState<
    Array<{ x1: number; y1: number; x2: number; y2: number; distMeters: string }>
  >([]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const hasDxf =
    revision.fileType === "DXF" ||
    revision.viewFileType === "DXF" ||
    revision.fileName.toLowerCase().endsWith(".dxf") ||
    Boolean(revision.viewFileName?.toLowerCase().endsWith(".dxf"));

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
  }

  if (hasDxf) {
    return <Dxf2dViewer fileUrl={displayUrl} fileName={revision.viewFileName || revision.fileName} />;
  }

  return (
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
              <span>
                PÁG {pageNumber} · REVISÃO {revision.revisionNumber}
              </span>
            </div>
            <svg viewBox="0 0 600 340" className="w-full h-full">
              <rect
                x="40"
                y="30"
                width="520"
                height="270"
                fill="none"
                stroke={isDiffActive ? "#059669" : "#18181B"}
                strokeWidth="3"
              />
              <line
                x1="260"
                y1="30"
                x2="260"
                y2="200"
                stroke={isDiffActive ? "#059669" : "#18181B"}
                strokeWidth="2.5"
              />
              <line
                x1="40"
                y1="200"
                x2="560"
                y2="200"
                stroke={isDiffActive ? "#059669" : "#18181B"}
                strokeWidth="2.5"
              />
              <rect x="100" y="26" width="90" height="8" fill="#0284C7" opacity="0.6" />
              <rect x="340" y="26" width="140" height="8" fill="#0284C7" opacity="0.6" />
              <text x="120" y="120" fontSize="12" fill="#475569" fontFamily="monospace">
                SALA ESTAR · 42.5 m²
              </text>
              <text x="360" y="120" fontSize="12" fill="#475569" fontFamily="monospace">
                SUÍTE MASTER · 31.8 m²
              </text>
              <text x="240" y="255" fontSize="12" fill="#475569" fontFamily="monospace">
                VARANDA GOURMET · 28.0 m²
              </text>
            </svg>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] font-mono text-slate-400">
              <span>CARIMBO ArqVértice OS CDE</span>
              <span>ESCALA 1:50</span>
            </div>
          </div>
        )}

        {isDiffActive && previousRevision && (
          <div className="pointer-events-none absolute inset-0" style={{ opacity: diffOpacity / 100 }}>
            {prevDisplayUrl && !prevDisplayUrl.includes("storage.arqvertice.com.br") ? (
              <iframe
                src={`${prevDisplayUrl}#page=${pageNumber}&toolbar=0`}
                title={previousRevision.fileName}
                className="h-full w-full border-0 mix-blend-multiply"
                style={{ filter: "sepia(1) hue-rotate(-50deg) saturate(4)" }}
              />
            ) : (
              <svg viewBox="0 0 600 340" className="w-full h-full">
                <rect
                  x="40"
                  y="30"
                  width="520"
                  height="270"
                  fill="none"
                  stroke="#E11D48"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                />
                <line x1="245" y1="30" x2="245" y2="200" stroke="#E11D48" strokeWidth="2.5" />
                <line x1="40" y1="185" x2="560" y2="185" stroke="#E11D48" strokeWidth="2.5" />
                <text x="255" y="175" fontSize="10" fill="#E11D48" fontFamily="monospace">
                  ALTERAÇÃO {previousRevision.revisionNumber} ➔ {revision.revisionNumber}
                </text>
              </svg>
            )}
          </div>
        )}

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
  );
}
