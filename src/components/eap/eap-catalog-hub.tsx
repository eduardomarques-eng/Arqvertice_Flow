"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  MasterEapStageTemplate,
  MasterLobPackageTemplate,
} from "@/server/eap/templates/residential-master";

export interface CityCatalogDTO {
  id: string;
  name: string;
  state: string;
  isDefault: boolean;
  active: boolean;
  defaultBdiPercent: number;
  regionalLaborFactor?: number;
  regionalMaterialFactor?: number;
  holidaysCount: number;
  materialPricesCount: number;
  laborPricesCount: number;
}

export interface MaterialCatalogDTO {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  defaultLossPercent: number;
  eapStageCode: string;
  sourceSoftwareHint: string;
  materialUnitCost: number;
  thirdPartyUnitCost: number;
  lowMaterialCost?: number;
  lowLaborCost?: number;
  midMaterialCost?: number;
  midLaborCost?: number;
  highMaterialCost?: number;
  highLaborCost?: number;
  sensitivityTier?: string;
  note: string | null;
}

export interface LaborCatalogDTO {
  id: string;
  code: string;
  name: string;
  unit: string;
  productivityUnit: string;
  dailyProductivityPerTeam: number;
  laborUnitCost: number;
  dailyTeamRate: number;
  socialChargesPercent: number;
}

export interface CityHolidayDTO {
  id: string;
  cityId: string;
  date: string;
  name: string;
  type: string;
}

interface EapCatalogHubProps {
  initialCities: CityCatalogDTO[];
  initialActiveCityId: string;
  initialMaterials: MaterialCatalogDTO[];
  initialLabor: LaborCatalogDTO[];
  initialHolidays: CityHolidayDTO[];
  masterStages: MasterEapStageTemplate[];
  masterPackages: MasterLobPackageTemplate[];
  defaultPremises: string[];
  defaultExclusions: string[];
}

type CatalogTab = "materials" | "labor" | "holidays" | "templates";

const INPUT_CLASS =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-amber-400";

const MATERIAL_CATEGORIES = [
  "ACO",
  "CONCRETO",
  "FORMAS",
  "ALVENARIA",
  "ESQUADRIAS",
  "REVESTIMENTOS",
  "IMPERMEABILIZACAO",
  "INSTALACOES",
  "PINTURA",
  "BANCADAS",
  "LOUCAS_METAIS",
  "IMPLANTACAO",
] as const;

