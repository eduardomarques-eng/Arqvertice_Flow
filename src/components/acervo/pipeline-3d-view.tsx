"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Pipeline3DAssetItem,
  Pipeline3DStatus,
  Pipeline3DStepId,
} from "@/lib/acervo/scene-compiler";

interface ExtendedPipelineItem extends Pipeline3DAssetItem {
  logs?: string[];
  updatedAt?: string;
}

interface PipelineResponse {
  success: boolean;
  manifestVersion: string;
  generatedAt: string;
  localArquivosAvailable: boolean;
  summary: {
    total: number;
    ready: number;
    warning: number;
    error: number;
  };
  items: ExtendedPipelineItem[];
}

const STATUS_BADGE: Record<
  Pipeline3DStatus,
  { label: string; dot: string; pill: string }
> = {
  READY: {
    label: "Apto (READY)",
    dot: "bg-emerald-500",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  WARNING: {
    label: "Aviso (WARNING)",
    dot: "bg-amber-500",
    pill: "border-amber-200 bg-amber-50 text-amber-800",
  },
  ERROR: {
    label: "Erro / Exportar (ERROR)",
    dot: "bg-rose-500",
    pill: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  ALL: "Todas Categorias",
  MODEL: "Templates 3D",
  AVATAR: "Avatares (Blocos Perrsonagens)",
  HDRI: "HDRI 24K / PMREM",
  PROJECT_BLOCK: "Blocos de Projeto",
  PROPRIETARY_SCENE: "Cenas Fechadas (.max)",
  INCOMPLETE: "Arquivos Incompletos",
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Pipeline3DView({ basePath }: { basePath: "/admin" | "/equipe" }) {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Pipeline3DStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string>("tpl-fachada-deck-lazer");
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/acervo/pipeline-3d", { cache: "no-store" });
      const json = (await res.json()) as PipelineResponse & { error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Falha ao carregar Pipeline Pré-Build 3D.");
      }
      setData(json);
      setSelectedId((prev) => prev || json.items[0]?.id || null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao consultar pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (statusFilter !== "ALL" && item.pipelineStatus !== statusFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.sourcePath.toLowerCase().includes(q) &&
        !item.sourceFormat.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, statusFilter, categoryFilter, search]);

  const selectedItem = useMemo(
    () => data?.items.find((i) => i.id === selectedId) || filteredItems[0] || null,
    [data, selectedId, filteredItems]
  );

  const runPipelineStep = useCallback(
    async (
      item: ExtendedPipelineItem,
      step: Pipeline3DStepId,
      extra?: { fileName?: string; base64File?: string }
    ) => {
      setRunningStep(`${item.id}:${step}`);
      setUploadFeedback(null);
      try {
        const res = await fetch("/api/acervo/pipeline-3d/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: item.id,
            step,
            assetName: item.name,
            category: item.category,
            sourceFormat: item.sourceFormat,
            fileName: extra?.fileName,
            base64File: extra?.base64File,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Falha ao executar etapa.");
        }
        await loadInventory();
        setSelectedId(item.id);
      } catch (err) {
        setUploadFeedback(err instanceof Error ? err.message : "Erro na etapa.");
      } finally {
        setRunningStep(null);
      }
    },
    [loadInventory]
  );

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["glb", "gltf", "usdz", "fbx", "obj"].includes(ext)) {
      setUploadFeedback(
        `Formato .${ext} não suportado para conversão direta. Exporte .glb, .usdz, .fbx ou .obj no 3ds Max / Revit.`
      );
      return;
    }

    const target =
      data?.items.find((i) => i.id === uploadTargetId) || {
        id: uploadTargetId,
        name: file.name.replace(/\.[^.]+$/, ""),
        category: "MODEL" as const,
        sourcePath: `uploads/${file.name}`,
        sourceFormat: ext.toUpperCase(),
        outputUrl: null,
        pipelineStatus: "WARNING" as const,
        stepCompleted: null,
        fileSizeBytes: file.size,
        sourceSizeMB: Number((file.size / (1024 * 1024)).toFixed(2)),
        triangleCount: 0,
        textureCount: 0,
        diagnostics: [],
      };

    const reader = new FileReader();
    reader.onload = async () => {
      const base64File = typeof reader.result === "string" ? reader.result : undefined;
      await runPipelineStep(target, "CONVERT_MESH", {
        fileName: file.name,
        base64File,
      });
      setUploadFeedback(`Arquivo ${file.name} enviado ao Passo 1 (Converter Arquivo & Malha).`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Apple-minimalista + Warm Minimalist */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link
              href={`${basePath}/acervo`}
              className="hover:text-slate-900 transition underline-offset-4 hover:underline"
            >
              Acervo Manager (CDE)
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Pipeline Pré-Build 3D</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#18181B]">
            Central de Conversão & Verificação Pré-Build 3D
          </h1>
          <p className="text-xs text-slate-500">
            Regra estrita Zero Modelagem 3D: apenas malhas prontas (.glb, .usdz, .fbx) e texturas otimizadas entram no Studio 3D.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-[#F5F5F7] px-3.5 text-xs font-semibold text-slate-800 hover:bg-[#EDE5D8]/60 transition"
          >
            <span>↻</span>
            <span>Reverificar Ativos</span>
          </button>
          <Link
            href={`${basePath}/acervo`}
            className="inline-flex h-9 items-center rounded-xl bg-[#18181B] px-3.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Voltar ao Acervo
          </Link>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Inventariado
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#18181B]">
            {data?.summary.total ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
            Aptos (READY)
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {data?.summary.ready ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            Avisos (WARNING)
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {data?.summary.warning ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
            Erros / Exportar (ERROR)
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {data?.summary.error ?? "—"}
          </p>
        </div>
      </div>

      {/* Zona de Upload & Filtros */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", "READY", "WARNING", "ERROR"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                    statusFilter === st
                      ? "bg-[#18181B] text-white"
                      : "bg-[#F5F5F7] text-slate-600 hover:bg-[#EDE5D8]/60"
                  }`}
                >
                  {st === "ALL"
                    ? "Todos"
                    : st === "READY"
                    ? "Aptos"
                    : st === "WARNING"
                    ? "Avisos"
                    : "Erros"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar por categoria"
                className="h-8 rounded-lg border border-slate-200 bg-[#F5F5F7] px-2.5 text-xs font-medium text-slate-700"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ativo ou formato..."
                className="h-8 w-44 rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 text-xs text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Inspecionando inventário 3D...
            </div>
          ) : errorMsg ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
              {errorMsg}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const badge = STATUS_BADGE[item.pipelineStatus];
                const isSelected = selectedItem?.id === item.id;
                const slugForStudio = item.id.replace(/^tpl-/, "");
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`cursor-pointer rounded-xl p-3 transition ${
                      isSelected ? "bg-[#EDE5D8]/45" : "hover:bg-[#F5F5F7]/80"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#18181B]">
                            {item.name}
                          </span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {item.sourcePath} · <span className="font-medium">{item.sourceFormat}</span> ·{" "}
                          {formatBytes(item.fileSizeBytes)}
                          {item.triangleCount > 0 ? ` · ${item.triangleCount.toLocaleString("pt-BR")} tris` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.pill}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                        {item.pipelineStatus === "READY" &&
                          item.category === "MODEL" &&
                          item.outputUrl && (
                            <Link
                              href={`/acervo/studio-3d/${slugForStudio}?returnTo=${encodeURIComponent(
                                `${basePath}/acervo/pipeline-3d`
                              )}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 items-center rounded-lg bg-[#18181B] px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800 transition"
                            >
                              Abrir no Studio 3D
                            </Link>
                          )}
                      </div>
                    </div>

                    {item.diagnostics?.[0] && (
                      <p className="mt-1.5 text-[11px] text-slate-600">
                        {item.diagnostics[0]}
                      </p>
                    )}
                  </div>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-500">
                  Nenhum ativo encontrado para este filtro.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel Direito: Fluxo Sequencial de 3 Botões + Upload */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Execução Sequencial (Pré-Build)
            </h2>
            {selectedItem ? (
              <>
                <div className="rounded-xl bg-[#F5F5F7] p-3 space-y-1">
                  <p className="text-xs font-semibold text-[#18181B]">{selectedItem.name}</p>
                  <p className="text-[11px] text-slate-500">
                    Etapa atual: {selectedItem.stepCompleted || "Nenhuma executada"}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={runningStep !== null}
                    onClick={() => void runPipelineStep(selectedItem, "CONVERT_MESH")}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[#18181B] hover:bg-[#EDE5D8]/50 disabled:opacity-50 transition"
                  >
                    <span>1. Converter Arquivo & Malha</span>
                    <span className="text-[10px] text-slate-500">
                      {runningStep === `${selectedItem.id}:CONVERT_MESH` ? "Executando..." : "Y-Up · Y=0"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={runningStep !== null}
                    onClick={() => void runPipelineStep(selectedItem, "OPTIMIZE_IMAGES_PBR")}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[#18181B] hover:bg-[#EDE5D8]/50 disabled:opacity-50 transition"
                  >
                    <span>2. Converter Imagens & Shaders PBR</span>
                    <span className="text-[10px] text-slate-500">
                      {runningStep === `${selectedItem.id}:OPTIMIZE_IMAGES_PBR`
                        ? "Executando..."
                        : "WebP ≤ 1024px"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={runningStep !== null}
                    onClick={() => void runPipelineStep(selectedItem, "BUILD_MESHOPT")}
                    className="flex w-full items-center justify-between rounded-xl bg-[#18181B] px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    <span>3. Executar Build & Comprimir GPU (Meshopt)</span>
                    <span className="text-[10px] text-slate-300">
                      {runningStep === `${selectedItem.id}:BUILD_MESHOPT` ? "Executando..." : "Build Final"}
                    </span>
                  </button>
                </div>

                {selectedItem.logs && selectedItem.logs.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-[#18181B] p-3 text-[11px] font-mono text-emerald-300 space-y-1 max-h-40 overflow-y-auto">
                    {selectedItem.logs.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Selecione um ativo na lista para executar o pipeline.</p>
            )}
          </div>

          {/* Dropzone de Upload .GLB / .USDZ / .FBX */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Enviar Malha Exportada (.glb / .usdz / .fbx)
            </h2>
            <select
              value={uploadTargetId}
              onChange={(e) => setUploadTargetId(e.target.value)}
              aria-label="Ativo de destino"
              className="h-9 w-full rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 text-xs font-medium text-slate-800"
            >
              <option value="tpl-fachada-deck-lazer">2. Fachada Contemporânea (NEEDS_EXPORT)</option>
              <option value="avatar-feminino">Avatar Feminino (Blocos Perrsonagens)</option>
              <option value="avatar-masculino">Avatar Masculino (Blocos Perrsonagens)</option>
              <option value="raw-projeto-pedro-max">Projeto Pedro (Exportação)</option>
            </select>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[#F5F5F7] px-4 py-5 text-center hover:bg-[#EDE5D8]/40 transition">
              <span className="text-xs font-semibold text-[#18181B]">
                Selecionar arquivo .glb, .usdz, .fbx ou .obj
              </span>
              <span className="mt-1 text-[11px] text-slate-500">
                Substitui itens NEEDS_EXPORT sem modelagem procedural
              </span>
              <input
                type="file"
                accept=".glb,.gltf,.usdz,.fbx,.obj"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
            </label>

            {uploadFeedback && (
              <p className="rounded-lg bg-[#EDE5D8]/60 px-3 py-2 text-[11px] font-medium text-[#18181B]">
                {uploadFeedback}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
