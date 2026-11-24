"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EapConferenceWorkbench } from "@/components/admin/eap/eap-conference-workbench";

interface CityOption {
  id: string;
  name: string;
  state: string;
  defaultBdiPercent: number;
  isDefault: boolean;
}

interface SourceFileDTO {
  id: string;
  acervoDocumentId: string | null;
  fileName: string;
  sourceSoftware: string;
  discipline: string;
  revisionLabel: string;
  includedInMining: boolean;
  status: string;
}

interface ConflictDTO {
  id: string;
  category: string;
  itemDescription: string;
  winningSource: string;
  discardedSource: string;
  winningQty: number;
  discardedQty: number;
  unit: string;
  reason: string;
  status: string;
}

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
  conflicts: ConflictDTO[];
  stageSummaries: StageSummaryDTO[];
}

interface AcervoPdfOption {
  acervoDocumentId: string;
  code: string;
  title: string;
  discipline: string;
  revisionNumber: string;
  fileName: string;
}

interface EapProjectHubProps {
  projectId: string;
  projectName: string;
  cities: CityOption[];
  initialEap: InitialEapDTO | null;
  acervoPdfs: AcervoPdfOption[];
}

const INPUT_CLASS =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

export function EapProjectHub({
  projectId,
  projectName,
  cities,
  initialEap,
  acervoPdfs,
}: EapProjectHubProps) {
  const router = useRouter();
  const defaultCity = cities.find((c) => c.isDefault) ?? cities[0];

  // Wizard de inicialização
  const [cityId, setCityId] = useState(defaultCity?.id ?? "");
  const [builtAreaM2, setBuiltAreaM2] = useState("250");
  const [bdiPercent, setBdiPercent] = useState(String(defaultCity?.defaultBdiPercent ?? 22));
  const [plannedStartDate, setPlannedStartDate] = useState("");

  // Curadoria & Upload
  const [selectedAcervoIds, setSelectedAcervoIds] = useState<string[]>([]);
  const [uploadSoftware, setUploadSoftware] = useState<"TQS" | "REVIT">("TQS");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictDTO[]>(initialEap?.conflicts ?? []);
  const [sources, setSources] = useState<SourceFileDTO[]>(initialEap?.sourceFiles ?? []);
  const [activeTab, setActiveTab] = useState<"sources" | "conference" | "planning" | "report">(
    initialEap && initialEap.status !== "RASCUNHO" ? "conference" : "sources"
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

  async function handleImportAcervo() {
    if (selectedAcervoIds.length === 0) return;
    setBusy("import");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/sources/import-acervo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acervoDocumentIds: selectedAcervoIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao importar do Acervo." });
        return;
      }
      setSelectedAcervoIds([]);
      setFeedback({ type: "success", text: `${json.importedCount} documento(s) importados do Acervo.` });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleUploadPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setBusy("upload");
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("sourceSoftware", uploadSoftware);
      fd.append("discipline", uploadSoftware === "TQS" ? "ESTRUTURAL" : "ARQUITETURA");
      const res = await fetch(`/api/eap/projects/${projectId}/sources/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao enviar PDF." });
        return;
      }
      setUploadFile(null);
      setSources((prev) => [json.source, ...prev]);
      setFeedback({ type: "success", text: `Arquivo ${json.source.fileName} adicionado à fila de mineração.` });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleSource(src: SourceFileDTO, patch: Partial<Pick<SourceFileDTO, "includedInMining" | "sourceSoftware">>) {
    setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, ...patch } : s)));
    await fetch(`/api/eap/projects/${projectId}/sources`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFileId: src.id, ...patch }),
    });
  }

  async function handleMineAll() {
    setBusy("mine");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/mine`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Falha na mineração." });
        return;
      }
      setFeedback({
        type: "success",
        text: `Mineração concluída: ${json.acceptedItemsCount} item(ns) pré-preenchidos e ${json.conflictsCount} conflito(s) TQS×Revit auditados.`,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdateConflict(conflictId: string, status: "BLOQUEADO_AUTO" | "SOBRESCRITO_HUMANO" | "RESOLVIDO") {
    setBusy(conflictId);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/conflicts/${conflictId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setConflicts((prev) => prev.map((c) => (c.id === conflictId ? { ...c, status } : c)));
      }
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

  return (
    <div className="space-y-6">
      {/* Navegação por Abas da Seção EAP */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "sources", label: "1. Fontes & Compatibilização (TQS/Revit)" },
            { id: "conference", label: "2. Planilha EAP & Custos (Conferência)" },
            { id: "planning", label: "3. Planejamento (LOB & Cronograma)" },
            { id: "report", label: "4. Relatório Executivo & Medições" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 rounded-xl px-4 text-xs font-semibold transition cursor-pointer ${
              activeTab === tab.id
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center space-y-2 dark:border-zinc-800 dark:bg-[#16161D]">
          <Badge tone={initialEap.status === "CONFERENCIA_OK" ? "green" : "amber"}>
            {initialEap.status === "CONFERENCIA_OK"
              ? "Conferência EAP Homologada — Pronto para Fase 4"
              : "Aguardando Validação da Conferência na Aba 2"}
          </Badge>
          <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
            Submódulo Planejamento — Linha de Balanço (38 Pacotes LOB)
          </h3>
          <p className="mx-auto max-w-xl text-xs text-slate-500 dark:text-zinc-400">
            Conectado à Fase 4: Gantt interativo, Curva S, Desembolso Mensal e Calendário de Suprimentos com feriados de {initialEap.cityLabel}.
          </p>
        </Card>
      )}

      {activeTab === "report" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center space-y-2 dark:border-zinc-800 dark:bg-[#16161D]">
          <Badge tone="neutral">Fases 5 & 6</Badge>
          <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
            Relatório Executivo do Cliente & Ciclo II (Previsto × Realizado)
          </h3>
          <p className="mx-auto max-w-xl text-xs text-slate-500 dark:text-zinc-400">
            Dashboards interativos, plantas do Acervo Manager, exportação PDF executiva e boletins de medição física/financeira.
          </p>
        </Card>
      )}

      {activeTab === "sources" && (
        <div className="space-y-6">
      {/* Cabeçalho Resumo */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="blue">{initialEap.status}</Badge>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
              Praça: {initialEap.cityLabel}
            </span>
            <span className="font-mono text-xs text-slate-600 dark:text-zinc-400">
              Área: {initialEap.builtAreaM2} m² · BDI: {initialEap.bdiPercent}%
            </span>
          </div>
          <button
            type="button"
            onClick={handleMineAll}
            disabled={busy === "mine" || sources.filter((s) => s.includedInMining).length === 0}
            className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
          >
            {busy === "mine" ? "Minerando PDFs..." : "⚡ Minerar & Pré-Preencher EAP"}
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </Card>

      {/* Curadoria de Fontes: Acervo Manager + Upload Dedicado */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                1. Importar PDFs do Acervo Manager (Somente Leitura)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Pranchas e relatórios PDF da obra disponíveis no CDE.
              </p>
            </div>
            <button
              type="button"
              onClick={handleImportAcervo}
              disabled={busy === "import" || selectedAcervoIds.length === 0}
              className="h-8 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
            >
              {busy === "import" ? "Importando..." : `Importar (${selectedAcervoIds.length})`}
            </button>
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {acervoPdfs.map((doc) => {
              const checked = selectedAcervoIds.includes(doc.acervoDocumentId);
              return (
                <label
                  key={doc.acervoDocumentId}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 p-2.5 text-xs cursor-pointer hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedAcervoIds((prev) =>
                          e.target.checked
                            ? [...prev, doc.acervoDocumentId]
                            : prev.filter((id) => id !== doc.acervoDocumentId)
                        )
                      }
                    />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">
                        {doc.code} — {doc.title}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {doc.discipline} · {doc.revisionNumber} · {doc.fileName}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
            {acervoPdfs.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Nenhum PDF encontrado no Acervo Manager desta obra. Use o upload dedicado ao lado.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              2. Upload Dedicado de Relatório PDF (TQS / Revit)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Envie resumos de aço/concreto do TQS ou tabelas quantitativas (Schedules) do Revit.
            </p>
          </div>
          <form onSubmit={handleUploadPdf} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <select
                value={uploadSoftware}
                onChange={(e) => setUploadSoftware(e.target.value as "TQS" | "REVIT")}
                className={INPUT_CLASS}
              >
                <option value="TQS">TQS (Estrutura: Aço, Concreto, Fôrmas)</option>
                <option value="REVIT">Revit (Arquitetura: Alvenaria, Esquadrias, Acabamentos)</option>
              </select>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="text-xs text-slate-700 dark:text-zinc-300"
              />
            </div>
            <button
              type="submit"
              disabled={busy === "upload" || !uploadFile}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              {busy === "upload" ? "Enviando..." : "Enviar PDF para Fila da EAP"}
            </button>
          </form>
        </Card>
      </div>

      {/* Fila de Arquivos Selecionados para Mineração */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
          Arquivos na Fila de Mineração ({sources.length})
        </h3>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Minerar</th>
                <th className="px-3 py-2">Arquivo / Revisão</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {sources.map((src) => (
                <tr key={src.id} className="text-slate-800 dark:text-zinc-200">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={src.includedInMining}
                      onChange={(e) => handleToggleSource(src, { includedInMining: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{src.fileName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {src.discipline} · {src.revisionLabel}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={src.sourceSoftware}
                      onChange={(e) => handleToggleSource(src, { sourceSoftware: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="TQS">TQS</option>
                      <option value="REVIT">REVIT</option>
                      <option value="MANUAL">MANUAL</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      tone={
                        src.status === "PROCESSADO"
                          ? "green"
                          : src.status === "DESATUALIZADO_NO_ACERVO"
                            ? "amber"
                            : src.status === "ERRO"
                              ? "red"
                              : "neutral"
                      }
                    >
                      {src.status === "DESATUALIZADO_NO_ACERVO"
                        ? "Nova Revisão no Acervo"
                        : src.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400">
                    Importe PDFs do Acervo ou envie relatórios TQS/Revit para iniciar a mineração.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Compatibilização TQS x Revit + Alertas de Sanidade */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Compatibilização Anti-Duplicidade TQS × Revit ({conflicts.length})
          </h3>
          <div className="mt-3 space-y-2.5">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900 dark:text-zinc-100">{c.itemDescription}</div>
                  <Badge tone={c.status === "BLOQUEADO_AUTO" ? "amber" : "green"}>{c.status}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-300">{c.reason}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                    Autoridade: {c.winningSource} · Descartado ({c.discardedSource}): {c.discardedQty} {c.unit}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => handleUpdateConflict(c.id, "RESOLVIDO")}
                      className="rounded-lg border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-900 cursor-pointer dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                    >
                      Confirmar Bloqueio (Resolver)
                    </button>
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => handleUpdateConflict(c.id, "SOBRESCRITO_HUMANO")}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                    >
                      Sobrescrever (Usar Revit)
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {conflicts.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Nenhum conflito de duplicidade registrado até o momento.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Alertas de Sanidade Dimensional & Resumo por Etapa
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {allFlaggedItems.length} alerta(s) dimensional(is) · {populatedStages.length} etapa(s) pré-preenchida(s)
            </p>
          </div>

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
                Execute a mineração para visualizar a distribuição de itens nas 26 Macro-Etapas.
              </p>
            )}
          </div>
        </Card>
      </div>
        </div>
      )}
    </div>
  );
}
