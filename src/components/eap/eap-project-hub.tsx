"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EapConferenceWorkbench } from "@/components/admin/eap/eap-conference-workbench";
import { EapSchedulePlanner } from "@/components/admin/eap/eap-schedule-planner";
import { EapFieldMeasurement } from "@/components/admin/eap/eap-field-measurement";
import { EapExecutiveReportView } from "@/components/eap/eap-executive-report-view";
import { EapExecutionTracker } from "@/components/eap/eap-execution-tracker";

export type EapDisciplineCode =
  | "ARQUITETONICO"
  | "ESTRUTURAL"
  | "ELETRICO"
  | "HIDRO_ABASTECIMENTO"
  | "HIDRO_ESGOTAMENTO"
  | "HIDRO_DRENAGEM"
  | "LUMINOTECNICO"
  | "PAISAGISMO";

interface CityOption {
  id: string;
  name: string;
  state: string;
  defaultBdiPercent: number;
  isDefault: boolean;
}

interface SourceFileDTO {
  id: string;
  fileName: string;
  sourceSoftware: string;
  discipline: string;
  revisionLabel: string;
  versionCode?: string;
  versionNumber?: number;
  isActive?: boolean;
  revisionNote?: string | null;
  supersedesId?: string | null;
  createdAt?: string;
  includedInMining: boolean;
  status: string;
  extractedSummaryJson?: {
    carbonKgCo2?: number | null;
    zeroSteelAlert?: {
      concreteM3: number;
      suggestedKg: number;
      message: string;
    } | null;
  } | null;
}

const DISCIPLINE_UPLOAD_CARDS: ReadonlyArray<{
  code: EapDisciplineCode;
  title: string;
  defaultSoftware: "TQS" | "REVIT";
  hint: string;
}> = [
  {
    code: "ARQUITETONICO",
    title: "Arquitetônico",
    defaultSoftware: "REVIT",
    hint: "Alvenaria, esquadrias, pisos, forros e pinturas (Revit — PDF/HTML)",
  },
  {
    code: "ESTRUTURAL",
    title: "Estrutural",
    defaultSoftware: "TQS",
    hint: "TQS RESDES.HTM / PDF: concreto, aço, fôrmas, vigotas e EPS",
  },
  {
    code: "ELETRICO",
    title: "Elétrico",
    defaultSoftware: "REVIT",
    hint: "Quadros, circuitos, eletrodutos, tomadas e cabeamento (Revit — PDF/HTML)",
  },
  {
    code: "HIDRO_ABASTECIMENTO",
    title: "Hidro — Abastecimento",
    defaultSoftware: "REVIT",
    hint: "Água fria, água quente, reservatórios e registros (Revit — PDF/HTML)",
  },
  {
    code: "HIDRO_ESGOTAMENTO",
    title: "Hidro — Esgotamento",
    defaultSoftware: "REVIT",
    hint: "Esgoto sanitário, ventilação e caixas de inspeção (Revit — PDF/HTML)",
  },
  {
    code: "HIDRO_DRENAGEM",
    title: "Hidro — Drenagem",
    defaultSoftware: "REVIT",
    hint: "Águas pluviais, calhas, ralos e caixas de drenagem (Revit — PDF/HTML)",
  },
  {
    code: "LUMINOTECNICO",
    title: "Luminotécnico",
    defaultSoftware: "REVIT",
    hint: "Pontos de luz, luminárias, fitas LED e comandos (PDF/HTML)",
  },
  {
    code: "PAISAGISMO",
    title: "Paisagismo",
    defaultSoftware: "REVIT",
    hint: "Espécies, gramados, canteiros, irrigação e pisos externos (PDF/HTML)",
  },
];

interface StageSummaryDTO {
  code: string;
  name: string;
  itemsCount: number;
  flaggedItems: Array<{
    id: string;
    description: string;
    unit: string;
    sanityFlag: string;
  }>;
}

interface InitialEapDTO {
  id: string;
  cityId: string;
  title: string;
  status: string;
  builtAreaM2: number;
  bdiPercent: number;
  cityLabel: string;
  sourceFiles: SourceFileDTO[];
  stageSummaries: StageSummaryDTO[];
}

interface EapProjectHubProps {
  projectId: string;
  projectName: string;
  cities: CityOption[];
  initialEap: InitialEapDTO | null;
}

