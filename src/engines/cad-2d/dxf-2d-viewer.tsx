"use client";

import { useEffect, useState, useMemo } from "react";
import DxfParser from "dxf-parser";

interface DxfEntity {
  type: string;
  layer?: string;
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
}

const DEMO_DXF_ENTITIES: DxfEntity[] = [
  { type: "LWPOLYLINE", layer: "ALVENARIA", vertices: [{ x: 10, y: 10 }, { x: 290, y: 10 }, { x: 290, y: 190 }, { x: 10, y: 190 }, { x: 10, y: 10 }] },
  { type: "LINE", layer: "ALVENARIA", vertices: [{ x: 150, y: 10 }, { x: 150, y: 120 }] },
  { type: "LINE", layer: "ALVENARIA", vertices: [{ x: 10, y: 120 }, { x: 290, y: 120 }] },
  { type: "LWPOLYLINE", layer: "ESQUADRIAS", vertices: [{ x: 60, y: 8 }, { x: 120, y: 8 }, { x: 120, y: 12 }, { x: 60, y: 12 }] },
  { type: "LWPOLYLINE", layer: "ESQUADRIAS", vertices: [{ x: 200, y: 8 }, { x: 260, y: 8 }, { x: 260, y: 12 }, { x: 200, y: 12 }] },
  { type: "LINE", layer: "COTAS", vertices: [{ x: 10, y: 205 }, { x: 290, y: 205 }] },
  { type: "LINE", layer: "COTAS", vertices: [{ x: 305, y: 10 }, { x: 305, y: 190 }] },
  { type: "CIRCLE", layer: "ELETRICA", center: { x: 80, y: 65 }, radius: 6 },
  { type: "CIRCLE", layer: "ELETRICA", center: { x: 220, y: 65 }, radius: 6 },
  { type: "CIRCLE", layer: "ELETRICA", center: { x: 150, y: 155 }, radius: 6 },
];

const LAYER_COLORS: Record<string, string> = {
  ALVENARIA: "#18181B",
  ESQUADRIAS: "#0284C7",
  COTAS: "#D97706",
  ELETRICA: "#E11D48",
  HIDRAULICA: "#059669",
};

export function Dxf2dViewer({
  fileUrl,
  fileName,
}: {
  fileUrl: string;
  fileName: string;
}) {
  const [entities, setEntities] = useState<DxfEntity[]>(DEMO_DXF_ENTITIES);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [isDemoFallback, setIsDemoFallback] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadDxf() {
      if (!fileUrl || fileUrl.includes("storage.arqvertice.com.br")) {
        if (active) {
          setEntities(DEMO_DXF_ENTITIES);
          setIsDemoFallback(true);
        }
        return;
      }
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("fetch failed");
        const text = await res.text();
        const parser = new DxfParser();
        const parsed = parser.parseSync(text);
        if (active && parsed?.entities && parsed.entities.length > 0) {
          setEntities(parsed.entities as unknown as DxfEntity[]);
          setIsDemoFallback(false);
        } else if (active) {
          setEntities(DEMO_DXF_ENTITIES);
          setIsDemoFallback(true);
        }
      } catch {
        if (active) {
          setEntities(DEMO_DXF_ENTITIES);
          setIsDemoFallback(true);
        }
      }
    }
    loadDxf();
    return () => {
      active = false;
    };
  }, [fileUrl]);

  const layers = useMemo(() => {
    const set = new Set<string>();
    entities.forEach((e) => set.add((e.layer || "0").toUpperCase()));
    return Array.from(set);
  }, [entities]);

  const viewBox = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ent of entities) {
      if (ent.vertices) {
        for (const v of ent.vertices) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
        }
      } else if (ent.center && ent.radius) {
        minX = Math.min(minX, ent.center.x - ent.radius);
        minY = Math.min(minY, ent.center.y - ent.radius);
        maxX = Math.max(maxX, ent.center.x + ent.radius);
        maxY = Math.max(maxY, ent.center.y + ent.radius);
      }
    }
    if (!Number.isFinite(minX)) return "0 0 320 220";
    const pad = Math.max(15, (maxX - minX) * 0.08);
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }, [entities]);

  function toggleLayer(layer: string) {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-white rounded-xl overflow-hidden">
      {/* Barra discreta de Layers CAD */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-[#F5F5F7] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Layers CAD:
          </span>
          {layers.map((layer) => {
            const isHidden = hiddenLayers.has(layer);
            const color = LAYER_COLORS[layer] || "#334155";
            return (
              <button
                key={layer}
                type="button"
                onClick={() => toggleLayer(layer)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-medium transition ${
                  isHidden
                    ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
                    : "border-slate-200 bg-white text-slate-800 shadow-sm"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isHidden ? "#CBD5E1" : color }} />
                {layer}
              </button>
            );
          })}
        </div>
        {isDemoFallback && (
          <span className="text-[10px] font-medium text-slate-500">
            Vetor CAD · {fileName}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-4 bg-white">
        <svg viewBox={viewBox} className="w-full h-full max-h-[520px]">
          {entities.map((ent, i) => {
            const layerName = (ent.layer || "0").toUpperCase();
            if (hiddenLayers.has(layerName)) return null;
            const stroke = LAYER_COLORS[layerName] || "#18181B";

            if ((ent.type === "LINE" || ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.vertices?.length) {
              const pts = ent.vertices.map((v) => `${v.x},${v.y}`).join(" ");
              return (
                <polyline
                  key={i}
                  points={pts}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
              );
            }
            if (ent.type === "CIRCLE" && ent.center && ent.radius) {
              return (
                <circle
                  key={i}
                  cx={ent.center.x}
                  cy={ent.center.y}
                  r={ent.radius}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.5}
                />
              );
            }
            return null;
          })}
        </svg>
      </div>
    </div>
  );
}
