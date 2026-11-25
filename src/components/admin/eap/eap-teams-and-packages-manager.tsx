"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface ServicePackageDTO {
  id: string;
  packageNumber: number;
  name: string;
  discipline: string;
  corHex: string;
  textHex: string;
  predecessorNumbers: number[];
  productivityPerDay: number;
  productivityUnit: string;
  linkedEapStageCodes: string[];
  isActive: boolean;
}

export interface TeamWorkerDTO {
  id?: string;
  roleName: string;
  headcount: number;
  dailyRate: number;
  hourlyRate: number;
  socialChargesPct: number;
  maxDailyOutput: number | null;
}

export interface WorkTeamDTO {
  id: string;
  teamCode: string;
  name: string;
  specialty: string;
  maxDailyHours: number;
  maxSimultaneousFronts: number;
  isActive: boolean;
  workers: TeamWorkerDTO[];
}

interface EapTeamsAndPackagesManagerProps {
  projectId: string;
  stages?: Array<{ code: string; name: string }>;
  onLaborSynced?: () => void | Promise<void>;
  buttonLabel?: string;
  buttonClassName?: string;
}

const DEFAULT_STAGE_OPTIONS: Array<{ code: string; name: string }> = [
  { code: "01", name: "Implantação e Preliminares" },
  { code: "02", name: "Movimento de Terra" },
  { code: "03", name: "Fundações" },
  { code: "04", name: "Supraestrutura" },
  { code: "05", name: "Alvenaria" },
  { code: "06", name: "Cobertura" },
  { code: "07", name: "Impermeabilização" },
  { code: "08", name: "Elétrica & Automação" },
  { code: "09", name: "Hidrossanitária" },
  { code: "10", name: "Gás & Climatização" },
  { code: "11", name: "Revest. Interno" },
  { code: "12", name: "Fachadas & Muros" },
  { code: "13", name: "Contrapiso" },
  { code: "14", name: "Pisos & Porcelanatos" },
  { code: "15", name: "Forros de Gesso" },
  { code: "16", name: "Esquadrias" },
  { code: "17", name: "Pintura" },
  { code: "18", name: "Louças & Metais" },
];

const COLOR_PRESETS = [
  "#1D4ED8",
  "#0F766E",
  "#B45309",
  "#6D28D9",
  "#047857",
  "#BE123C",
  "#0369A1",
  "#4338CA",
  "#A16207",
  "#334155",
];

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcContrastTextHex(corHex: string): string {
  const clean = corHex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.35 ? "#0F172A" : "#FFFFFF";
}

function calcLiveTeamCost(team: WorkTeamDTO): {
  totalHeadcount: number;
  totalDailyCost: number;
  totalHourlyCost: number;
} {
  let totalHeadcount = 0;
  let totalDailyCost = 0;
  for (const w of team.workers) {
    const qty = Math.max(0, Number(w.headcount) || 0);
    const daily = Math.max(0, Number(w.dailyRate) || 0);
    const charges = Math.max(0, Number(w.socialChargesPct) || 0);
    totalHeadcount += qty;
    totalDailyCost += qty * daily * (1 + charges / 100);
  }
  const roundedDaily = Math.round(totalDailyCost * 100) / 100;
  const hours = Math.max(1, Number(team.maxDailyHours) || 8);
  return {
    totalHeadcount,
    totalDailyCost: roundedDaily,
    totalHourlyCost: Math.round((roundedDaily / hours) * 100) / 100,
  };
}

function suggestNextLetter(teams: WorkTeamDTO[]): string {
  const used = new Set(teams.map((t) => t.teamCode.toUpperCase()));
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (!used.has(ch)) return ch;
  }
  return `A${teams.length + 1}`;
}

