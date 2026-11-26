"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CONCRETE_METHOD_LABELS,
  CONSTRUCTION_STANDARD_LABELS,
  REGIONAL_CITY_MULTIPLIERS,
  type ConcreteMethod,
  type ConstructionStandard,
  type TriagePreviewResult,
} from "@/server/eap/regional-standards-catalog";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface EapStandardTriageBarProps {
  projectId: string;
  initialStandard?: string;
  initialConcreteMethod?: string;
  initialCityName?: string;
  initialStateCode?: string;
  initialLaborFactor?: number;
  initialMaterialFactor?: number;
  onApplied: () => Promise<void> | void;
}

export function EapStandardTriageBar({
  projectId,
  initialStandard = "MEDIO_PADRAO",
  initialConcreteMethod = "USINADO",
  initialCityName = "Fortaleza",
  initialStateCode = "CE",
  initialLaborFactor = 1.0,
  initialMaterialFactor = 1.0,
  onApplied,
}: EapStandardTriageBarProps) {
  const [targetStandard, setTargetStandard] = useState<ConstructionStandard>(
    (initialStandard as ConstructionStandard) || "MEDIO_PADRAO"
  );
  const [concreteMethod, setConcreteMethod] = useState<ConcreteMethod>(
    (initialConcreteMethod as ConcreteMethod) || "USINADO"
  );
  const matchedInitialCity =
    REGIONAL_CITY_MULTIPLIERS.find(
      (c) =>
        c.cityName.toLowerCase() === initialCityName.toLowerCase() &&
        c.stateCode.toLowerCase() === initialStateCode.toLowerCase()
    ) ?? REGIONAL_CITY_MULTIPLIERS[0];

  const [selectedCityKey, setSelectedCityKey] = useState<string>(matchedInitialCity.key);
  const [laborPctInput, setLaborPctInput] = useState<string>(
    String(Math.round((initialLaborFactor || 1.0) * 100))
  );
  const [materialPctInput, setMaterialPctInput] = useState<string>(
    String(Math.round((initialMaterialFactor || 1.0) * 100))
  );
  const [includeUserEdited, setIncludeUserEdited] = useState(false);
  const [selectedStages, setSelectedStages] = useState<Set<string> | null>(null);

  const [preview, setPreview] = useState<TriagePreviewResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeCity =
    REGIONAL_CITY_MULTIPLIERS.find((c) => c.key === selectedCityKey) ??
    REGIONAL_CITY_MULTIPLIERS[0];

  function handleCityChange(key: string) {
    setSelectedCityKey(key);
    const found = REGIONAL_CITY_MULTIPLIERS.find((c) => c.key === key);
    if (found) {
      setLaborPctInput(String(Math.round(found.regionalLaborFactor * 100)));
      setMaterialPctInput(String(Math.round(found.regionalMaterialFactor * 100)));
    }
  }

  async function requestPreview(
    nextIncludeEdited = includeUserEdited,
    nextStages: Set<string> | null = selectedStages
  ) {
    setLoadingPreview(true);
    setStatusMessage(null);
    try {
      const laborFactor = Math.max(0.5, Math.min(3.0, (Number(laborPctInput) || 100) / 100));
      const materialFactor = Math.max(
        0.5,
        Math.min(3.0, (Number(materialPctInput) || 100) / 100)
      );

      const res = await fetch(`/api/eap/projects/${projectId}/apply-standard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PREVIEW",
          targetStandard,
          cityName: activeCity.cityName,
          stateCode: activeCity.stateCode,
          regionalLaborFactor: laborFactor,
          regionalMaterialFactor: materialFactor,
          selectedStageCodes: nextStages ? Array.from(nextStages) : undefined,
          includeUserEdited: nextIncludeEdited,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatusMessage(json.error || "Erro ao simular triagem multi-padrão.");
        return;
      }
      const triage = json.triage as TriagePreviewResult;
      setPreview(triage);
      if (!nextStages) {
        setSelectedStages(new Set(triage.stages.map((s) => s.stageCode)));
      }
      setShowModal(true);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleApplyStandard() {
    setApplying(true);
    setStatusMessage(null);
    try {
      const laborFactor = Math.max(0.5, Math.min(3.0, (Number(laborPctInput) || 100) / 100));
      const materialFactor = Math.max(
        0.5,
        Math.min(3.0, (Number(materialPctInput) || 100) / 100)
      );

      const res = await fetch(`/api/eap/projects/${projectId}/apply-standard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPLY",
          targetStandard,
          cityName: activeCity.cityName,
          stateCode: activeCity.stateCode,
          regionalLaborFactor: laborFactor,
          regionalMaterialFactor: materialFactor,
          selectedStageCodes: selectedStages ? Array.from(selectedStages) : undefined,
          includeUserEdited,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatusMessage(json.error || "Erro ao aplicar padrão construtivo.");
        return;
      }
      const triage = json.triage as TriagePreviewResult;
      setShowModal(false);
      setStatusMessage(
        `Padrão ${CONSTRUCTION_STANDARD_LABELS[targetStandard]} (${activeCity.cityName}/${activeCity.stateCode}) aplicado: ${triage.updatedItemsCount} item(ns) atualizados (${triage.preservedEditedCount} editado(s) preservados).`
      );
      await onApplied();
    } finally {
      setApplying(false);
    }
  }

  const highDiffStages = (preview?.stages ?? []).filter(
    (s) => s.tier === "ACABAMENTO_NOBRE"
  );
  const structuralStages = (preview?.stages ?? []).filter(
    (s) => s.tier !== "ACABAMENTO_NOBRE"
  );

  async function handleConcreteMethodToggle(nextMethod: ConcreteMethod) {
    if (nextMethod === concreteMethod || applying) return;
    setConcreteMethod(nextMethod);
    setApplying(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/apply-standard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPLY",
          targetStandard,
          concreteMethod: nextMethod,
          updateConcreteMethodOnly: true,
          cityName: activeCity.cityName,
          stateCode: activeCity.stateCode,
          regionalLaborFactor: Math.max(0.5, Math.min(3.0, (Number(laborPctInput) || 100) / 100)),
          regionalMaterialFactor: Math.max(0.5, Math.min(3.0, (Number(materialPctInput) || 100) / 100)),
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setStatusMessage(
          `Concretagem alterada para ${CONCRETE_METHOD_LABELS[nextMethod]} (${json.updatedCount ?? 0} item(ns) convertidos).`
        );
        await onApplied();
      } else {
        setStatusMessage(json.error || "Erro ao converter modalidade de concretagem.");
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Card className="rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-xs dark:border-zinc-800 dark:bg-[#16161D]/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
              Padrão Construtivo:
            </span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              {(["BAIXO_PADRAO", "MEDIO_PADRAO", "ALTO_PADRAO"] as const).map((std) => (
                <button
                  key={std}
                  type="button"
                  onClick={() => setTargetStandard(std)}
                  className={`h-7 rounded-lg px-3 text-[11px] font-semibold transition cursor-pointer ${
                    targetStandard === std
                      ? "bg-slate-900 text-white shadow-xs dark:bg-amber-500 dark:text-zinc-950"
                      : "text-slate-700 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
                  }`}
                >
                  {CONSTRUCTION_STANDARD_LABELS[std]}
                </button>
              ))}
            </div>

            <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
              Concretagem:
            </span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              {(["USINADO", "IN_LOCO_BETONEIRA"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={applying}
                  onClick={() => void handleConcreteMethodToggle(m)}
                  className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition cursor-pointer ${
                    concreteMethod === m
                      ? "bg-emerald-700 text-white shadow-xs dark:bg-emerald-500 dark:text-zinc-950"
                      : "text-slate-700 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
                  }`}
                >
                  {m === "USINADO" ? "Usinado" : "In Loco (Betoneira)"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Praça:
                <select
                  value={selectedCityKey}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="ml-1.5 h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {REGIONAL_CITY_MULTIPLIERS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.cityName}/{c.stateCode} (MO {Math.round(c.regionalLaborFactor * 100)}% · Mat{" "}
                      {Math.round(c.regionalMaterialFactor * 100)}%)
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                % MO Local:
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={laborPctInput}
                  onChange={(e) => setLaborPctInput(e.target.value)}
                  className="h-8 w-16 rounded-xl border border-slate-300 bg-white px-2 text-center font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>

              <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                % Mat.:
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={materialPctInput}
                  onChange={(e) => setMaterialPctInput(e.target.value)}
                  className="h-8 w-16 rounded-xl border border-slate-300 bg-white px-2 text-center font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void requestPreview()}
            disabled={loadingPreview}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {loadingPreview ? "Calculando Triagem..." : "🎯 Triagem & Aplicar Padrão"}
          </button>
        </div>

        {statusMessage && (
          <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {statusMessage}
          </p>
        )}
      </Card>

      {/* Modal de Pré-Visualização da Triagem Inteligente */}
      {showModal && preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização de Triagem Multi-Padrão"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <Card className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="blue">Triagem Inteligente Multi-Padrão</Badge>
                  <Badge tone="neutral">
                    {activeCity.cityName}/{activeCity.stateCode}
                  </Badge>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-zinc-100">
                  {CONSTRUCTION_STANDARD_LABELS[preview.currentStandard]} →{" "}
                  {CONSTRUCTION_STANDARD_LABELS[preview.targetStandard]}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-8 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Comparativo Lado a Lado */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Valor Atual (c/ BDI)</p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                    {fmtBRL(preview.currentTotalWithBdi)}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
                  <p className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">
                    Novo Valor ({CONSTRUCTION_STANDARD_LABELS[preview.targetStandard]})
                  </p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-blue-900 dark:text-blue-200">
                    {fmtBRL(preview.projectedTotalWithBdi)}
                  </p>
                  <p className="font-mono text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                    {preview.deltaPercent >= 0 ? "+" : ""}
                    {preview.deltaPercent.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Material (Novo)</p>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                    {fmtBRL(preview.projectedMaterialTotal)}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500">
                    Atual: {fmtBRL(preview.currentMaterialTotal)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Mão de Obra (Novo)</p>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {fmtBRL(preview.projectedLaborTotal)}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500">
                    Atual: {fmtBRL(preview.currentLaborTotal)}
                  </p>
                </div>
              </div>

              {/* Proteção de Edições Manuais */}
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Escopo de Aplicação:
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-zinc-200">
                  <input
                    type="radio"
                    checked={!includeUserEdited}
                    onChange={() => {
                      setIncludeUserEdited(false);
                      void requestPreview(false, selectedStages);
                    }}
                  />
                  <span>
                    Aplicar apenas em não editados (preservar{" "}
                    <strong>{preview.preservedEditedCount}</strong> manuais)
                  </span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-zinc-200">
                  <input
                    type="radio"
                    checked={includeUserEdited}
                    onChange={() => {
                      setIncludeUserEdited(true);
                      void requestPreview(true, selectedStages);
                    }}
                  />
                  <span>Aplicar em toda a planilha (incluindo editados)</span>
                </label>
              </div>

              {/* Etapas Agrupadas por Sensibilidade */}
              {[
                {
                  title: "Grupo 3 — Etapas de Alta Variação (Acabamentos, Pedras, Esquadrias & Louças)",
                  rows: highDiffStages,
                },
                {
                  title: "Grupos 1 & 2 — Etapas Estruturais, Brutas & Contrapiso (Variação Controlada)",
                  rows: structuralStages,
                },
              ].map((grp) => (
                <div key={grp.title} className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    {grp.title}
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:bg-zinc-950 dark:text-zinc-400">
                        <tr>
                          <th className="px-3 py-2 w-8">Aplicar</th>
                          <th className="px-3 py-2">Etapa</th>
                          <th className="px-3 py-2 text-right">Atual (Direto)</th>
                          <th className="px-3 py-2 text-right">Novo (Direto)</th>
                          <th className="px-3 py-2 text-right">Variação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {grp.rows.map((st) => {
                          const checked = selectedStages
                            ? selectedStages.has(st.stageCode)
                            : true;
                          return (
                            <tr key={st.stageCode} className="text-slate-800 dark:text-zinc-200">
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = new Set(
                                      selectedStages ?? preview.stages.map((s) => s.stageCode)
                                    );
                                    if (checked) next.delete(st.stageCode);
                                    else next.add(st.stageCode);
                                    setSelectedStages(next);
                                    void requestPreview(includeUserEdited, next);
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2 font-medium">
                                <span className="font-mono text-slate-500">{st.stageCode}</span> —{" "}
                                {st.stageName}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {fmtBRL(st.currentDirectTotal)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                                {fmtBRL(st.projectedDirectTotal)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                                {st.deltaPercent >= 0 ? "+" : ""}
                                {st.deltaPercent.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-zinc-800">
              <span className="text-xs text-slate-600 dark:text-zinc-400">
                <strong>{preview.updatedItemsCount}</strong> item(ns) serão atualizados ·{" "}
                <strong>{preview.preservedEditedCount}</strong> editado(s) preservado(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleApplyStandard()}
                  disabled={applying}
                  className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {applying ? "Aplicando na EAP..." : "✓ Confirmar e Atualizar Planilha EAP"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
