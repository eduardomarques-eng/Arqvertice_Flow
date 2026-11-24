"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ComputedEapItemDTO,
  ComputedEapStageDTO,
  ConferenceGateResult,
  EapTreeIndicatorsDTO,
} from "@/server/eap/workbench";

interface EapTreeResponse {
  id: string;
  projectId: string;
  cityId: string;
  cityLabel: string;
  title: string;
  builtAreaM2: number;
  bdiPercent: number;
  plannedStartDate: string | null;
  status: string;
  currentRevision: number;
  premises: string[];
  exclusions: string[];
  zones: Array<{ id: string; code: string; name: string; orderIndex: number }>;
  stages: ComputedEapStageDTO[];
  indicators: EapTreeIndicatorsDTO;
  conferenceGate: ConferenceGateResult;
}

interface CatalogMaterialOption {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  defaultLossPercent: number;
  eapStageCode: string;
  materialUnitCost: number;
  thirdPartyUnitCost: number;
}

type QuickFilter = "ALL" | "WITH_QTY" | "NO_PRICE" | "SANITY" | "MODIFIED";

const INPUT_NUM =
  "h-7 w-16 rounded-lg border border-slate-300 bg-white px-1.5 text-right font-mono text-[11px] tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

const INPUT_TEXT =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function EapConferenceWorkbench({
  projectId,
  cityId,
  onValidated,
}: {
  projectId: string;
  cityId: string;
  onValidated?: () => void;
}) {
  const [tree, setTree] = useState<EapTreeResponse | null>(null);
  const [catalogMaterials, setCatalogMaterials] = useState<CatalogMaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [gateBlockers, setGateBlockers] = useState<string[]>([]);

  // Filtros e expansão
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QuickFilter>("ALL");
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [globalBdiInput, setGlobalBdiInput] = useState("22");

  // Modal + Adicionar Item / Material
  const [showAddModal, setShowAddModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [newItem, setNewItem] = useState({
    stageCode: "04",
    newGroupName: "",
    materialCatalogId: "",
    code: "",
    description: "",
    unit: "m²",
    category: "ALVENARIA",
    FUND_TERREO: "0",
    PAV_SUPERIOR: "0",
    COBERTURA: "0",
    EXTERNO: "0",
    lossPercent: "5",
    materialUnitCost: "0",
    laborUnitCost: "0",
    thirdPartyUnitCost: "0",
    teamsCount: "1",
    saveToCityCatalog: false,
  });

  // Premissas & Exclusões
  const [showPremises, setShowPremises] = useState(false);
  const [premisesText, setPremisesText] = useState("");
  const [exclusionsText, setExclusionsText] = useState("");

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, matRes] = await Promise.all([
        fetch(`/api/eap/projects/${projectId}/tree`, { cache: "no-store" }),
        fetch(`/api/eap/catalog/materials?cityId=${encodeURIComponent(cityId)}`, { cache: "no-store" }),
      ]);
      const [treeJson, matJson] = await Promise.all([treeRes.json(), matRes.json()]);
      if (treeJson.ok && treeJson.tree) {
        const t = treeJson.tree as EapTreeResponse;
        setTree(t);
        setGlobalBdiInput(String(t.bdiPercent));
        setPremisesText(t.premises.join("\n"));
        setExclusionsText(t.exclusions.join("\n"));
        setExpandedStages((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const initial: Record<string, boolean> = {};
          for (const st of t.stages) {
            initial[st.code] = st.itemsCount > 0;
          }
          return initial;
        });
      }
      if (matJson.ok && Array.isArray(matJson.items)) {
        setCatalogMaterials(matJson.items);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, cityId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogMaterials.slice(0, 12);
    return catalogMaterials
      .filter((m) => `${m.code} ${m.name} ${m.category}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [catalogMaterials, catalogSearch]);

  function matchesFilter(item: ComputedEapItemDTO): boolean {
    const q = search.trim().toLowerCase();
    if (q && !`${item.code || ""} ${item.description} ${item.sourceSoftware}`.toLowerCase().includes(q)) {
      return false;
    }
    if (filter === "WITH_QTY") return item.totalQtyWithLoss > 0;
    if (filter === "NO_PRICE") return item.totalQtyWithLoss > 0 && item.unitDirectCost <= 0;
    if (filter === "SANITY") return Boolean(item.sanityFlag);
    if (filter === "MODIFIED") return item.revisionTag !== "ORIGINAL";
    return true;
  }

  const [viewMode, setViewMode] = useState<"EXECUTIVE" | "DETAILED">("EXECUTIVE");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  function updateLocalItem(itemId: string, updater: (item: ComputedEapItemDTO) => ComputedEapItemDTO) {
    setTree((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((st) => ({
          ...st,
          groups: st.groups.map((g) => ({
            ...g,
            items: g.items.map((it) => (it.id === itemId ? updater(it) : it)),
          })),
        })),
      };
    });
  }

  async function saveInlineItem(item: ComputedEapItemDTO, extra?: { clearSanityFlag?: boolean }) {
    setSavingId(item.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: item.description,
          unit: item.unit,
          zoneQuantities: item.zoneQuantities,
          lossPercent: item.lossPercent,
          materialUnitCost: item.materialUnitCost,
          laborUnitCost: item.laborUnitCost,
          thirdPartyUnitCost: item.thirdPartyUnitCost,
          markupMultiplier: item.markupMultiplier,
          teamsCount: item.teamsCount,
          clearSanityFlag: extra?.clearSanityFlag,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar item." });
        return;
      }
      setFeedback({ type: "success", text: `Item "${item.description.slice(0, 42)}" atualizado.` });
      await loadTree();
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(itemId: string) {
    setSavingId(itemId);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setFeedback({ type: "success", text: "Item removido da EAP." });
        await loadTree();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setSavingId("add-item");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageCode: newItem.stageCode,
          groupId: selectedGroupId || undefined,
          newGroupName: selectedGroupId ? undefined : newItem.newGroupName.trim() || undefined,
          materialCatalogId: newItem.materialCatalogId || null,
          code: newItem.code.trim() || null,
          description: newItem.description.trim(),
          unit: newItem.unit.trim(),
          category: newItem.category,
          zoneQuantities: {
            FUND_TERREO: Number(newItem.FUND_TERREO) || 0,
            PAV_SUPERIOR: Number(newItem.PAV_SUPERIOR) || 0,
            COBERTURA: Number(newItem.COBERTURA) || 0,
            EXTERNO: Number(newItem.EXTERNO) || 0,
          },
          lossPercent: Number(newItem.lossPercent) || 0,
          materialUnitCost: Number(newItem.materialUnitCost) || 0,
          laborUnitCost: Number(newItem.laborUnitCost) || 0,
          thirdPartyUnitCost: Number(newItem.thirdPartyUnitCost) || 0,
          teamsCount: Number(newItem.teamsCount) || 1,
          saveToCityCatalog: newItem.saveToCityCatalog,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao adicionar item." });
        return;
      }
      setShowAddModal(false);
      setSelectedGroupId(null);
      setExpandedStages((prev) => ({ ...prev, [newItem.stageCode]: true }));
      setFeedback({ type: "success", text: "Novo item adicionado à planilha EAP." });
      await loadTree();
    } finally {
      setSavingId(null);
    }
  }

  async function handleApplyGlobalBdi() {
    const val = Number(globalBdiInput);
    if (!Number.isFinite(val) || val < 0) return;
    setSavingId("bdi");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bdiPercent: val, applyBdiToAllItems: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao aplicar BDI global." });
        return;
      }
      setFeedback({ type: "success", text: `BDI Global (${val}%) aplicado em lote a todos os itens.` });
      await loadTree();
    } finally {
      setSavingId(null);
    }
  }

  async function handleSavePremises() {
    setSavingId("premises");
    try {
      const premises = premisesText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const exclusions = exclusionsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const res = await fetch(`/api/eap/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premisesJson: premises, exclusionsJson: exclusions }),
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Premissas e Exclusões salvas." });
        await loadTree();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleValidateConference() {
    setSavingId("validate");
    setFeedback(null);
    setGateBlockers([]);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/validate-conference`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.approved) {
        setGateBlockers(Array.isArray(json.blockers) ? json.blockers : [json.error || "Pendências encontradas."]);
        setFeedback({ type: "error", text: "Conferência bloqueada: resolva os itens listados abaixo." });
        return;
      }
      setFeedback({
        type: "success",
        text: "Conferência da EAP homologada (CONFERENCIA_OK)! Aba Planejamento liberada.",
      });
      await loadTree();
      onValidated?.();
    } finally {
      setSavingId(null);
    }
  }

  function toggleAllStages(expand: boolean) {
    if (!tree) return;
    const next: Record<string, boolean> = {};
    for (const st of tree.stages) next[st.code] = expand;
    setExpandedStages(next);
  }

  if (loading || !tree) {
    return (
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
        Carregando Mesa de Conferência da EAP...
      </Card>
    );
  }

  const ind = tree.indicators;

  return (
    <div className="space-y-5">
      {/* KPIs & Indicadores de Engenharia em Tempo Real */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Investimento Total (Comercial)
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtBRL(ind.totalCommercialPrice)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
            {fmtBRL(ind.costPerM2)} / m² ({ind.builtAreaM2} m²)
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Custo Direto Interno
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtBRL(ind.totalDirectCost)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-zinc-400">
            Direto: {fmtBRL(ind.directCostPerM2)} / m² · BDI {tree.bdiPercent}%
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Composição Material × MO × Terceiros
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-xs font-bold tabular-nums">
            <span className="text-blue-700 dark:text-blue-400">Mat {ind.materialSharePercent}%</span>
            <span className="text-emerald-700 dark:text-emerald-400">MO {ind.laborSharePercent}%</span>
            <span className="text-amber-700 dark:text-amber-400">Terc {ind.thirdPartySharePercent}%</span>
          </div>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div style={{ width: `${ind.materialSharePercent}%` }} className="bg-blue-600" />
            <div style={{ width: `${ind.laborSharePercent}%` }} className="bg-emerald-500" />
            <div style={{ width: `${ind.thirdPartySharePercent}%` }} className="bg-amber-500" />
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Indicadores de Engenharia
          </p>
          <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums text-slate-800 dark:text-zinc-200">
            <div className="flex justify-between">
              <span>Taxa de Aço:</span>
              <span className="font-bold">{ind.steelRateKgPerM3} kg/m³</span>
            </div>
            <div className="flex justify-between">
              <span>Concreto / m²:</span>
              <span className="font-bold">{ind.concreteM3PerM2} m³/m²</span>
            </div>
            <div className="flex justify-between">
              <span>Alvenaria / m²:</span>
              <span className="font-bold">{ind.masonryM2PerM2} m²/m²</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Ferramentas & Filtros */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item por código ou descrição..."
              className={`${INPUT_TEXT} w-60`}
            />
            {(
              [
                { id: "ALL", label: "Todos" },
                { id: "WITH_QTY", label: "Qtd > 0" },
                { id: "NO_PRICE", label: `Sem Preço (${tree.conferenceGate.summary.itemsWithoutPriceCount})` },
                { id: "SANITY", label: `Alertas (${tree.conferenceGate.summary.sanityAlertsCount})` },
                { id: "MODIFIED", label: "Alterados" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`h-8 rounded-xl px-3 text-[11px] font-semibold cursor-pointer ${
                  filter === chip.id
                    ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">BDI %</span>
              <input
                type="number"
                step="0.5"
                value={globalBdiInput}
                onChange={(e) => setGlobalBdiInput(e.target.value)}
                className="w-14 bg-transparent text-right font-mono text-xs font-bold text-slate-900 focus:outline-none dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleApplyGlobalBdi}
                disabled={savingId === "bdi"}
                className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
              >
                Aplicar
              </button>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setViewMode("EXECUTIVE")}
                className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer ${
                  viewMode === "EXECUTIVE"
                    ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                    : "text-slate-600 dark:text-zinc-300"
                }`}
              >
                Planilha Executiva
              </button>
              <button
                type="button"
                onClick={() => setViewMode("DETAILED")}
                className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer ${
                  viewMode === "DETAILED"
                    ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                    : "text-slate-600 dark:text-zinc-300"
                }`}
              >
                Composição Interna
              </button>
            </div>
            <button
              type="button"
              onClick={() => toggleAllStages(true)}
              className="h-8 rounded-xl border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
            >
              Expandir
            </button>
            <button
              type="button"
              onClick={() => toggleAllStages(false)}
              className="h-8 rounded-xl border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
            >
              Recolher
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedGroupId(null);
                setShowAddModal(true);
              }}
              className="h-8 rounded-xl bg-slate-900 px-3 text-[11px] font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              + Adicionar Item / Material
            </button>
            <button
              type="button"
              onClick={handleValidateConference}
              disabled={savingId === "validate"}
              className="h-8 rounded-xl bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              {savingId === "validate" ? "Validando..." : "✓ Validar Conferência da EAP"}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {gateBlockers.length > 0 && (
          <ul className="list-disc rounded-xl border border-rose-200 bg-rose-50/70 px-6 py-2.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {gateBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Planilha Executiva Hierárquica (CUSTO_AC — 3 Níveis + Cabeçalho Sticky Corporativo) */}
      <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="max-h-[760px] overflow-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-20 bg-slate-900 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm dark:bg-zinc-950">
              <tr>
                <th className="px-2.5 py-3 whitespace-nowrap">Item</th>
                <th className="px-2 py-3 whitespace-nowrap">Código</th>
                <th className="px-3 py-3 min-w-[260px]">Discriminação dos Serviços</th>
                <th className="px-1.5 py-3 text-center whitespace-nowrap">Unid</th>
                <th className="px-1.5 py-3 text-right whitespace-nowrap">Qtd. Térreo</th>
                <th className="px-1.5 py-3 text-right whitespace-nowrap">Qtd. Superior</th>
                <th className="px-1.5 py-3 text-right whitespace-nowrap">Qtd. Coberta</th>
                <th className="px-1.5 py-3 text-right whitespace-nowrap">Qtd. Externo</th>
                {viewMode === "DETAILED" && (
                  <>
                    <th className="px-1.5 py-3 text-right whitespace-nowrap">Perda%</th>
                    <th className="px-1.5 py-3 text-right whitespace-nowrap">Mat R$</th>
                    <th className="px-1.5 py-3 text-right whitespace-nowrap">MO R$</th>
                    <th className="px-1.5 py-3 text-right whitespace-nowrap">Terc R$</th>
                    <th className="px-1.5 py-3 text-right whitespace-nowrap">M.Up</th>
                    <th className="px-1.5 py-3 text-right whitespace-nowrap">Eq.</th>
                  </>
                )}
                <th className="px-2 py-3 text-right whitespace-nowrap">Qtd. Total</th>
                <th className="px-2 py-3 text-right whitespace-nowrap">Pr. Unitário</th>
                <th className="px-2.5 py-3 text-right whitespace-nowrap">Pr. Total</th>
                <th className="px-2 py-3 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {tree.stages.map((stage) => {
                const isOpen = Boolean(expandedStages[stage.code]);
                const stageFilteredItems = stage.groups.flatMap((g) => g.items.filter(matchesFilter));
                if ((search || filter !== "ALL") && stageFilteredItems.length === 0) return null;
                const totalCols = viewMode === "DETAILED" ? 18 : 12;

                return (
                  <Fragment key={stage.id}>
                    {/* Nível 1: Macro-Etapa */}
                    <tr
                      onClick={() =>
                        setExpandedStages((prev) => ({ ...prev, [stage.code]: !prev[stage.code] }))
                      }
                      className="cursor-pointer bg-slate-100/95 hover:bg-slate-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800/90"
                    >
                      <td className="px-2.5 py-2.5 font-mono font-bold text-slate-950 dark:text-amber-400">
                        {isOpen ? "▼" : "▶"} {stage.code}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500">ETAPA</td>
                      <td colSpan={totalCols - 4} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-950 dark:text-zinc-100">
                            {stage.name}
                          </span>
                          <Badge tone="neutral">{stage.itemsCount} item(ns)</Badge>
                          <span className="font-mono text-[10px] font-semibold text-blue-700 dark:text-amber-400">
                            {stage.weightPercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td colSpan={2} className="px-2.5 py-2.5 text-right font-mono text-xs font-extrabold tabular-nums text-slate-950 dark:text-zinc-100 whitespace-nowrap">
                        {fmtBRL(stage.totalCommercialPrice)}
                      </td>
                    </tr>

                    {/* Nível 2 & 3: Subgrupos e Serviços */}
                    {isOpen &&
                      stage.groups.map((group) => {
                        const groupItems = group.items.filter(matchesFilter);
                        if ((search || filter !== "ALL") && groupItems.length === 0) return null;

                        return (
                          <Fragment key={group.id}>
                            <tr className="bg-slate-50/90 dark:bg-zinc-950/60">
                              <td className="px-2.5 py-1.5 pl-4 font-mono text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                                {group.code}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-[10px] text-slate-400">—</td>
                              <td colSpan={totalCols - 4} className="px-3 py-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                                    {group.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedGroupId(group.id);
                                      setNewItem((prev) => ({
                                        ...prev,
                                        stageCode: stage.code,
                                        newGroupName: "",
                                      }));
                                      setShowAddModal(true);
                                    }}
                                    className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                                  >
                                    + Adicionar Serviço
                                  </button>
                                </div>
                              </td>
                              <td colSpan={2} className="px-2.5 py-1.5 text-right font-mono text-[11px] font-bold tabular-nums text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                {fmtBRL(group.totalCommercialPrice)}
                              </td>
                            </tr>

                            {groupItems.map((item, itemIdx) => (
                              <tr
                                key={item.id}
                                className={`text-slate-800 hover:bg-slate-50/70 dark:text-zinc-200 dark:hover:bg-zinc-900/40 ${
                                  item.sanityFlag ? "bg-rose-50/60 dark:bg-rose-950/20" : ""
                                }`}
                              >
                                <td className="px-2.5 py-2 pl-6 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                  {group.code}.{itemIdx + 1}
                                </td>
                                <td className="px-2 py-2 font-mono text-[10px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                                  {item.code || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-slate-900 dark:text-zinc-100">
                                    {item.description}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <Badge tone="neutral">
                                      {item.sourceSoftware}
                                      {item.sourcePage ? ` p.${item.sourcePage}` : ""}
                                    </Badge>
                                    {item.revisionTag !== "ORIGINAL" && (
                                      <Badge
                                        tone={
                                          item.revisionTag === "ADICIONADO"
                                            ? "green"
                                            : item.revisionTag === "QUANTIDADE_ALTERADA"
                                              ? "blue"
                                              : "amber"
                                        }
                                      >
                                        {item.revisionTag}
                                      </Badge>
                                    )}
                                    {item.sanityFlag && (
                                      <button
                                        type="button"
                                        onClick={() => saveInlineItem(item, { clearSanityFlag: true })}
                                        title={item.sanityFlag}
                                        className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                                      >
                                        ⚠ Confirmar Valor
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-1.5 py-2 text-center font-mono">{item.unit}</td>
                                {(["FUND_TERREO", "PAV_SUPERIOR", "COBERTURA", "EXTERNO"] as const).map((zKey) => (
                                  <td key={zKey} className="px-1 py-1.5 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.zoneQuantities[zKey]}
                                      onChange={(e) =>
                                        updateLocalItem(item.id, (curr) => ({
                                          ...curr,
                                          zoneQuantities: {
                                            ...curr.zoneQuantities,
                                            [zKey]: Number(e.target.value),
                                          },
                                        }))
                                      }
                                      className={INPUT_NUM}
                                    />
                                  </td>
                                ))}
                                {viewMode === "DETAILED" && (
                                  <>
                                    <td className="px-1 py-1.5 text-right">
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={item.lossPercent}
                                        onChange={(e) =>
                                          updateLocalItem(item.id, (curr) => ({
                                            ...curr,
                                            lossPercent: Number(e.target.value),
                                          }))
                                        }
                                        className={`${INPUT_NUM} w-12`}
                                      />
                                    </td>
                                    <td className="px-1 py-1.5 text-right">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.materialUnitCost}
                                        onChange={(e) =>
                                          updateLocalItem(item.id, (curr) => ({
                                            ...curr,
                                            materialUnitCost: Number(e.target.value),
                                          }))
                                        }
                                        className={INPUT_NUM}
                                      />
                                    </td>
                                    <td className="px-1 py-1.5 text-right">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.laborUnitCost}
                                        onChange={(e) =>
                                          updateLocalItem(item.id, (curr) => ({
                                            ...curr,
                                            laborUnitCost: Number(e.target.value),
                                          }))
                                        }
                                        className={INPUT_NUM}
                                      />
                                    </td>
                                    <td className="px-1 py-1.5 text-right">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.thirdPartyUnitCost}
                                        onChange={(e) =>
                                          updateLocalItem(item.id, (curr) => ({
                                            ...curr,
                                            thirdPartyUnitCost: Number(e.target.value),
                                          }))
                                        }
                                        className={INPUT_NUM}
                                      />
                                    </td>
                                    <td className="px-1 py-1.5 text-right">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.markupMultiplier}
                                        onChange={(e) =>
                                          updateLocalItem(item.id, (curr) => ({
                                            ...curr,
                                            markupMultiplier: Number(e.target.value),
                                          }))
                                        }
                                        className={`${INPUT_NUM} w-14`}
                                      />
                                    </td>
                                    <td className="px-1 py-1.5 text-right">
                                      <input
                                        type="number"
                                        min={1}
                                        value={item.teamsCount}
                                        onChange={(e) =>
                                          updateLocalItem(item.id, (curr) => ({
                                            ...curr,
                                            teamsCount: Math.max(1, Number(e.target.value)),
                                          }))
                                        }
                                        className={`${INPUT_NUM} w-12`}
                                      />
                                    </td>
                                  </>
                                )}
                                <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                                  {item.totalQtyWithLoss.toFixed(2)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-zinc-300">
                                  {fmtBRL(item.unitCommercialPrice)}
                                </td>
                                <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                                  {fmtBRL(item.totalCommercialPrice)}
                                </td>
                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                  <div className="inline-flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => saveInlineItem(item)}
                                      disabled={savingId === item.id}
                                      className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                                    >
                                      {savingId === item.id ? "..." : "Salvar"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteItem(item.id)}
                                      disabled={savingId === item.id}
                                      className="rounded-lg border border-rose-300 px-1.5 py-1 text-[10px] font-semibold text-rose-600 cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    {isOpen && stageFilteredItems.length === 0 && (
                      <tr>
                        <td colSpan={totalCols} className="px-4 py-3 text-center text-slate-400">
                          Nenhum serviço cadastrado nesta etapa. Use &quot;+ Adicionar Serviço&quot; ou &quot;+ Adicionar Item / Material&quot;.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Editor Colapsável de Premissas & Exclusões da Proposta */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <button
          type="button"
          onClick={() => setShowPremises((v) => !v)}
          className="flex w-full items-center justify-between text-left cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Premissas Técnicas & Itens Não Inclusos na Proposta
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Textos exibidos no Relatório Executivo do Cliente (Fase 5).
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
            {showPremises ? "Ocultar ▲" : "Editar ▼"}
          </span>
        </button>

        {showPremises && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Premissas (uma por linha)
                </label>
                <textarea
                  rows={5}
                  value={premisesText}
                  onChange={(e) => setPremisesText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Itens Não Inclusos / Exclusões (um por linha)
                </label>
                <textarea
                  rows={5}
                  value={exclusionsText}
                  onChange={(e) => setExclusionsText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSavePremises}
              disabled={savingId === "premises"}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              {savingId === "premises" ? "Salvando..." : "Salvar Premissas & Exclusões"}
            </button>
          </div>
        )}
      </Card>

      {/* Modal: + Adicionar Item / Material */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form
            onSubmit={handleAddItem}
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 dark:border-zinc-800 dark:bg-[#16161D]"
          >
            <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
              Adicionar Item / Material na EAP ({tree.cityLabel})
            </h3>

            {/* Busca rápida no Catálogo Regional */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Buscar no Catálogo Regional (opcional — preenche preço automaticamente)
              </label>
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Digite aço, concreto, porcelanato, porta..."
                className={`${INPUT_TEXT} mt-1 w-full`}
              />
              {filteredCatalog.length > 0 && (
                <div className="mt-1.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {filteredCatalog.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setNewItem((prev) => ({
                          ...prev,
                          materialCatalogId: m.id,
                          code: m.code,
                          description: m.name,
                          unit: m.unit,
                          category: m.category,
                          stageCode: m.eapStageCode,
                          lossPercent: String(m.defaultLossPercent),
                          materialUnitCost: String(m.materialUnitCost),
                          thirdPartyUnitCost: String(m.thirdPartyUnitCost),
                        }))
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {m.code} · {m.name.slice(0, 36)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Etapa EAP</label>
                <select
                  value={newItem.stageCode}
                  onChange={(e) => setNewItem({ ...newItem, stageCode: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full`}
                >
                  {tree.stages.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Descrição do Item / Serviço
                </label>
                <input
                  type="text"
                  required
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Unidade</label>
                <input
                  type="text"
                  required
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Perda (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newItem.lossPercent}
                  onChange={(e) => setNewItem({ ...newItem, lossPercent: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Material (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.materialUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, materialUnitCost: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Mão de Obra (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.laborUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, laborUnitCost: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(["FUND_TERREO", "PAV_SUPERIOR", "COBERTURA", "EXTERNO"] as const).map((zKey) => (
                <div key={zKey}>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    {zKey.replace("_", " ")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem[zKey]}
                    onChange={(e) => setNewItem({ ...newItem, [zKey]: e.target.value })}
                    className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Terceiros (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.thirdPartyUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, thirdPartyUnitCost: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={newItem.saveToCityCatalog}
                onChange={(e) => setNewItem({ ...newItem, saveToCityCatalog: e.target.checked })}
              />
              Salvar também no catálogo regional de {tree.cityLabel} para reutilização futura
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingId === "add-item"}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                {savingId === "add-item" ? "Adicionando..." : "Adicionar Item"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