export function EapCatalogHub({
  initialCities,
  initialActiveCityId,
  initialMaterials,
  initialLabor,
  initialHolidays,
  masterStages,
  masterPackages,
  defaultPremises,
  defaultExclusions,
}: EapCatalogHubProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>("materials");
  const [cities, setCities] = useState<CityCatalogDTO[]>(initialCities);
  const [activeCityId, setActiveCityId] = useState<string>(initialActiveCityId);
  const [materials, setMaterials] = useState<MaterialCatalogDTO[]>(initialMaterials);
  const [labor, setLabor] = useState<LaborCatalogDTO[]>(initialLabor);
  const [holidays, setHolidays] = useState<CityHolidayDTO[]>(initialHolidays);

  const [loadingCity, setLoadingCity] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filtros de Materiais
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");

  // Modal Nova Cidade / Clonar Tabela
  const [showCityModal, setShowCityModal] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [newCityState, setNewCityState] = useState("CE");
  const [newCityBdi, setNewCityBdi] = useState("22");
  const [cloneSourceId, setCloneSourceId] = useState(initialActiveCityId);
  const [cloneAdjustment, setCloneAdjustment] = useState("0");

  // Modal Novo Material
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [newMat, setNewMat] = useState({
    code: "",
    name: "",
    category: "ALVENARIA",
    unit: "m²",
    defaultLossPercent: "5",
    eapStageCode: "05",
    sourceSoftwareHint: "MANUAL" as "TQS" | "REVIT" | "MANUAL",
    materialUnitCost: "0",
    thirdPartyUnitCost: "0",
  });

  // Novo Feriado
  const [newHolidayDate, setNewHolidayDate] = useState("2026-08-15");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayType, setNewHolidayType] = useState<"NACIONAL" | "ESTADUAL" | "MUNICIPAL" | "RECESSO">("MUNICIPAL");

  const activeCity = useMemo(
    () => cities.find((c) => c.id === activeCityId) ?? null,
    [cities, activeCityId]
  );

  const filteredMaterials = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return materials.filter((m) => {
      if (categoryFilter !== "ALL" && m.category !== categoryFilter) return false;
      if (stageFilter !== "ALL" && m.eapStageCode !== stageFilter) return false;
      if (q && !`${m.code} ${m.name} ${m.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [materials, searchTerm, categoryFilter, stageFilter]);

  async function loadCityData(cityId: string) {
    setActiveCityId(cityId);
    setLoadingCity(true);
    setFeedback(null);
    try {
      const [matRes, labRes, holRes] = await Promise.all([
        fetch(`/api/eap/catalog/materials?cityId=${encodeURIComponent(cityId)}`, { cache: "no-store" }),
        fetch(`/api/eap/catalog/labor?cityId=${encodeURIComponent(cityId)}`, { cache: "no-store" }),
        fetch(`/api/eap/catalog/holidays?cityId=${encodeURIComponent(cityId)}`, { cache: "no-store" }),
      ]);
      const [matJson, labJson, holJson] = await Promise.all([matRes.json(), labRes.json(), holRes.json()]);
      if (matJson.ok) setMaterials(matJson.items);
      if (labJson.ok) setLabor(labJson.items);
      if (holJson.ok) {
        setHolidays(
          (holJson.holidays || []).map((h: { id: string; cityId: string; date: string; name: string; type: string }) => ({
            ...h,
            date: String(h.date).slice(0, 10),
          }))
        );
      }
    } catch {
      setFeedback({ type: "error", text: "Erro ao carregar tabelas da cidade selecionada." });
    } finally {
      setLoadingCity(false);
    }
  }

  async function handleCreateOrCloneCity(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSavingId("city");
    try {
      const res = await fetch("/api/eap/catalog/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCityName.trim(),
          state: newCityState.trim().toUpperCase(),
          defaultBdiPercent: Number(newCityBdi) || 22,
          cloneFromCityId: cloneSourceId || undefined,
          adjustmentPercent: Number(cloneAdjustment) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Falha ao criar cidade." });
        return;
      }
      const listRes = await fetch("/api/eap/catalog/cities", { cache: "no-store" });
      const listJson = await listRes.json();
      if (listJson.ok) {
        setCities(
          listJson.cities.map((c: CityCatalogDTO & { _count?: { holidays: number; materialPrices: number; laborPrices: number } }) => ({
            id: c.id,
            name: c.name,
            state: c.state,
            isDefault: c.isDefault,
            active: c.active,
            defaultBdiPercent: c.defaultBdiPercent,
            holidaysCount: c._count?.holidays ?? 0,
            materialPricesCount: c._count?.materialPrices ?? 0,
            laborPricesCount: c._count?.laborPrices ?? 0,
          }))
        );
      }
      setShowCityModal(false);
      setNewCityName("");
      setFeedback({ type: "success", text: `Cidade ${json.city.name}/${json.city.state} criada com sucesso.` });
      await loadCityData(json.city.id);
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveMaterialRow(item: MaterialCatalogDTO) {
    if (!activeCityId) return;
    setSavingId(item.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/eap/catalog/materials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: item.id,
          cityId: activeCityId,
          defaultLossPercent: Number(item.defaultLossPercent) || 0,
          materialUnitCost: Number(item.midMaterialCost ?? item.materialUnitCost) || 0,
          thirdPartyUnitCost: Number(item.thirdPartyUnitCost) || 0,
          lowMaterialCost: Number(item.lowMaterialCost) || 0,
          lowLaborCost: Number(item.lowLaborCost) || 0,
          midMaterialCost: Number(item.midMaterialCost ?? item.materialUnitCost) || 0,
          midLaborCost: Number(item.midLaborCost) || 0,
          highMaterialCost: Number(item.highMaterialCost) || 0,
          highLaborCost: Number(item.highLaborCost) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar preço do material." });
        return;
      }
      setFeedback({ type: "success", text: `Material ${item.code} atualizado em ${activeCity?.name}/${activeCity?.state}.` });
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCityId) return;
    setSavingId("new-mat");
    setFeedback(null);
    try {
      const res = await fetch("/api/eap/catalog/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId: activeCityId,
          code: newMat.code,
          name: newMat.name,
          category: newMat.category,
          unit: newMat.unit,
          defaultLossPercent: Number(newMat.defaultLossPercent) || 0,
          eapStageCode: newMat.eapStageCode,
          sourceSoftwareHint: newMat.sourceSoftwareHint,
          materialUnitCost: Number(newMat.materialUnitCost) || 0,
          thirdPartyUnitCost: Number(newMat.thirdPartyUnitCost) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao cadastrar material." });
        return;
      }
      setShowMaterialModal(false);
      setNewMat({
        code: "",
        name: "",
        category: "ALVENARIA",
        unit: "m²",
        defaultLossPercent: "5",
        eapStageCode: "05",
        sourceSoftwareHint: "MANUAL",
        materialUnitCost: "0",
        thirdPartyUnitCost: "0",
      });
      setFeedback({ type: "success", text: "Novo material adicionado ao catálogo." });
      await loadCityData(activeCityId);
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveLaborRow(item: LaborCatalogDTO) {
    if (!activeCityId) return;
    setSavingId(item.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/eap/catalog/labor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laborRoleId: item.id,
          cityId: activeCityId,
          dailyProductivityPerTeam: Number(item.dailyProductivityPerTeam) || 1,
          laborUnitCost: Number(item.laborUnitCost) || 0,
          dailyTeamRate: Number(item.dailyTeamRate) || 0,
          socialChargesPercent: Number(item.socialChargesPercent) || 85,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar mão de obra." });
        return;
      }
      setFeedback({ type: "success", text: `Função ${item.name} atualizada.` });
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCityId || !newHolidayName.trim()) return;
    setSavingId("new-holiday");
    try {
      const res = await fetch("/api/eap/catalog/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId: activeCityId,
          date: newHolidayDate,
          name: newHolidayName.trim(),
          type: newHolidayType,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setNewHolidayName("");
        setFeedback({ type: "success", text: "Feriado salvo no calendário regional." });
        await loadCityData(activeCityId);
      } else {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar feriado." });
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteHoliday(id: string) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/eap/catalog/holidays?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHolidays((prev) => prev.filter((h) => h.id !== id));
        setFeedback({ type: "success", text: "Feriado removido." });
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra Superior: Seletor de Cidade Base + Clonar */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Cidade Base (Tabela Regional)
              </label>
              <select
                value={activeCityId}
                onChange={(e) => loadCityData(e.target.value)}
                disabled={loadingCity || cities.length === 0}
                className={`${INPUT_CLASS} mt-1 min-w-[230px] font-semibold`}
              >
                {cities.length === 0 ? (
                  <option value="">Nenhuma cidade cadastrada (rode npm run seed:eap)</option>
                ) : (
                  cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} / {c.state} {c.isDefault ? "(Padrão)" : ""} — BDI {c.defaultBdiPercent}%
                    </option>
                  ))
                )}
              </select>
            </div>
            {activeCity && (
              <div className="flex flex-wrap items-center gap-2 pt-4">
                <Badge tone="blue">{materials.length} Materiais</Badge>
                <Badge tone="green">{labor.length} Equipes MO</Badge>
                <Badge tone="amber">{holidays.length} Feriados</Badge>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCloneSourceId(activeCityId);
                setShowCityModal(true);
              }}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
            >
              + Nova Cidade / Clonar Tabela %
            </button>
          </div>
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

      {/* Navegação por Abas */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "materials" as const, label: "Materiais Padronizados" },
          { id: "labor" as const, label: "Mão de Obra & Produtividade" },
          { id: "holidays" as const, label: "Feriados Locais" },
          { id: "templates" as const, label: "Template Mestre (26 Etapas & 38 Pacotes LOB)" },
        ].map((tab) => (
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

      {/* ABA 1 — MATERIAIS PADRONIZADOS */}
      {activeTab === "materials" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, nome ou categoria..."
                className={`${INPUT_CLASS} w-64`}
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="ALL">Todas as Categorias</option>
                {MATERIAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="ALL">Todas as Etapas (01–26)</option>
                {masterStages.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.code} — {st.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowMaterialModal(true)}
              disabled={!activeCityId}
              className="h-9 rounded-xl border border-slate-300 bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950"
            >
              + Novo Material
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2.5">Código / Etapa</th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="px-3 py-2.5">Un.</th>
                  <th className="px-3 py-2.5">Perda (%)</th>
                  <th className="px-3 py-2.5 text-center">Baixo Padrão (Mat / MO)</th>
                  <th className="px-3 py-2.5 text-center">Médio Padrão (Mat / MO)</th>
                  <th className="px-3 py-2.5 text-center">Alto Padrão (Mat / MO)</th>
                  <th className="px-3 py-2.5">Terceiros (R$)</th>
                  <th className="px-3 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredMaterials.map((item) => (
                  <tr key={item.id} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900 dark:text-zinc-100">{item.code}</div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                        Etapa {item.eapStageCode} · {item.sourceSoftwareHint}
                      </div>
                    </td>
                    <td className="px-3 py-2 min-w-[210px]">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {item.category} · {item.sensitivityTier ?? "ESTRUTURAL_BRUTO"}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{item.unit}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={item.defaultLossPercent}
                        onChange={(e) =>
                          setMaterials((prev) =>
                            prev.map((m) =>
                              m.id === item.id ? { ...m, defaultLossPercent: Number(e.target.value) } : m
                            )
                          )
                        }
                        className={`${INPUT_CLASS} w-16 text-right font-mono`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          title="Baixo Padrão — Material"
                          value={item.lowMaterialCost ?? 0}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, lowMaterialCost: Number(e.target.value) } : m
                              )
                            )
                          }
                          className={`${INPUT_CLASS} w-20 text-right font-mono`}
                        />
                        <input
                          type="number"
                          step="0.01"
                          title="Baixo Padrão — Mão de Obra"
                          value={item.lowLaborCost ?? 0}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, lowLaborCost: Number(e.target.value) } : m
                              )
                            )
                          }
                          className={`${INPUT_CLASS} w-20 text-right font-mono`}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          title="Médio Padrão — Material"
                          value={item.midMaterialCost ?? item.materialUnitCost}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((m) =>
                                m.id === item.id
                                  ? {
                                      ...m,
                                      midMaterialCost: Number(e.target.value),
                                      materialUnitCost: Number(e.target.value),
                                    }
                                  : m
                              )
                            )
                          }
                          className={`${INPUT_CLASS} w-20 text-right font-mono`}
                        />
                        <input
                          type="number"
                          step="0.01"
                          title="Médio Padrão — Mão de Obra"
                          value={item.midLaborCost ?? 0}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, midLaborCost: Number(e.target.value) } : m
                              )
                            )
                          }
                          className={`${INPUT_CLASS} w-20 text-right font-mono`}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          title="Alto Padrão — Material"
                          value={item.highMaterialCost ?? 0}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, highMaterialCost: Number(e.target.value) } : m
                              )
                            )
                          }
                          className={`${INPUT_CLASS} w-20 text-right font-mono`}
                        />
                        <input
                          type="number"
                          step="0.01"
                          title="Alto Padrão — Mão de Obra"
                          value={item.highLaborCost ?? 0}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, highLaborCost: Number(e.target.value) } : m
                              )
                            )
                          }
                          className={`${INPUT_CLASS} w-20 text-right font-mono`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.thirdPartyUnitCost}
                        onChange={(e) =>
                          setMaterials((prev) =>
                            prev.map((m) =>
                              m.id === item.id ? { ...m, thirdPartyUnitCost: Number(e.target.value) } : m
                            )
                          )
                        }
                        className={`${INPUT_CLASS} w-28 text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveMaterialRow(item)}
                        disabled={savingId === item.id}
                        className="h-8 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                      >
                        {savingId === item.id ? "Salvando..." : "Salvar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredMaterials.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-zinc-400">
                      Nenhum material encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA 2 — MÃO DE OBRA & PRODUTIVIDADE */}
      {activeTab === "labor" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2.5">Função / Equipe</th>
                  <th className="px-3 py-2.5">Produtividade Diária</th>
                  <th className="px-3 py-2.5">Custo Unit. MO (R$)</th>
                  <th className="px-3 py-2.5">Diária Equipe (R$)</th>
                  <th className="px-3 py-2.5">Encargos (%)</th>
                  <th className="px-3 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {labor.map((role) => (
                  <tr key={role.id} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">{role.name}</div>
                      <div className="font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                        {role.code} · {role.unit} ({role.productivityUnit})
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={role.dailyProductivityPerTeam}
                        onChange={(e) =>
                          setLabor((prev) =>
                            prev.map((r) =>
                              r.id === role.id
                                ? { ...r, dailyProductivityPerTeam: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className={`${INPUT_CLASS} w-24 text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={role.laborUnitCost}
                        onChange={(e) =>
                          setLabor((prev) =>
                            prev.map((r) =>
                              r.id === role.id ? { ...r, laborUnitCost: Number(e.target.value) } : r
                            )
                          )
                        }
                        className={`${INPUT_CLASS} w-28 text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="1"
                        value={role.dailyTeamRate}
                        onChange={(e) =>
                          setLabor((prev) =>
                            prev.map((r) =>
                              r.id === role.id ? { ...r, dailyTeamRate: Number(e.target.value) } : r
                            )
                          )
                        }
                        className={`${INPUT_CLASS} w-28 text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={role.socialChargesPercent}
                        onChange={(e) =>
                          setLabor((prev) =>
                            prev.map((r) =>
                              r.id === role.id
                                ? { ...r, socialChargesPercent: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className={`${INPUT_CLASS} w-20 text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveLaborRow(role)}
                        disabled={savingId === role.id}
                        className="h-8 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                      >
                        {savingId === role.id ? "Salvando..." : "Salvar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA 3 — FERIADOS LOCAIS */}
      {activeTab === "holidays" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <form onSubmit={handleAddHoliday} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Data</label>
              <input
                type="date"
                required
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className={`${INPUT_CLASS} mt-1`}
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Nome do Feriado / Recesso
              </label>
              <input
                type="text"
                required
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder="Ex.: Dia de São José, Padroeiro do Município..."
                className={`${INPUT_CLASS} mt-1 w-full`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Esfera</label>
              <select
                value={newHolidayType}
                onChange={(e) =>
                  setNewHolidayType(e.target.value as "NACIONAL" | "ESTADUAL" | "MUNICIPAL" | "RECESSO")
                }
                className={`${INPUT_CLASS} mt-1`}
              >
                <option value="NACIONAL">Nacional</option>
                <option value="ESTADUAL">Estadual</option>
                <option value="MUNICIPAL">Municipal</option>
                <option value="RECESSO">Recesso</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={savingId === "new-holiday" || !activeCityId}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              + Adicionar Feriado
            </button>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {holidays.map((h) => (
                  <tr key={h.id} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-mono">{h.date}</td>
                    <td className="px-3 py-2 font-medium">{h.name}</td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          h.type === "MUNICIPAL"
                            ? "amber"
                            : h.type === "ESTADUAL"
                              ? "blue"
                              : h.type === "RECESSO"
                                ? "neutral"
                                : "green"
                        }
                      >
                        {h.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(h.id)}
                        disabled={savingId === h.id}
                        className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA 4 — TEMPLATE MESTRE (26 ETAPAS EAP & 38 PACOTES LOB) */}
      {activeTab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Estrutura Mestre da EAP ({masterStages.length} Macro-Etapas)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Hierarquia padrão aplicada automaticamente em novos orçamentos (4 Zonas × 26 Etapas).
            </p>
            <div className="mt-4 max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {masterStages.map((stage) => (
                <div
                  key={stage.code}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-zinc-100">
                    <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white dark:bg-amber-500 dark:text-zinc-950">
                      {stage.code}
                    </span>
                    <span>{stage.name}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {stage.groups.map((g) => (
                      <span
                        key={g.code}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        {g.code} {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Linha de Balanço LOB ({masterPackages.length} Pacotes de Serviço)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Sequenciamento construtivo com predecessoras e gatilhos de suprimentos (Lead Time).
            </p>
            <div className="mt-4 max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {masterPackages.map((pkg) => (
                <div
                  key={pkg.packageNumber}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-zinc-100">
                      <span className="rounded-md bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] text-white">
                        PCT {String(pkg.packageNumber).padStart(2, "0")}
                      </span>
                      <span>{pkg.name}</span>
                    </div>
                    <span className="whitespace-nowrap font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                      {pkg.defaultDurationWorkingDays} d.u.
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                    <span>{pkg.waveName}</span>
                    <span>· Etapas: {pkg.linkedStageCodes.join(", ")}</span>
                    {pkg.predecessorNumbers.length > 0 && (
                      <span>· Predec.: {pkg.predecessorNumbers.join(", ")}</span>
                    )}
                  </div>
                  {pkg.procurementGates.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {pkg.procurementGates.map((g) => (
                        <Badge key={g.title} tone="amber">
                          Compra -{g.leadTimeDays}d: {g.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] lg:col-span-2">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Premissas Padrão da Proposta EAP
                </h4>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-zinc-400">
                  {defaultPremises.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Exclusões Padrão (Não Inclusos)
                </h4>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-zinc-400">
                  {defaultExclusions.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: NOVA CIDADE / CLONAR TABELA */}
      {showCityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateOrCloneCity}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 dark:border-zinc-800 dark:bg-[#16161D]"
          >
            <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
              Nova Cidade / Clonar Tabela Regional
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Cidade</label>
                <input
                  type="text"
                  required
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  placeholder="Ex.: Eusébio"
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">UF</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={newCityState}
                  onChange={(e) => setNewCityState(e.target.value.toUpperCase())}
                  className={`${INPUT_CLASS} mt-1 w-full uppercase`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">BDI Padrão (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newCityBdi}
                  onChange={(e) => setNewCityBdi(e.target.value)}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Reajuste na Clonagem (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={cloneAdjustment}
                  onChange={(e) => setCloneAdjustment(e.target.value)}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Clonar Preços de
              </label>
              <select
                value={cloneSourceId}
                onChange={(e) => setCloneSourceId(e.target.value)}
                className={`${INPUT_CLASS} mt-1 w-full`}
              >
                <option value="">Não clonar (iniciar zerada)</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}/{c.state}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCityModal(false)}
                className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingId === "city"}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                {savingId === "city" ? "Salvando..." : "Criar & Clonar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NOVO MATERIAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateMaterial}
            className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-3 dark:border-zinc-800 dark:bg-[#16161D]"
          >
            <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
              Novo Material Padronizado ({activeCity?.name}/{activeCity?.state})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Código</label>
                <input
                  type="text"
                  required
                  value={newMat.code}
                  onChange={(e) => setNewMat({ ...newMat, code: e.target.value.toUpperCase() })}
                  placeholder="EX-MAT-01"
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Nome</label>
                <input
                  type="text"
                  required
                  value={newMat.name}
                  onChange={(e) => setNewMat({ ...newMat, name: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Categoria</label>
                <select
                  value={newMat.category}
                  onChange={(e) => setNewMat({ ...newMat, category: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                >
                  {MATERIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Unidade</label>
                <input
                  type="text"
                  required
                  value={newMat.unit}
                  onChange={(e) => setNewMat({ ...newMat, unit: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Etapa EAP</label>
                <select
                  value={newMat.eapStageCode}
                  onChange={(e) => setNewMat({ ...newMat, eapStageCode: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                >
                  {masterStages.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Perda (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newMat.defaultLossPercent}
                  onChange={(e) => setNewMat({ ...newMat, defaultLossPercent: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Material (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newMat.materialUnitCost}
                  onChange={(e) => setNewMat({ ...newMat, materialUnitCost: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Terceiros (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newMat.thirdPartyUnitCost}
                  onChange={(e) => setNewMat({ ...newMat, thirdPartyUnitCost: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingId === "new-mat"}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                {savingId === "new-mat" ? "Salvando..." : "Adicionar Material"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