const INPUT_CLASS =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

function isHtmlFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

function matchesDiscipline(sourceDiscipline: string, cardCode: EapDisciplineCode): boolean {
  if (sourceDiscipline === cardCode) return true;
  if (cardCode === "ARQUITETONICO" && sourceDiscipline === "ARQUITETURA") return true;
  return false;
}

export function EapProjectHub({
  projectId,
  projectName,
  cities,
  initialEap,
}: EapProjectHubProps) {
  const router = useRouter();
  const defaultCity = cities.find((c) => c.isDefault) ?? cities[0];

  // Wizard de inicialização
  const [cityId, setCityId] = useState(defaultCity?.id ?? "");
  const [builtAreaM2, setBuiltAreaM2] = useState("250");
  const [bdiPercent, setBdiPercent] = useState(String(defaultCity?.defaultBdiPercent ?? 22));
  const [plannedStartDate, setPlannedStartDate] = useState("");

  // Upload por disciplina & pré-visualização
  const [dragDiscipline, setDragDiscipline] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<SourceFileDTO | null>(null);
  const [openHistoryDisc, setOpenHistoryDisc] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
    showQuickMine?: boolean;
  } | null>(null);
  const [miningSummary, setMiningSummary] = useState<{
    versions: string[];
    acceptedItemsCount: number;
    preservedManualCount: number;
    warningsCount: number;
  } | null>(null);
  const [sources, setSources] = useState<SourceFileDTO[]>(initialEap?.sourceFiles ?? []);
  const [activeTab, setActiveTab] = useState<"sources" | "conference" | "planning" | "field" | "report">(
    initialEap && initialEap.status !== "RASCUNHO" ? "conference" : "sources"
  );
  const [reportSubTab, setReportSubTab] = useState<"executive" | "execution">(
    initialEap && (initialEap.status === "EM_EXECUCAO" || initialEap.status === "CONCLUIDA")
      ? "execution"
      : "executive"
  );

  async function handleInitEap(e: React.FormEvent) {
    e.preventDefault();
    if (!cityId) return;
    setBusy("init");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId,
          title: `EAP & Orçamento Executivo — ${projectName}`,
          builtAreaM2: Number(builtAreaM2) || 200,
          bdiPercent: Number(bdiPercent) || 22,
          plannedStartDate: plannedStartDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Falha ao inicializar EAP." });
        return;
      }
      setFeedback({ type: "success", text: "EAP inicializada com 4 Zonas, 26 Macro-Etapas e 38 Pacotes LOB." });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleDisciplineUpload(
    discipline: EapDisciplineCode,
    sourceSoftware: "TQS" | "REVIT",
    fileList: FileList | File[] | null,
    supersedesId?: string | null
  ) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBusy(`upload-${discipline}`);
    setFeedback(null);
    const added: SourceFileDTO[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("sourceSoftware", sourceSoftware);
        fd.append("discipline", discipline);
        if (supersedesId) {
          fd.append("supersedesId", supersedesId);
        }
        const res = await fetch(`/api/eap/projects/${projectId}/sources/upload`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setFeedback({ type: "error", text: json.error || `Erro ao enviar ${file.name}.` });
          return;
        }
        added.push(json.source);
      }
      if (added.length > 0) {
        setSources((prev) => {
          const updatedPrev = supersedesId
            ? prev.map((s) =>
                s.discipline === discipline ? { ...s, isActive: false, includedInMining: false } : s
              )
            : prev;
          return [...added, ...updatedPrev];
        });
        setFeedback({
          type: "success",
          text: supersedesId
            ? `Nova revisão (${added[0]?.versionCode || "R01"}) ativada na disciplina ${discipline}.`
            : `${added.length} arquivo(s) anexado(s) na disciplina ${discipline}.`,
          showQuickMine: Boolean(supersedesId),
        });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleActivateVersion(src: SourceFileDTO) {
    setBusy(`activate-${src.id}`);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/sources/${src.id}/activate`,
        { method: "PATCH" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao restaurar versão." });
        return;
      }
      setSources((prev) =>
        prev.map((s) =>
          s.discipline === src.discipline
            ? {
                ...s,
                isActive: s.id === src.id,
                includedInMining: s.id === src.id,
              }
            : s
        )
      );
      setFeedback({
        type: "success",
        text: `Versão ${src.versionCode || src.revisionLabel} ("${src.fileName}") definida como vigente.`,
        showQuickMine: true,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveSource(src: SourceFileDTO) {
    setBusy(`remove-${src.id}`);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/sources?sourceFileId=${encodeURIComponent(src.id)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || `Erro ao remover ${src.fileName}.` });
        return;
      }
      setSources((prev) => prev.filter((s) => s.id !== src.id));
      if (previewSource?.id === src.id) {
        setPreviewSource(null);
      }
      setFeedback({ type: "success", text: `Arquivo "${src.fileName}" removido da EAP.` });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleApplyPreliminarySteel(suggestedKg: number, concreteM3: number) {
    if (suggestedKg <= 0) return;
    setBusy("prelim-steel");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageCode: "04",
          code: "ACO-PRELIM-85",
          description: `Estimativa Preliminar Aço CA-50/CA-60 (Taxa 85 kg/m³ · ${concreteM3.toFixed(2)} m³)`,
          unit: "kg",
          category: "ACO",
          zoneQuantities: {
            FUND_TERREO: suggestedKg,
            PAV_SUPERIOR: 0,
            COBERTURA: 0,
            EXTERNO: 0,
          },
          lossPercent: 10,
          materialUnitCost: 7.8,
          laborUnitCost: 3.1,
          thirdPartyUnitCost: 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao aplicar estimativa preliminar." });
        return;
      }
      setFeedback({
        type: "success",
        text: `Estimativa preliminar de ${suggestedKg.toFixed(0)} kg de aço adicionada na Etapa 04 (Supraestrutura). Confira na aba Planilha EAP.`,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleMineAll() {
    setBusy("mine");
    setFeedback(null);
    setMiningSummary(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/mine`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Falha na mineração." });
        return;
      }
      const versions = Array.isArray(json.processedFiles)
        ? json.processedFiles
            .filter((f: { status: string }) => f.status === "PROCESSADO")
            .map(
              (f: { discipline: string; versionCode?: string }) =>
                `${f.discipline} ${f.versionCode || "R00"}`
            )
        : [];
      setMiningSummary({
        versions,
        acceptedItemsCount: Number(json.acceptedItemsCount || 0),
        preservedManualCount: Number(json.preservedManualCount || 0),
        warningsCount: Array.isArray(json.sanityWarnings) ? json.sanityWarnings.length : 0,
      });
      setFeedback({
        type: "success",
        text: `Mineração concluída: ${json.acceptedItemsCount} item(ns) pré-preenchido(s) na Planilha EAP.`,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!initialEap) {
    return (
      <Card className="max-w-2xl rounded-3xl border border-slate-200/90 bg-white p-6 dark:border-zinc-800 dark:bg-[#16161D]">
        <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
          Inicializar EAP & Orçamento Regional da Obra
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Instancia automaticamente as 4 Zonas, 26 Macro-Etapas EAP e 38 Pacotes LOB vinculados à tabela regional da cidade.
        </p>

        <form onSubmit={handleInitEap} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Cidade Base (Tabela Regional)
              </label>
              <select
                required
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className={`${INPUT_CLASS} mt-1 w-full`}
              >
                {cities.length === 0 && <option value="">Nenhuma cidade (rode npm run seed:eap)</option>}
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}/{c.state} (BDI {c.defaultBdiPercent}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Área Construída (m²)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={builtAreaM2}
                onChange={(e) => setBuiltAreaM2(e.target.value)}
                className={`${INPUT_CLASS} mt-1 w-full font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                BDI / Mark-Up Padrão (%)
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={bdiPercent}
                onChange={(e) => setBdiPercent(e.target.value)}
                className={`${INPUT_CLASS} mt-1 w-full font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Início Previsto da Obra
              </label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className={`${INPUT_CLASS} mt-1 w-full`}
              />
            </div>
          </div>

          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy === "init" || !cityId}
            className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
          >
            {busy === "init" ? "Inicializando EAP..." : "Inicializar EAP (26 Etapas + 38 Pacotes LOB)"}
          </button>
        </form>
      </Card>
    );
  }

  const allFlaggedItems = initialEap.stageSummaries.flatMap((s) =>
    s.flaggedItems.map((item) => ({ ...item, stageCode: s.code, stageName: s.name }))
  );
  const populatedStages = initialEap.stageSummaries.filter((s) => s.itemsCount > 0);
  const activeSources = sources.filter((s) => s.isActive !== false);
  const totalCarbon = activeSources.reduce(
    (acc, s) => acc + (s.extractedSummaryJson?.carbonKgCo2 || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Navegação por Abas da Seção EAP */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "sources", label: "1. Upload de Quantitativos" },
            { id: "conference", label: "2. Planilha EAP & Custos (Conferência)" },
            { id: "planning", label: "3. Planejamento (LOB & Cronograma)" },
            { id: "field", label: "4. Medição no Canteiro" },
            { id: "report", label: "5. Relatório Executivo & Medições" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 rounded-xl px-4 text-xs font-semibold transition-all duration-150 active:scale-[0.985] cursor-pointer ${
              activeTab === tab.id
                ? "bg-zinc-900 text-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.18)] ring-1 ring-inset ring-white/15 dark:bg-zinc-100 dark:text-zinc-950"
                : "border border-zinc-200/80 bg-white/75 text-zinc-700 backdrop-blur-md hover:bg-white/95 hover:text-zinc-950 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:bg-zinc-800/85"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "conference" && (
        <EapConferenceWorkbench
          projectId={projectId}
          cityId={initialEap.cityId}
          onValidated={() => router.refresh()}
        />
      )}

      {activeTab === "planning" && (
        <EapSchedulePlanner
          projectId={projectId}
          onBaselineApproved={() => router.refresh()}
        />
      )}

      {activeTab === "field" && (
        <EapFieldMeasurement
          projectId={projectId}
          onSaved={() => router.refresh()}
        />
      )}

      {activeTab === "report" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportSubTab("executive")}
              className={`h-8 rounded-xl px-3.5 text-xs font-semibold transition cursor-pointer ${
                reportSubTab === "executive"
                  ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              Relatório Executivo Inicial (Baseline)
            </button>
            <button
              type="button"
              onClick={() => setReportSubTab("execution")}
              className={`h-8 rounded-xl px-3.5 text-xs font-semibold transition cursor-pointer ${
                reportSubTab === "execution"
                  ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              Controle de Obra & Medições (Ciclo II)
            </button>
          </div>

          {reportSubTab === "executive" ? (
            <EapExecutiveReportView
              projectId={projectId}
              isAdmin={true}
              initialAudience="CLIENT"
              onPublished={() => router.refresh()}
            />
          ) : (
            <EapExecutionTracker
              projectId={projectId}
              isAdmin={true}
              onMutated={() => router.refresh()}
            />
          )}
        </div>
      )}

      {activeTab === "sources" && (
        <div className="space-y-6">
          {/* Cabeçalho Resumo & Ação Principal de Mineração */}
          <Card className="rounded-3xl border border-white/50 bg-white/80 p-5 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="blue">{initialEap.status}</Badge>
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Praça: {initialEap.cityLabel}
                </span>
                <span className="font-mono text-xs text-slate-600 dark:text-zinc-400">
                  Área: {initialEap.builtAreaM2} m² · BDI: {initialEap.bdiPercent}%
                </span>
                <Badge tone={activeSources.length > 0 ? "green" : "neutral"}>
                  {activeSources.length} arquivo(s) vigente(s)
                </Badge>
                {totalCarbon > 0 && (
                  <Badge tone="green">
                    Carbono Embutido: {totalCarbon.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kgCO2
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={handleMineAll}
                disabled={busy === "mine" || activeSources.length === 0}
                className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                {busy === "mine" ? "Minerando Quantitativos..." : "⚡ Minerar & Pré-Preencher EAP"}
              </button>
            </div>

            {feedback && (
              <div
                className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                }`}
              >
                <span>{feedback.text}</span>
                {feedback.showQuickMine && (
                  <button
                    type="button"
                    disabled={busy === "mine"}
                    onClick={() => void handleMineAll()}
                    className="h-7 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                  >
                    {busy === "mine" ? "Atualizando..." : "⚡ Atualizar EAP com esta versão"}
                  </button>
                )}
              </div>
            )}

            {miningSummary && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2 text-[11px] text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                <span className="font-bold">Rastreabilidade:</span>
                <span>
                  Versões vigentes:{" "}
                  <strong>
                    {miningSummary.versions.length > 0 ? miningSummary.versions.join(" · ") : "—"}
                  </strong>
                </span>
                <span>·</span>
                <span>{miningSummary.acceptedItemsCount} preenchido(s)/atualizado(s)</span>
                <span>·</span>
                <span>{miningSummary.preservedManualCount} edição(ões) manual(is) preservada(s)</span>
                {miningSummary.warningsCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      {miningSummary.warningsCount} alerta(s)
                    </span>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* Grade Responsiva com 8 Disciplinas (PDF / HTML TQS & Revit) */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-md dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                Upload de Quantitativos por Disciplina (8 Disciplinas · PDF / HTML TQS & Revit)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Anexe os arquivos `.pdf`, `.html` ou `.htm` diretamente no cartão de cada disciplina. Visualize ou remova anexos antes de minerar para a Planilha EAP.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DISCIPLINE_UPLOAD_CARDS.map((card) => {
                const discFiles = sources.filter((s) => matchesDiscipline(s.discipline, card.code));
                const activeDiscFiles = discFiles.filter((s) => s.isActive !== false);
                const historyDiscFiles = discFiles.filter((s) => s.isActive === false);
                const isHistoryOpen = Boolean(openHistoryDisc[card.code]);
                const isUploading = busy === `upload-${card.code}`;
                const isDrag = dragDiscipline === card.code;

                return (
                  <div
                    key={card.code}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragDiscipline(card.code);
                    }}
                    onDragLeave={() => setDragDiscipline(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragDiscipline(null);
                      void handleDisciplineUpload(card.code, card.defaultSoftware, e.dataTransfer.files);
                    }}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 transition ${
                      isDrag
                        ? "border-2 border-dashed border-blue-500 bg-blue-50/70 dark:border-amber-400 dark:bg-amber-950/20"
                        : "border-slate-200 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-900/60"
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                            {card.title}
                          </span>
                          <Badge tone={activeDiscFiles.length > 0 ? "green" : "neutral"}>
                            {isUploading ? "Enviando..." : `${activeDiscFiles.length} vigente(s)`}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[10px] leading-snug text-slate-600 dark:text-zinc-300">
                          {card.hint}
                        </p>
                      </div>

                      {/* Lista de arquivos vigentes na disciplina */}
                      {activeDiscFiles.length > 0 && (
                        <div className="space-y-1.5">
                          {activeDiscFiles.map((src) => {
                            const isHtml = isHtmlFileName(src.fileName);
                            const isRemoving = busy === `remove-${src.id}`;
                            const vCode = src.versionCode || src.revisionLabel || "R00";
                            return (
                              <div
                                key={src.id}
                                className="rounded-xl border border-slate-200/90 bg-white p-2 text-[11px] shadow-sm dark:border-zinc-700/80 dark:bg-zinc-950/70"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span
                                    title={src.fileName}
                                    className="truncate font-semibold text-slate-900 dark:text-zinc-100"
                                  >
                                    {src.fileName}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Badge tone="green">{vCode}</Badge>
                                    <Badge tone={isHtml ? "amber" : "blue"}>
                                      {isHtml ? "HTML" : "PDF"}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                                  <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                                    {src.sourceSoftware} · {src.status}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewSource(src)}
                                      className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Visualizar
                                    </button>
                                    <label className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                                      Nova Revisão (+R)
                                      <input
                                        type="file"
                                        accept=".pdf,.html,.htm,application/pdf,text/html"
                                        disabled={isUploading}
                                        onChange={(e) => {
                                          void handleDisciplineUpload(
                                            card.code,
                                            card.defaultSoftware,
                                            e.target.files,
                                            src.id
                                          );
                                          e.target.value = "";
                                        }}
                                        className="sr-only"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      disabled={isRemoving}
                                      onClick={() => void handleRemoveSource(src)}
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                                    >
                                      {isRemoving ? "..." : "Remover"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Histórico de Revisões Anteriores */}
                      {historyDiscFiles.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenHistoryDisc((prev) => ({
                                ...prev,
                                [card.code]: !prev[card.code],
                              }))
                            }
                            className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            {isHistoryOpen ? "▼" : "▶"} Histórico ({historyDiscFiles.length})
                          </button>
                          {isHistoryOpen && (
                            <div className="mt-1.5 space-y-1">
                              {historyDiscFiles.map((h) => (
                                <div
                                  key={h.id}
                                  className="rounded-lg border border-slate-200/80 bg-white/80 p-1.5 text-[10px] dark:border-zinc-800 dark:bg-zinc-950/60"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate font-medium text-slate-700 dark:text-zinc-300">
                                      <strong className="font-mono">{h.versionCode || h.revisionLabel}</strong> · {h.fileName}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewSource(h)}
                                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                                      >
                                        Ver
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy === `activate-${h.id}`}
                                        onClick={() => void handleActivateVersion(h)}
                                        className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                                      >
                                        Tornar Vigente
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <label className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white/80 px-2.5 py-2 text-[10px] font-semibold text-slate-700 hover:border-slate-500 cursor-pointer dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300 dark:hover:border-zinc-500">
                      <span>Padrão: {card.defaultSoftware}</span>
                      <span className="text-blue-700 dark:text-amber-400">+ PDF / HTML</span>
                      <input
                        type="file"
                        accept=".pdf,.html,.htm,application/pdf,text/html"
                        multiple
                        disabled={isUploading}
                        onChange={(e) => {
                          void handleDisciplineUpload(card.code, card.defaultSoftware, e.target.files);
                          e.target.value = "";
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Alertas de Sanidade Dimensional & Resumo por Etapa */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                Alertas de Sanidade Dimensional & Resumo por Etapa
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {allFlaggedItems.length} alerta(s) dimensional(is) · {populatedStages.length} etapa(s) pré-preenchida(s)
              </p>
            </div>

            {sources
              .filter((s) => s.includedInMining && s.extractedSummaryJson?.zeroSteelAlert)
              .map((s) => {
                const zAlert = s.extractedSummaryJson!.zeroSteelAlert!;
                return (
                  <div
                    key={`zero-steel-${s.id}`}
                    className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs dark:border-amber-800 dark:bg-amber-950/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-amber-950 dark:text-amber-200">
                        Alerta Estrutural ({s.fileName}) — Aço Principal Zerado
                      </div>
                      <button
                        type="button"
                        disabled={busy === "prelim-steel"}
                        onClick={() => handleApplyPreliminarySteel(zAlert.suggestedKg, zAlert.concreteM3)}
                        className="h-8 rounded-xl bg-amber-600 px-3 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                      >
                        {busy === "prelim-steel"
                          ? "Aplicando..."
                          : `Aplicar Estimativa Preliminar (85 kg/m³ · ${zAlert.suggestedKg.toFixed(0)} kg)`}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-900 dark:text-amber-300">{zAlert.message}</p>
                  </div>
                );
              })}

            {allFlaggedItems.length > 0 && (
              <div className="space-y-2">
                {allFlaggedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs dark:border-rose-900/60 dark:bg-rose-950/30"
                  >
                    <div className="font-bold text-rose-950 dark:text-rose-200">
                      Etapa {item.stageCode} — {item.description}
                    </div>
                    <p className="mt-0.5 text-[11px] text-rose-800 dark:text-rose-300">{item.sanityFlag}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {populatedStages.map((st) => (
                <Badge key={st.code} tone="blue">
                  {st.code} {st.name.slice(0, 22)}: {st.itemsCount} item(ns)
                </Badge>
              ))}
              {populatedStages.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Envie os arquivos acima e execute a mineração para visualizar a distribuição de itens nas 26 Macro-Etapas.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Pré-Visualização Segura (PDF / HTML) */}
      {previewSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-bold text-slate-950 dark:text-zinc-100">
                    {previewSource.fileName}
                  </h4>
                  <Badge tone={isHtmlFileName(previewSource.fileName) ? "amber" : "blue"}>
                    {isHtmlFileName(previewSource.fileName) ? "HTML" : "PDF"}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Disciplina: {previewSource.discipline} · Origem: {previewSource.sourceSoftware}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/eap/projects/${projectId}/sources/${previewSource.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  Abrir em nova aba ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewSource(null)}
                  className="h-8 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-zinc-950">
              <iframe
                title={`Visualização ${previewSource.fileName}`}
                src={`/api/eap/projects/${projectId}/sources/${previewSource.id}/file`}
                sandbox={isHtmlFileName(previewSource.fileName) ? "" : undefined}
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
