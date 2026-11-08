"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { DeliverableCardItem } from "./deliverable-card";

export interface DeliverablePreviewModalProps {
  deliverable: DeliverableCardItem | null;
  projectId: string;
  onClose: () => void;
}

export function DeliverablePreviewModal({
  deliverable,
  projectId,
  onClose,
}: DeliverablePreviewModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setZoomLevel(1);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deliverable, onClose]);

  if (!deliverable) return null;

  const isPdf = deliverable.fileUrl?.toLowerCase().includes(".pdf");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col h-[94vh] sm:h-[90vh] w-full max-w-6xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-zinc-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal Fullscreen */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 px-4 sm:px-6 py-3.5 bg-zinc-50/90 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {deliverable.sheetCode && (
              <span className="shrink-0 rounded-lg bg-zinc-900 px-2 py-0.5 font-mono text-xs font-bold text-white shadow-2xs">
                {deliverable.sheetCode}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-900 text-sm leading-tight truncate">
                {deliverable.title}
                {deliverable.subtitle && (
                  <span className="font-normal text-zinc-500"> — {deliverable.subtitle}</span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {deliverable.phaseFolder || "Projeto Executivo"} · 🏷️ {deliverable.subject} · Versão {deliverable.version}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {!isPdf && (
              <div className="hidden sm:flex items-center gap-1 border border-zinc-200 rounded-xl px-2 py-1 bg-white shadow-2xs text-xs font-semibold text-zinc-600">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="px-1.5 hover:text-zinc-900 transition"
                  title="Diminuir zoom"
                >
                  −
                </button>
                <span className="w-12 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="px-1.5 hover:text-zinc-900 transition"
                  title="Aumentar zoom"
                >
                  +
                </button>
              </div>
            )}

            <a
              href={`/api/projects/${projectId}/deliverables/${deliverable.id}/file?download=1`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-95"
            >
              <span>⬇️</span> Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-700 transition"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conteúdo do Visualizador */}
        <div className="flex-1 bg-zinc-100 flex items-center justify-center p-2 sm:p-4 overflow-auto">
          {isPdf ? (
            <iframe
              src={deliverable.fileUrl}
              className="h-full w-full rounded-2xl border border-zinc-300 bg-white shadow-inner"
              title={deliverable.title}
            />
          ) : (
            <div
              className="flex items-center justify-center transition-transform duration-200 ease-out"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={deliverable.fileUrl}
                alt={deliverable.title}
                className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-md"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

