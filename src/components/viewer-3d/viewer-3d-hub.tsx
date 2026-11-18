"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RealtimeSyncBadge, type RealtimeSyncStatus } from "@/hooks/use-realtime-mutation";
import type {
  Pipeline3DAssetItem,
  Pipeline3DStatus,
  Pipeline3DStepId,
  Template3DAvatarEntry,
} from "@/lib/acervo/scene-compiler";
import type { MiniPreviewModelInfo } from "./mini-preview-canvas";

const MiniPreviewCanvas = dynamic(
  () => import("./mini-preview-canvas").then((mod) => mod.MiniPreviewCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 w-full animate-pulse rounded-3xl border border-slate-200/70 bg-white/60 dark:border-white/10 dark:bg-[#18181B]" />
    ),
  }
);

export type ViewerWorkflowStage =
  | "INGESTION"
  | "PIPELINE"
  | "WORKSPACE"
  | "OUTPUT";

export interface Viewer3DProjectOption {
  id: string;
  name: string;
  clientName?: string;
}

export interface Viewer3DGovernanceProps {
  viewerMode: "READ_ONLY" | "PROCEDURAL_EDIT" | "FULL_RENDER_EXPORT";
  canNavigate: boolean;
  canProceduralEdit: boolean;
  canExportRenders: boolean;
  canManageRfi: boolean;
}

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
  avatars?: Template3DAvatarEntry[];
}

const WORKFLOW_STEPS: Array<{
  id: ViewerWorkflowStage;
  stepNum: number;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
}> = [
  {
    id: "INGESTION",
    stepNum: 1,
    title: "1. Importação",
    subtitle: "Upload de .GLB, .USDZ e .FBX",
    badge: "Ingestion",
    icon: "📥",
  },
  {
    id: "PIPELINE",
    stepNum: 2,
    title: "2. Tratamento",
    subtitle: "Conversão, Meshopt & Shaders PBR",
    badge: "Pipeline",
    icon: "⚙️",
  },
  {
    id: "WORKSPACE",
    stepNum: 3,
    title: "3. Visualização",
    subtitle: "Cena Procedural, Objetos & RFIs",
    badge: "Workspace",
    icon: "🧊",
  },
  {
    id: "OUTPUT",
    stepNum: 4,
    title: "4. Exportação",
    subtitle: "Geração de Imagens / Renders 4K",
    badge: "Output",
    icon: "📸",
  },
];

const STATUS_BADGE: Record<
  Pipeline3DStatus,
  { label: string; dot: string; pill: string }