export function EapTeamsAndPackagesManager({
  projectId,
  stages,
  onLaborSynced,
  buttonLabel = "Pacotes (1..N) & Equipes (A..Z)",
  buttonClassName,
}: EapTeamsAndPackagesManagerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"packages" | "teams">("packages");
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [packages, setPackages] = useState<ServicePackageDTO[]>([]);
  const [teams, setTeams] = useState<WorkTeamDTO[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgDraft, setPkgDraft] = useState<ServicePackageDTO | null>(null);

  const [showNewPkgForm, setShowNewPkgForm] = useState(false);
  const [newPkg, setNewPkg] = useState({
    name: "",
    discipline: "Estrutura & Alvenaria",
    corHex: "#1D4ED8",
    productivityPerDay: "12",
    productivityUnit: "m²/dia",
    linkedStageCodesText: "04, 05",
    predecessorsText: "",
  });

  const [showNewTeamForm, setShowNewTeamForm] = useState(false);
  const [newTeam, setNewTeam] = useState({
    teamCode: "",
    name: "",
    specialty: "Execução Especializada",
    maxDailyHours: "8",
    maxSimultaneousFronts: "1",
  });

  const [syncStageSelection, setSyncStageSelection] = useState<Record<string, string[]>>({});

  const stageOptions = useMemo(
    () => (stages && stages.length > 0 ? stages : DEFAULT_STAGE_OPTIONS),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, teamRes] = await Promise.all([
        fetch(`/api/eap/projects/${projectId}/packages`, { cache: "no-store" }),
        fetch(`/api/eap/projects/${projectId}/teams`, { cache: "no-store" }),
      ]);
      const pkgJson = await pkgRes.json();
      const teamJson = await teamRes.json();
      if (pkgRes.ok && pkgJson.ok) {
        setPackages(pkgJson.packages ?? []);
      }
      if (teamRes.ok && teamJson.ok) {
        const list: WorkTeamDTO[] = teamJson.teams ?? [];
        setTeams(list);
        if (list.length > 0) {
          setExpandedTeamId((prev) => prev ?? list[0].id);
        }
      }
    } catch {
      setFeedback({ type: "error", text: "Não foi possível carregar pacotes e equipes." });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    void loadData();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loadData]);

  async function handleCreatePackage(e: React.FormEvent) {
    e.preventDefault();
    if (!newPkg.name.trim()) return;
    setBusyKey("new-pkg");
    setFeedback(null);
    try {
      const linkedEapStageCodes = newPkg.linkedStageCodesText
        .split(/[,\s;]+/)
        .map((s) => s.trim().padStart(2, "0"))
        .filter((s) => /^\d{2}$/.test(s));
      const predecessorNumbers = newPkg.predecessorsText
        .split(/[,\s;]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);

      const res = await fetch(`/api/eap/projects/${projectId}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPkg.name.trim(),
          discipline: newPkg.discipline.trim() || "Geral",
          corHex: newPkg.corHex,
          textHex: calcContrastTextHex(newPkg.corHex),
          productivityPerDay: Number(newPkg.productivityPerDay) || 10,
          productivityUnit: newPkg.productivityUnit.trim() || "un/dia",
          linkedEapStageCodes,
          predecessorNumbers,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao criar pacote." });
        return;
      }
      setPackages((prev) => [...prev, json.package].sort((a, b) => a.packageNumber - b.packageNumber));
      setNewPkg((prev) => ({ ...prev, name: "" }));
      setShowNewPkgForm(false);
      setFeedback({ type: "success", text: `Pacote #${json.package.packageNumber} adicionado.` });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSavePackage() {
    if (!pkgDraft) return;
    setBusyKey(`pkg-${pkgDraft.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/packages/${pkgDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pkgDraft.name,
          discipline: pkgDraft.discipline,
          corHex: pkgDraft.corHex,
          textHex: calcContrastTextHex(pkgDraft.corHex),
          productivityPerDay: Number(pkgDraft.productivityPerDay) || 1,
          productivityUnit: pkgDraft.productivityUnit,
          linkedEapStageCodes: pkgDraft.linkedEapStageCodes,
          predecessorNumbers: pkgDraft.predecessorNumbers,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao atualizar pacote." });
        return;
      }
      setPackages((prev) =>
        prev
          .map((p) => (p.id === json.package.id ? json.package : p))
          .sort((a, b) => a.packageNumber - b.packageNumber)
      );
      setEditingPkgId(null);
      setPkgDraft(null);
      setFeedback({ type: "success", text: `Pacote #${json.package.packageNumber} atualizado.` });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeletePackage(pkg: ServicePackageDTO) {
    setBusyKey(`del-pkg-${pkg.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/packages/${pkg.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
        setFeedback({ type: "success", text: `Pacote #${pkg.packageNumber} removido.` });
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    const code = (newTeam.teamCode || suggestNextLetter(teams)).trim().toUpperCase();
    if (!newTeam.name.trim()) return;
    setBusyKey("new-team");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamCode: code,
          name: newTeam.name.trim(),
          specialty: newTeam.specialty.trim() || "Execução Geral",
          maxDailyHours: Number(newTeam.maxDailyHours) || 8,
          maxSimultaneousFronts: Number(newTeam.maxSimultaneousFronts) || 1,
          workers: [
            {
              roleName: "Profissional",
              headcount: 1,
              dailyRate: 180,
              socialChargesPct: 20,
              maxDailyOutput: null,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao criar equipe." });
        return;
      }
      setTeams((prev) => [...prev, json.team].sort((a, b) => a.teamCode.localeCompare(b.teamCode)));
      setExpandedTeamId(json.team.id);
      setShowNewTeamForm(false);
      setNewTeam({
        teamCode: "",
        name: "",
        specialty: "Execução Especializada",
        maxDailyHours: "8",
        maxSimultaneousFronts: "1",
      });
      setFeedback({ type: "success", text: `Equipe ${json.team.teamCode} criada.` });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveTeam(team: WorkTeamDTO) {
    setBusyKey(`team-${team.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: team.name,
          specialty: team.specialty,
          maxDailyHours: Number(team.maxDailyHours) || 8,
          maxSimultaneousFronts: Number(team.maxSimultaneousFronts) || 1,
          workers: team.workers.map((w) => ({
            roleName: w.roleName.trim() || "Função",
            headcount: Math.max(1, Math.round(Number(w.headcount) || 1)),
            dailyRate: Math.max(0, Number(w.dailyRate) || 0),
            hourlyRate: Math.max(0, Number(w.hourlyRate) || 0),
            socialChargesPct: Math.max(0, Number(w.socialChargesPct) || 0),
            maxDailyOutput: w.maxDailyOutput && w.maxDailyOutput > 0 ? Number(w.maxDailyOutput) : null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar equipe." });
        return;
      }
      setTeams((prev) => prev.map((t) => (t.id === json.team.id ? json.team : t)));
      setFeedback({ type: "success", text: `Equipe ${json.team.teamCode} salva.` });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSyncTeamLabor(team: WorkTeamDTO) {
    const selected = syncStageSelection[team.id] ?? [];
    if (selected.length === 0) {
      setFeedback({
        type: "error",
        text: `Selecione ao menos uma macro-etapa da EAP para aplicar o custo da Equipe ${team.teamCode}.`,
      });
      return;
    }
    setBusyKey(`sync-${team.id}`);
    setFeedback(null);
    try {
      // Salva alterações pendentes da equipe antes de sincronizar
      await handleSaveTeam(team);
      const res = await fetch(`/api/eap/projects/${projectId}/teams/${team.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageCodes: selected }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao sincronizar MO na EAP." });
        return;
      }
      setFeedback({
        type: "success",
        text: `Custo de MO da Equipe ${json.teamCode} (${fmtBRL(json.teamDailyCost)}/dia) aplicado em ${json.updatedCount} item(ns) das etapas ${json.stageCodes.join(", ")}.`,
      });
      await onLaborSynced?.();
    } finally {
      setBusyKey(null);
    }
  }

  function updateTeamLocal(teamId: string, updater: (team: WorkTeamDTO) => WorkTeamDTO) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? updater(t) : t)));
  }

  function toggleStageForTeam(teamId: string, stageCode: string) {
    setSyncStageSelection((prev) => {
      const current = prev[teamId] ?? [];
      const exists = current.includes(stageCode);
      return {
        ...prev,
        [teamId]: exists ? current.filter((c) => c !== stageCode) : [...current, stageCode],
      };
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          "inline-flex h-8 items-center gap-1.5 rounded-xl border border-indigo-300/80 bg-indigo-50/90 px-3 text-[11px] font-semibold text-indigo-900 shadow-xs transition hover:bg-indigo-100 cursor-pointer dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/70"
        }
      >
        <span>👷</span>
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-xs"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-4xl flex-col border-l border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-[#121219]/95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-950 dark:text-zinc-100">
                    ArqVértice OS — Pacotes (1..N) &amp; Equipes (A, B, C...)
                  </h2>
                  <Badge tone="blue">Fase 8</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
                  Gerencie pacotes numerados, frentes simultâneas, composição de mão de obra e sincronize custos com a Planilha EAP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Fechar (Esc)
              </button>
            </div>

            {/* Abas */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-2.5 dark:border-zinc-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("packages")}
                  className={`h-8 rounded-xl px-3.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === "packages"
                      ? "bg-slate-900 text-white shadow-xs dark:bg-amber-500 dark:text-zinc-950"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  1. Pacotes de Serviço ({packages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("teams")}
                  className={`h-8 rounded-xl px-3.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === "teams"
                      ? "bg-slate-900 text-white shadow-xs dark:bg-amber-500 dark:text-zinc-950"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  2. Equipes &amp; Mão de Obra ({teams.length})
                </button>
              </div>

              {activeTab === "packages" ? (
                <button
                  type="button"
                  onClick={() => setShowNewPkgForm((v) => !v)}
                  className="h-8 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  + Novo Pacote de Serviço
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNewTeam((prev) => ({
                      ...prev,
                      teamCode: suggestNextLetter(teams),
                      name: `Equipe ${suggestNextLetter(teams)} — `,
                    }));
                    setShowNewTeamForm((v) => !v);
                  }}
                  className="h-8 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  + Nova Equipe ({suggestNextLetter(teams)})
                </button>
              )}
            </div>

            {feedback && (
              <div
                className={`mx-5 mt-3 rounded-xl border px-3.5 py-2 text-xs font-medium ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400">
                  Carregando pacotes de serviço e equipes...
                </div>
              ) : activeTab === "packages" ? (
                <>
                  {showNewPkgForm && (
                    <form
                      onSubmit={handleCreatePackage}
                      className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-3 dark:border-blue-900/60 dark:bg-blue-950/30"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        Novo Pacote de Serviço (#{packages.length + 1})
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          required
                          placeholder="Nome do pacote (ex.: Alvenaria Térreo)"
                          value={newPkg.name}
                          onChange={(e) => setNewPkg((p) => ({ ...p, name: e.target.value }))}
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          placeholder="Disciplina"
                          value={newPkg.discipline}
                          onChange={(e) => setNewPkg((p) => ({ ...p, discipline: e.target.value }))}
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          placeholder="Produtividade/dia"
                          value={newPkg.productivityPerDay}
                          onChange={(e) =>
                            setNewPkg((p) => ({ ...p, productivityPerDay: e.target.value }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          placeholder="Unidade (ex.: m²/dia)"
                          value={newPkg.productivityUnit}
                          onChange={(e) =>
                            setNewPkg((p) => ({ ...p, productivityUnit: e.target.value }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <div className="flex items-center gap-1.5">
                          {COLOR_PRESETS.slice(0, 6).map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setNewPkg((p) => ({ ...p, corHex: hex }))}
                              style={{ backgroundColor: hex }}
                              className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                                newPkg.corHex === hex
                                  ? "border-slate-950 scale-110 dark:border-white"
                                  : "border-transparent"
                              }`}
                              title={hex}
                            />
                          ))}
                        </div>
                        <input
                          placeholder="Etapas EAP (ex.: 04, 05)"
                          value={newPkg.linkedStageCodesText}
                          onChange={(e) =>
                            setNewPkg((p) => ({ ...p, linkedStageCodesText: e.target.value }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          placeholder="Predecessores (ex.: 1, 2)"
                          value={newPkg.predecessorsText}
                          onChange={(e) =>
                            setNewPkg((p) => ({ ...p, predecessorsText: e.target.value }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowNewPkgForm(false)}
                            className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={busyKey === "new-pkg"}
                            className="h-9 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                          >
                            {busyKey === "new-pkg" ? "Salvando..." : "Criar Pacote"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {packages.map((pkg) => {
                      const isEditing = editingPkgId === pkg.id && pkgDraft;
                      return (
                        <div
                          key={pkg.id}
                          className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#171720]"
                        >
                          {isEditing && pkgDraft ? (
                            <div className="grid gap-2.5 sm:grid-cols-4">
                              <input
                                value={pkgDraft.name}
                                onChange={(e) =>
                                  setPkgDraft((d) => (d ? { ...d, name: e.target.value } : d))
                                }
                                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                              />
                              <input
                                value={pkgDraft.discipline}
                                onChange={(e) =>
                                  setPkgDraft((d) =>
                                    d ? { ...d, discipline: e.target.value } : d
                                  )
                                }
                                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                              />
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={pkgDraft.productivityPerDay}
                                  onChange={(e) =>
                                    setPkgDraft((d) =>
                                      d
                                        ? {
                                            ...d,
                                            productivityPerDay: Number(e.target.value) || 1,
                                          }
                                        : d
                                    )
                                  }
                                  className="h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                                <input
                                  value={pkgDraft.productivityUnit}
                                  onChange={(e) =>
                                    setPkgDraft((d) =>
                                      d ? { ...d, productivityUnit: e.target.value } : d
                                    )
                                  }
                                  className="h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                              </div>
                              <div className="flex items-center gap-1.5 sm:col-span-2">
                                {COLOR_PRESETS.map((hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() =>
                                      setPkgDraft((d) =>
                                        d
                                          ? {
                                              ...d,
                                              corHex: hex,
                                              textHex: calcContrastTextHex(hex),
                                            }
                                          : d
                                      )
                                    }
                                    style={{ backgroundColor: hex }}
                                    className={`h-5 w-5 rounded-full border cursor-pointer ${
                                      pkgDraft.corHex === hex
                                        ? "border-slate-950 scale-110 dark:border-white"
                                        : "border-transparent"
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="flex justify-end gap-2 sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPkgId(null);
                                    setPkgDraft(null);
                                  }}
                                  className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSavePackage()}
                                  disabled={busyKey === `pkg-${pkg.id}`}
                                  className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white cursor-pointer"
                                >
                                  {busyKey === `pkg-${pkg.id}` ? "Salvando..." : "Salvar"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span
                                  style={{ backgroundColor: pkg.corHex, color: pkg.textHex }}
                                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2 font-mono text-xs font-bold shadow-xs"
                                >
                                  {pkg.packageNumber}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-slate-950 dark:text-zinc-100">
                                    {pkg.name}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                                    <span>{pkg.discipline}</span>
                                    <span>·</span>
                                    <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                                      {pkg.productivityPerDay} {pkg.productivityUnit}
                                    </span>
                                    {pkg.linkedEapStageCodes.length > 0 && (
                                      <>
                                        <span>·</span>
                                        <span>Etapas: {pkg.linkedEapStageCodes.join(", ")}</span>
                                      </>
                                    )}
                                    {pkg.predecessorNumbers.length > 0 && (
                                      <>
                                        <span>·</span>
                                        <span>Pred.: #{pkg.predecessorNumbers.join(", #")}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPkgId(pkg.id);
                                    setPkgDraft(pkg);
                                  }}
                                  className="h-7 rounded-lg border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeletePackage(pkg)}
                                  disabled={busyKey === `del-pkg-${pkg.id}`}
                                  className="h-7 rounded-lg border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {showNewTeamForm && (
                    <form
                      onSubmit={handleCreateTeam}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        Nova Equipe de Obra
                      </div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <input
                          required
                          maxLength={6}
                          placeholder="Código (ex.: D)"
                          value={newTeam.teamCode}
                          onChange={(e) =>
                            setNewTeam((t) => ({ ...t, teamCode: e.target.value.toUpperCase() }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          required
                          placeholder="Nome da equipe"
                          value={newTeam.name}
                          onChange={(e) => setNewTeam((t) => ({ ...t, name: e.target.value }))}
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          placeholder="Especialidade"
                          value={newTeam.specialty}
                          onChange={(e) => setNewTeam((t) => ({ ...t, specialty: e.target.value }))}
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          placeholder="Horas/dia"
                          value={newTeam.maxDailyHours}
                          onChange={(e) =>
                            setNewTeam((t) => ({ ...t, maxDailyHours: e.target.value }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="number"
                          min="1"
                          max="20"
                          placeholder="Frentes simult."
                          value={newTeam.maxSimultaneousFronts}
                          onChange={(e) =>
                            setNewTeam((t) => ({ ...t, maxSimultaneousFronts: e.target.value }))
                          }
                          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setShowNewTeamForm(false)}
                            className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={busyKey === "new-team"}
                            className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            {busyKey === "new-team" ? "Criando..." : "Criar Equipe"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {teams.map((team) => {
                      const isExpanded = expandedTeamId === team.id;
                      const summary = calcLiveTeamCost(team);
                      const selectedStages = syncStageSelection[team.id] ?? [];

                      return (
                        <div
                          key={team.id}
                          className="rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-zinc-800 dark:bg-[#171720]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTeamId((prev) => (prev === team.id ? null : team.id))
                            }
                            className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 font-mono text-sm font-bold text-white dark:bg-amber-500 dark:text-zinc-950">
                                {team.teamCode}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-950 dark:text-zinc-100">
                                  {team.name}
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-zinc-400">
                                  {team.specialty} · {summary.totalHeadcount} trabalhador(es) · máx.{" "}
                                  {team.maxDailyHours}h/dia · {team.maxSimultaneousFronts} frente(s)
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {fmtBRL(summary.totalDailyCost)}/dia
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                                {fmtBRL(summary.totalHourlyCost)}/h
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-200/80 p-4 space-y-4 dark:border-zinc-800">
                              {/* Configurações da Equipe */}
                              <div className="grid gap-3 sm:grid-cols-4">
                                <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 sm:col-span-2">
                                  <span>Nome da Equipe</span>
                                  <input
                                    value={team.name}
                                    onChange={(e) =>
                                      updateTeamLocal(team.id, (t) => ({
                                        ...t,
                                        name: e.target.value,
                                      }))
                                    }
                                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                  />
                                </label>
                                <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                                  <span>Horas Máx./Dia</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    max="24"
                                    value={team.maxDailyHours}
                                    onChange={(e) =>
                                      updateTeamLocal(team.id, (t) => ({
                                        ...t,
                                        maxDailyHours: Number(e.target.value) || 8,
                                      }))
                                    }
                                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                  />
                                </label>
                                <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                                  <span>Frentes Simultâneas</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={team.maxSimultaneousFronts}
                                    onChange={(e) =>
                                      updateTeamLocal(team.id, (t) => ({
                                        ...t,
                                        maxSimultaneousFronts: Number(e.target.value) || 1,
                                      }))
                                    }
                                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                  />
                                </label>
                              </div>

                              {/* Tabela de Trabalhadores */}
                              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
                                    <tr>
                                      <th className="px-2.5 py-2">Função</th>
                                      <th className="px-2 py-2 w-16">Qtd.</th>
                                      <th className="px-2 py-2 w-24">Diária R$</th>
                                      <th className="px-2 py-2 w-24">Hora R$</th>
                                      <th className="px-2 py-2 w-20">Encargos %</th>
                                      <th className="px-2 py-2 w-24">Lim. Prod./Dia</th>
                                      <th className="px-2 py-2 w-10" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800">
                                    {team.workers.map((worker, wIdx) => (
                                      <tr key={worker.id || `${team.id}-${wIdx}`}>
                                        <td className="px-2 py-1.5">
                                          <input
                                            value={worker.roleName}
                                            onChange={(e) =>
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.map((w, i) =>
                                                  i === wIdx ? { ...w, roleName: e.target.value } : w
                                                ),
                                              }))
                                            }
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                          />
                                        </td>
                                        <td className="px-1.5 py-1.5">
                                          <input
                                            type="number"
                                            min="1"
                                            value={worker.headcount}
                                            onChange={(e) =>
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.map((w, i) =>
                                                  i === wIdx
                                                    ? { ...w, headcount: Number(e.target.value) || 1 }
                                                    : w
                                                ),
                                              }))
                                            }
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                          />
                                        </td>
                                        <td className="px-1.5 py-1.5">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={worker.dailyRate}
                                            onChange={(e) => {
                                              const daily = Number(e.target.value) || 0;
                                              const hourly =
                                                Math.round(
                                                  (daily / Math.max(1, team.maxDailyHours)) * 100
                                                ) / 100;
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.map((w, i) =>
                                                  i === wIdx
                                                    ? { ...w, dailyRate: daily, hourlyRate: hourly }
                                                    : w
                                                ),
                                              }));
                                            }}
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                          />
                                        </td>
                                        <td className="px-1.5 py-1.5">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={worker.hourlyRate}
                                            onChange={(e) =>
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.map((w, i) =>
                                                  i === wIdx
                                                    ? {
                                                        ...w,
                                                        hourlyRate: Number(e.target.value) || 0,
                                                      }
                                                    : w
                                                ),
                                              }))
                                            }
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                          />
                                        </td>
                                        <td className="px-1.5 py-1.5">
                                          <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={worker.socialChargesPct}
                                            onChange={(e) =>
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.map((w, i) =>
                                                  i === wIdx
                                                    ? {
                                                        ...w,
                                                        socialChargesPct: Number(e.target.value) || 0,
                                                      }
                                                    : w
                                                ),
                                              }))
                                            }
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                          />
                                        </td>
                                        <td className="px-1.5 py-1.5">
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            placeholder="—"
                                            value={worker.maxDailyOutput ?? ""}
                                            onChange={(e) =>
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.map((w, i) =>
                                                  i === wIdx
                                                    ? {
                                                        ...w,
                                                        maxDailyOutput: e.target.value
                                                          ? Number(e.target.value)
                                                          : null,
                                                      }
                                                    : w
                                                ),
                                              }))
                                            }
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                          />
                                        </td>
                                        <td className="px-1.5 py-1.5 text-center">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateTeamLocal(team.id, (t) => ({
                                                ...t,
                                                workers: t.workers.filter((_, i) => i !== wIdx),
                                              }))
                                            }
                                            title="Remover trabalhador"
                                            className="text-rose-600 hover:text-rose-800 cursor-pointer dark:text-rose-400"
                                          >
                                            ✕
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateTeamLocal(team.id, (t) => ({
                                      ...t,
                                      workers: [
                                        ...t.workers,
                                        {
                                          roleName: "Ajudante",
                                          headcount: 1,
                                          dailyRate: 120,
                                          hourlyRate:
                                            Math.round(
                                              (120 / Math.max(1, t.maxDailyHours)) * 100
                                            ) / 100,
                                          socialChargesPct: 20,
                                          maxDailyOutput: null,
                                        },
                                      ],
                                    }))
                                  }
                                  className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                >
                                  + Adicionar Trabalhador
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleSaveTeam(team)}
                                  disabled={busyKey === `team-${team.id}`}
                                  className="h-8 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                                >
                                  {busyKey === `team-${team.id}`
                                    ? "Salvando..."
                                    : "Salvar Equipe"}
                                </button>
                              </div>

                              {/* Sincronização de Mão de Obra com a Planilha EAP */}
                              <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/60 p-3 space-y-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                                    Sincronizar Mão de Obra com Macro-Etapas da EAP
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleSyncTeamLabor(team)}
                                    disabled={busyKey === `sync-${team.id}`}
                                    className="h-8 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                                  >
                                    {busyKey === `sync-${team.id}`
                                      ? "Aplicando..."
                                      : "Aplicar Custo de MO na EAP"}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {stageOptions.map((st) => {
                                    const checked = selectedStages.includes(st.code);
                                    return (
                                      <button
                                        key={st.code}
                                        type="button"
                                        onClick={() => toggleStageForTeam(team.id, st.code)}
                                        className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition cursor-pointer ${
                                          checked
                                            ? "border-indigo-600 bg-indigo-600 text-white"
                                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                                        }`}
                                      >
                                        {st.code} · {st.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