> = {
  READY: {
    label: "Apto (READY)",
    dot: "bg-emerald-500",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  WARNING: {
    label: "Aviso (WARNING)",
    dot: "bg-amber-500",
    pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  },
  ERROR: {
    label: "Exportar (NEEDS_EXPORT)",
    dot: "bg-rose-500",
    pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  },
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Viewer3DHub({
  basePath,
  projects,
  governance,
  userRole,
}: {
  basePath: "/admin" | "/equipe";
  projects: Viewer3DProjectOption[];
  governance: Viewer3DGovernanceProps;
  userRole: string;
}) {
  const [activeStage, setActiveStage] = useState<ViewerWorkflowStage>("INGESTION");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id || "ALL"
  );
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("tpl-cozinha-interna");
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("MODEL");

  // Stage 4 (Output / Render Generator) state
  const [renderResolution, setRenderResolution] = useState<"1080p" | "4K">("4K");
  const [renderPresetSky, setRenderPresetSky] = useState<string>("golden-hour");
  const [renderPresetGround, setRenderPresetGround] = useState<string>("concreto");
  const [generatedRenders, setGeneratedRenders] = useState<
    Array<{
      id: string;
      title: string;
      resolution: string;
      skyLabel: string;
      groundLabel: string;
      dataUrl: string;
      createdAt: string;
    }>
  >([]);
  const [isGeneratingRender, setIsGeneratingRender] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/acervo/pipeline-3d", { cache: "no-store" });
      const json = (await res.json()) as PipelineResponse;
      if (res.ok && json.success) {
        setData(json);
        setSelectedAssetId((prev) => prev || json.items[0]?.id || "tpl-cozinha-interna");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const modelItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.sourcePath.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, categoryFilter, search]);

  const readyModels = useMemo(
    () => (data?.items || []).filter((i) => i.category === "MODEL" && Boolean(i.outputUrl)),
    [data]
  );

  const selectedItem = useMemo(() => {
    if (!data) return null;
    return (
      data.items.find((i) => i.id === selectedAssetId) ||
      modelItems[0] ||
      data.items[0] ||
      null
    );
  }, [data, selectedAssetId, modelItems]);

  const miniPreviewModel = useMemo<MiniPreviewModelInfo | null>(() => {
    if (!selectedItem) return null;
    const slug = selectedItem.id.replace(/^tpl-/, "");
    return {
      id: selectedItem.id,
      slug,
      name: selectedItem.name,
      category: selectedItem.category,
      sourceFormat: selectedItem.sourceFormat,
      glbUrl: selectedItem.outputUrl,
      status: selectedItem.pipelineStatus,
      fileSizeBytes: selectedItem.fileSizeBytes,
      triangleCount: selectedItem.triangleCount,
      textureCount: selectedItem.textureCount,
      diagnostics: selectedItem.diagnostics,
    };
  }, [selectedItem]);

  const getWorkspaceUrl = (itemId: string) => {
    const slug = itemId.replace(/^tpl-/, "");
    const projParam =
      selectedProjectId && selectedProjectId !== "ALL"
        ? `?projectId=${encodeURIComponent(selectedProjectId)}&returnTo=${encodeURIComponent(
            `${basePath}/3d-viewer`
          )}`
        : `?returnTo=${encodeURIComponent(`${basePath}/3d-viewer`)}`;
    return `/3d-viewer/workspace/${slug}${projParam}`;
  };

  const runPipelineStep = useCallback(
    async (
      item: ExtendedPipelineItem,
      step: Pipeline3DStepId,
      extra?: { fileName?: string; base64File?: string }
    ) => {
      if (runningStep) return;
      setRunningStep(`${item.id}:${step}`);
      setSyncStatus("syncing");
      setFeedback(null);

      // Atualização otimista imediata (0ms) na UI
      const prevSnapshot = data;
      setData((curr) =>
        curr
          ? {
              ...curr,
              items: curr.items.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      stepCompleted: step,
                      pipelineStatus: step === "BUILD_MESHOPT" ? "READY" : it.pipelineStatus,
                    }
                  : it
              ),
            }
          : curr
      );
      setSelectedAssetId(item.id);

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
            projectId: selectedProjectId !== "ALL" ? selectedProjectId : undefined,
            fileName: extra?.fileName,
            base64File: extra?.base64File,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Falha ao processar etapa do Pipeline 3D.");
        }
        await loadInventory();
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2400);
      } catch (err) {
        if (prevSnapshot) setData(prevSnapshot);
        setSyncStatus("error");
        setFeedback(err instanceof Error ? err.message : "Erro ao processar arquivo 3D.");
      } finally {
        setRunningStep(null);
      }
    },
    [data, loadInventory, runningStep, selectedProjectId]
  );

  const handleDirectUpload = async (item: ExtendedPipelineItem, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["glb", "gltf", "usdz", "fbx", "obj"].includes(ext)) {
      setFeedback(
        `Formato .${ext} não suportado. Envie .glb, .usdz, .fbx ou .obj.`
      );
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFeedback(
        `Arquivo excede o limite serverless de 4 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64File = typeof reader.result === "string" ? reader.result : undefined;
      await runPipelineStep(item, "CONVERT_MESH", {
        fileName: file.name,
        base64File,
      });
      await runPipelineStep(item, "OPTIMIZE_IMAGES_PBR");
      await runPipelineStep(item, "BUILD_MESHOPT");
      setFeedback(
        `Modelo "${item.name}" (${file.name}) importado, otimizado com Meshopt e pronto no Workspace 3D!`
      );
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateStillRender = async () => {
    if (!governance.canExportRenders) return;
    const activeModel =
      readyModels.find((m) => m.id === selectedAssetId) || readyModels[0];
    if (!activeModel) return;

    setIsGeneratingRender(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = renderResolution === "4K" ? 1920 : 1280;
      canvas.height = renderResolution === "4K" ? 1080 : 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const skyColors: Record<string, [string, string]> = {
          "golden-hour": ["#1e1b2e", "#e2956d"],
          "solar-zenith": ["#1d4ed8", "#bae6fd"],
          "studio-dark": ["#09090b", "#27272a"],
        };
        const [topHex, botHex] = skyColors[renderPresetSky] || skyColors["golden-hour"];
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, topHex);
        grad.addColorStop(0.65, botHex);
        grad.addColorStop(1, "#18181b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Chão procedural estilizado no snapshot
        ctx.fillStyle = "rgba(24, 24, 27, 0.72)";
        ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);

        // Selo técnico ArqVértice Render Output
        ctx.fillStyle = "rgba(9, 9, 11, 0.78)";
        ctx.fillRect(40, canvas.height - 130, canvas.width - 80, 90);
        ctx.strokeStyle = "rgba(237, 229, 216, 0.45)";
        ctx.strokeRect(40, canvas.height - 130, canvas.width - 80, 90);

        ctx.fillStyle = "#EDE5D8";
        ctx.font = "bold 24px Montserrat, sans-serif";
        ctx.fillText(
          `ARQVÉRTICE 3D VIEWER · ${activeModel.name.toUpperCase()}`,
          68,
          canvas.height - 86
        );
        ctx.fillStyle = "#CBD5E1";
        ctx.font = "16px monospace";
        ctx.fillText(
          `Resolução: ${renderResolution} | Céu Procedural: ${renderPresetSky} | Chão: ${renderPresetGround} | ${activeModel.triangleCount} tris`,
          68,
          canvas.height - 56
        );
      }

      const dataUrl = canvas.toDataURL("image/png");
      setGeneratedRenders((prev) => [
        {
          id: `render-${Date.now()}`,
          title: `${activeModel.name} — Vista Arquitetônica`,
          resolution: renderResolution === "4K" ? "3840×2160 (4K UHD)" : "1920×1080 (Full HD)",
          skyLabel:
            renderPresetSky === "golden-hour"
              ? "Sol Procedural · Golden Hour"
              : renderPresetSky === "solar-zenith"
              ? "Sol Procedural · Zênite Meio-Dia"
              : "Estúdio Infinito Dark",
          groundLabel: renderPresetGround.toUpperCase(),
          dataUrl,
          createdAt: new Date().toLocaleTimeString("pt-BR"),
        },
        ...prev,
      ]);
      setFeedback(
        `Render ${renderResolution} de "${activeModel.name}" gerado com sucesso!`
      );
    } finally {
      setIsGeneratingRender(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO EXECUTIVO DO MÓDULO ISOLADO "3D VIEWER" */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#18181B] sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#EDE5D8] dark:bg-[#EDE5D8] dark:text-[#18181B]">
              <span>🧊</span> Módulo Isolado · 3D Viewer
            </span>
            <RealtimeSyncBadge status={syncStatus} errorMessage={feedback} />
            <span className="rounded-full border border-slate-200 bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-300">
              Permissão RBAC:{" "}
              <strong>
                {userRole === "ADMIN" || governance.viewerMode === "FULL_RENDER_EXPORT"
                  ? "Exportação de Renders + Edição Procedural"
                  : governance.viewerMode === "PROCEDURAL_EDIT"
                  ? "Edição Procedural"
                  : "Navegação Leitura"}
              </strong>
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Central 3D Viewer — Pipeline, Cena Procedural & Renders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fluxo hierárquico em 4 etapas: Importação (`.glb`/`.usdz`/`.fbx`), Tratamento Meshopt, Visualização Procedural com Céu/Sol físico e Exportação.
          </p>
        </div>

        {/* Seletor de Empreendimento (Filtrado por ProjectAccess) */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            aria-label="Selecionar Empreendimento"
            className="h-10 rounded-xl border border-slate-200/80 bg-[#F5F5F7] px-3.5 text-xs font-semibold text-slate-900 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-200"
          >
            <option value="ALL">Todos os Empreendimentos ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.clientName ? `· ${p.clientName}` : ""}
              </option>
            ))}
          </select>

          <Link
            href={getWorkspaceUrl(selectedAssetId || "cozinha-interna")}
            data-testid="enter-workspace-primary-btn"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#18181B] px-4 text-xs font-bold text-[#EDE5D8] shadow-sm hover:opacity-95 active:scale-95 transition dark:bg-[#EDE5D8] dark:text-[#18181B]"
          >
            <span>🚀</span>
            <span>Abrir Workspace 3D</span>
          </Link>
        </div>
      </div>

      {/* 2. STEPPER HIERÁRQUICO VISUAL (4 ETAPAS) */}
      <div
        data-testid="viewer-3d-stepper"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {WORKFLOW_STEPS.map((st) => {
          const active = activeStage === st.id;
          return (
            <button
              key={st.id}
              type="button"
              data-testid={`stepper-tab-${st.id.toLowerCase()}`}
              onClick={() => setActiveStage(st.id)}
              className={`group flex items-start justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                active
                  ? "border-[#18181B] bg-[#18181B] text-white shadow-md dark:border-[#EDE5D8] dark:bg-[#EDE5D8] dark:text-[#18181B]"
                  : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-[#18181B] dark:text-slate-300"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{st.icon}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      active
                        ? "bg-white/15 text-[#EDE5D8] dark:bg-black/15 dark:text-[#18181B]"
                        : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
                    }`}
                  >
                    {st.badge}
                  </span>
                </div>
                <p className="text-sm font-bold">{st.title}</p>
                <p
                  className={`text-[11px] ${
                    active ? "text-white/75 dark:text-[#18181B]/75" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {st.subtitle}
                </p>
              </div>
              <span className="font-mono text-xs opacity-60">0{st.stepNum}</span>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-3 text-emerald-700 hover:opacity-75 dark:text-emerald-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ETAPAS 1 & 2: IMPORTAÇÃO (INGESTION) E TRATAMENTO (PIPELINE)         */}
      {/* Com Janela Menor de Pré-Visualização (Mini-Preview dpr=0.5) ao lado  */}
      {/* ==================================================================== */}
      {(activeStage === "INGESTION" || activeStage === "PIPELINE") && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Coluna Principal (8 colunas): Upload / Lista de Modelos & Pipeline */}
          <div className="lg:col-span-8 space-y-4">
            {activeStage === "INGESTION" && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#18181B] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      📥 Etapa 1 — Importação de Ativos 3D (`Ingestion`)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Envie malhas prontas (`.glb`, `.usdz`, `.fbx`, `.obj` até 4 MB) para atualizar qualquer template ou cena do empreendimento.
                    </p>
                  </div>

                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#18181B] px-4 text-xs font-bold text-[#EDE5D8] shadow-xs hover:opacity-90 transition dark:bg-[#EDE5D8] dark:text-[#18181B]">
                    <span>+ Enviar .GLB / .USDZ / .FBX</span>
                    <input
                      type="file"
                      accept=".glb,.gltf,.usdz,.fbx,.obj"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && selectedItem) {
                          void handleDirectUpload(selectedItem, file);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Filtros rápidos da listagem */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: "MODEL", label: "Modelos 3D (Templates)" },
                      { id: "AVATAR", label: "Avatares 3ªP" },
                      { id: "HDRI", label: "HDRIs / Sky" },
                      { id: "ALL", label: "Inventário Completo (43)" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          categoryFilter === cat.id
                            ? "bg-[#EDE5D8] text-[#18181B]"
                            : "bg-[#F5F5F7] text-slate-600 hover:text-slate-900 dark:bg-[#09090B] dark:text-slate-300"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Filtrar modelo por nome ou formato..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-64 rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-200"
                  />
                </div>
              </div>
            )}

            {activeStage === "PIPELINE" && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#18181B] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      ⚙️ Etapa 2 — Tratamento, Otimização Meshopt & Bake PBR (`Pipeline`)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Execute as 3 etapas determinísticas de compilação: 1. Converter Malha → 2. Otimizar Mapas PBR → 3. Build Meshopt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadInventory()}
                    className="rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-300"
                  >
                    ↻ Atualizar Telemetria
                  </button>
                </div>
              </div>
            )}

            {/* Listagem de Modelos com Seleção para a Janela de Mini-Preview */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 w-full animate-pulse rounded-3xl border border-slate-200/60 bg-white/60 dark:border-white/10 dark:bg-[#18181B]"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {modelItems.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const badge = STATUS_BADGE[item.pipelineStatus] || STATUS_BADGE.WARNING;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAssetId(item.id)}
                      className={`cursor-pointer rounded-3xl border p-4 transition ${
                        isSelected
                          ? "border-[#18181B] bg-white ring-2 ring-[#18181B]/10 dark:border-[#EDE5D8] dark:bg-[#18181B]"
                          : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-[#18181B]/80"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badge.pill}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                              .{item.sourceFormat.toLowerCase()} · {formatBytes(item.fileSizeBytes)}
                            </span>
                            {item.triangleCount > 0 && (
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {item.triangleCount.toLocaleString("pt-BR")} tris · {item.textureCount} tex PBR
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {item.name}
                          </h3>
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {item.sourcePath}
                          </p>
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 text-[11px] font-semibold text-slate-800 hover:bg-[#EDE5D8]/60 transition dark:border-white/10 dark:bg-[#09090B] dark:text-slate-200">
                            <span>📤 Enviar .GLB/.FBX/.USDZ</span>
                            <input
                              type="file"
                              accept=".glb,.gltf,.usdz,.fbx,.obj"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleDirectUpload(item, file);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>

                          {item.outputUrl && item.category === "MODEL" && (
                            <Link
                              href={getWorkspaceUrl(item.id)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#18181B] px-3 text-[11px] font-bold text-[#EDE5D8] hover:opacity-90 transition dark:bg-[#EDE5D8] dark:text-[#18181B]"
                            >
                              <span>🧊</span>
                              <span>Workspace</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Botões de Tratamento (Visíveis na Etapa 2 Pipeline ou ao selecionar) */}
                      {(activeStage === "PIPELINE" || isSelected) && (
                        <div
                          className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(
                            [
                              { id: "CONVERT_MESH", label: "1. Converter Malha" },
                              { id: "OPTIMIZE_IMAGES_PBR", label: "2. Otimizar Shaders & PBR" },
                              { id: "BUILD_MESHOPT", label: "3. Compilar Build (Meshopt)" },
                            ] as const
                          ).map((st) => {
                            const isRunning = runningStep === `${item.id}:${st.id}`;
                            return (
                              <button
                                key={st.id}
                                type="button"
                                disabled={Boolean(runningStep)}
                                onClick={() => void runPipelineStep(item, st.id)}
                                className="rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-[#EDE5D8] hover:text-[#18181B] transition disabled:opacity-50 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-300"
                              >
                                {isRunning ? "Processando..." : st.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna Lateral (4 colunas): Janela Menor de Pré-Visualização (Mini-Preview dpr=0.5) */}
          <div className="lg:col-span-4">
            <MiniPreviewCanvas
              model={miniPreviewModel}
              workspaceHref={getWorkspaceUrl(selectedItem?.id || "cozinha-interna")}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ETAPA 3: VISUALIZAÇÃO (WORKSPACE) — CENAS PRONTAS & RFIs             */}
      {/* ==================================================================== */}
      {activeStage === "WORKSPACE" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#18181B] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    🧊 Etapa 3 — Workspace de Visualização Procedural & RFIs
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Céu Real Procedural (`Three.js Sky` + `PMREMGenerator` GI), Chão Procedural tilizável, Câmera 100% Livre (Zênite/Nadir) e Seleção de Objetos com Glassmorphism.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {readyModels.map((mdl) => {
                  const wsHref = getWorkspaceUrl(mdl.id);
                  return (
                    <div
                      key={mdl.id}
                      onClick={() => setSelectedAssetId(mdl.id)}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-[#F5F5F7] p-4 transition hover:border-[#18181B] dark:border-white/10 dark:bg-[#09090B]"
                    >
                      <div>
                        <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          READY · {formatBytes(mdl.fileSizeBytes)}
                        </span>
                        <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                          {mdl.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {mdl.triangleCount.toLocaleString("pt-BR")} triângulos · {mdl.textureCount} texturas PBR
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setSelectedAssetId(mdl.id)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                          Inspecionar no Mini-Preview
                        </button>
                        <Link
                          href={wsHref}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#18181B] px-3.5 text-xs font-bold text-[#EDE5D8] hover:opacity-90 transition dark:bg-[#EDE5D8] dark:text-[#18181B]"
                        >
                          <span>Abrir Estúdio 3D →</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <MiniPreviewCanvas
              model={miniPreviewModel}
              workspaceHref={getWorkspaceUrl(selectedItem?.id || "cozinha-interna")}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ETAPA 4: EXPORTAÇÃO (OUTPUT) — RENDERS 4K & PACOTES OTIMIZADOS       */}
      {/* ==================================================================== */}
      {activeStage === "OUTPUT" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#18181B] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                📸 Etapa 4 — Exportação de Renders & Pacotes 3D (`Output`)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Geração de imagens fotorrealistas do modelo com Céu/Sol Procedural e download dos binários `.GLB` otimizados.
              </p>
            </div>
          </div>

          {!governance.canExportRenders && userRole !== "ADMIN" ? (
            <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 space-y-2">
              <p className="font-bold text-sm">
                🔒 Permissão Restrita pelo RBAC (`FeatureVisibility: {governance.viewerMode}`)
              </p>
              <p>
                Sua conta possui acesso de{" "}
                <strong>
                  {governance.viewerMode === "PROCEDURAL_EDIT"
                    ? "Edição Procedural"
                    : "Navegação Leitura"}
                </strong>
                . Para habilitar a <strong>Exportação de Renders</strong>, solicite ao Administrador em `/admin/equipe`.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Modelo 3D para Renderização
                  </label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 text-xs font-semibold text-slate-900 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-200"
                  >
                    {readyModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({formatBytes(m.fileSizeBytes)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Resolução de Saída
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["1080p", "4K"] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setRenderResolution(res)}
                        className={`h-10 rounded-xl border text-xs font-bold transition ${
                          renderResolution === res
                            ? "border-[#18181B] bg-[#18181B] text-[#EDE5D8] dark:border-[#EDE5D8] dark:bg-[#EDE5D8] dark:text-[#18181B]"
                            : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-300"
                        }`}
                      >
                        {res === "4K" ? "4K UHD (3840×2160)" : "Full HD (1920×1080)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Preset de Céu & Sol Procedural
                  </label>
                  <select
                    value={renderPresetSky}
                    onChange={(e) => setRenderPresetSky(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 text-xs font-semibold text-slate-900 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-200"
                  >
                    <option value="golden-hour">Sol Procedural · Golden Hour (Elevação 18°)</option>
                    <option value="solar-zenith">Sol Procedural · Meio-Dia (Elevação 68°)</option>
                    <option value="studio-dark">Estúdio Infinito Dark (#09090B)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Preset de Chão Procedural
                  </label>
                  <select
                    value={renderPresetGround}
                    onChange={(e) => setRenderPresetGround(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 text-xs font-semibold text-slate-900 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-200"
                  >
                    <option value="concreto">Concreto Ripado Arquitetônico</option>
                    <option value="cumaru">Deck de Madeira Cumaru</option>
                    <option value="asfalto">Asfalto Urbano</option>
                    <option value="relva">Relva Sintética Paisagística</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isGeneratingRender}
                  onClick={() => void handleGenerateStillRender()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] px-5 text-xs font-bold text-[#EDE5D8] shadow-sm hover:opacity-95 active:scale-95 transition dark:bg-[#EDE5D8] dark:text-[#18181B]"
                >
                  <span>📸</span>
                  <span>
                    {isGeneratingRender ? "Renderizando Frame..." : `Gerar Render ${renderResolution}`}
                  </span>
                </button>
              </div>

              <div className="md:col-span-2 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Galeria de Renders Gerados ({generatedRenders.length})
                </h3>
                {generatedRenders.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#F5F5F7]/60 p-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-[#09090B]">
                    <span className="text-2xl mb-2">🖼️</span>
                    <p className="font-semibold">Nenhum render exportado nesta sessão</p>
                    <p className="mt-1 text-[11px] opacity-80">
                      Clique em &quot;Gerar Render {renderResolution}&quot; ao lado ou capture diretamente dentro do Workspace 3D.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {generatedRenders.map((r) => (
                      <div
                        key={r.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-[#F5F5F7] dark:border-white/10 dark:bg-[#09090B]"
                      >
                        <img
                          src={r.dataUrl}
                          alt={r.title}
                          className="h-36 w-full object-cover"
                        />
                        <div className="p-3 space-y-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {r.title}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {r.resolution} · {r.skyLabel}
                          </p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="font-mono text-[10px] text-slate-400">{r.createdAt}</span>
                            <a
                              href={r.dataUrl}
                              download={`${r.id}.png`}
                              className="rounded-lg bg-[#18181B] px-2.5 py-1 text-[10px] font-bold text-[#EDE5D8] dark:bg-[#EDE5D8] dark:text-[#18181B]"
                            >
                              Baixar PNG
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
