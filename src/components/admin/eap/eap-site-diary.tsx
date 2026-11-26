"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { compressImageFileForField } from "@/lib/media-compress";
import type {
  DiarySiteCondition,
  DiaryWeather,
  SiteDiaryEntryDTO,
  SiteDiaryMediaItem,
  SiteDiaryPeriodSummary,
} from "@/server/eap/site-diary";

const WEATHER_OPTIONS: Array<{ id: DiaryWeather; label: string }> = [
  { id: "SOL", label: "☀ Sol" },
  { id: "NUBLADO", label: "⛅ Nublado" },
  { id: "CHUVA", label: "🌧 Chuva" },
  { id: "IMPRATICAVEL", label: "⛈ Impraticável" },
];

const CONDITION_OPTIONS: Array<{ id: DiarySiteCondition; label: string; tone: "green" | "amber" | "red" }> = [
  { id: "OPERAVEL", label: "Operável", tone: "green" },
  { id: "PARCIAL", label: "Parcial", tone: "amber" },
  { id: "PARALISADO", label: "Paralisado", tone: "red" },
];

function fmtDateBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function EapSiteDiary({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<SiteDiaryEntryDTO[]>([]);
  const [summary, setSummary] = useState<SiteDiaryPeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weatherMorning, setWeatherMorning] = useState<DiaryWeather>("SOL");
  const [weatherAfternoon, setWeatherAfternoon] = useState<DiaryWeather>("SOL");
  const [siteCondition, setSiteCondition] = useState<DiarySiteCondition>("OPERAVEL");
  const [teamA, setTeamA] = useState("3");
  const [teamB, setTeamB] = useState("2");
  const [teamC, setTeamC] = useState("2");
  const [thirdParty, setThirdParty] = useState("0");
  const [activitiesExecuted, setActivitiesExecuted] = useState("");
  const [occurrencesAndNotes, setOccurrencesAndNotes] = useState("");
  const [mediaItems, setMediaItems] = useState<SiteDiaryMediaItem[]>([]);

  const loadDiary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/site-diary`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) {
        setEntries(json.entries || []);
        setSummary(json.summary || null);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDiary();
  }, [loadDiary]);

  async function handleMediaUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: SiteDiaryMediaItem[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (file.type.startsWith("image/")) {
        const compressed = await compressImageFileForField(file);
        const bytes = new Uint8Array(await compressed.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const dataBase64 = btoa(binary);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          mediaType: "IMAGE",
          fileName: file.name,
          dataBase64,
          caption: file.name,
          timeLabel: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        });
      } else if (file.type.startsWith("video/")) {
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          mediaType: "VIDEO",
          fileName: file.name,
          caption: file.name,
          timeLabel: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
    setMediaItems((prev) => [...prev, ...next]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activitiesExecuted.trim()) {
      setFeedback({ type: "err", text: "Descreva as atividades executadas no dia." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/site-diary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate,
          weatherMorning,
          weatherAfternoon,
          siteCondition,
          workforceSummary: {
            teamA: Number(teamA) || 0,
            teamB: Number(teamB) || 0,
            teamC: Number(teamC) || 0,
            thirdParty: Number(thirdParty) || 0,
          },
          activitiesExecuted,
          occurrencesAndNotes,
          mediaItems,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "err", text: json.error || "Não foi possível salvar o registro." });
        return;
      }
      setActivitiesExecuted("");
      setOccurrencesAndNotes("");
      setMediaItems([]);
      setFeedback({ type: "ok", text: "Registro salvo no Diário de Obra." });
      await loadDiary();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Diário de Obra — Registro Diário de Canteiro
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Lançamento rápido de clima, efetivo, atividades executadas, ocorrências e fotos do dia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Pré-visualizar &amp; Exportar PDF
          </button>
        </div>

        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[11px] text-slate-500">Dias Registrados</p>
              <p className="mt-1 font-mono text-base font-bold text-slate-950 dark:text-zinc-100">{summary.totalDays}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[11px] text-slate-500">Dias Operáveis</p>
              <p className="mt-1 font-mono text-base font-bold text-emerald-600">{summary.operableDays}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[11px] text-slate-500">Dias de Chuva</p>
              <p className="mt-1 font-mono text-base font-bold text-amber-600">{summary.rainDays}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[11px] text-slate-500">Efetivo Médio</p>
              <p className="mt-1 font-mono text-base font-bold text-blue-600">{summary.avgWorkforce} trab/dia</p>
            </div>
          </div>
        )}
      </Card>

      {/* Formulário Rápido Mobile-First */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <form onSubmit={handleSave} className="space-y-3">
          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${
                feedback.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Data</span>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Clima Manhã</span>
              <select
                value={weatherMorning}
                onChange={(e) => setWeatherMorning(e.target.value as DiaryWeather)}
                className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Clima Tarde</span>
              <select
                value={weatherAfternoon}
                onChange={(e) => setWeatherAfternoon(e.target.value as DiaryWeather)}
                className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Condição</span>
              <select
                value={siteCondition}
                onChange={(e) => setSiteCondition(e.target.value as DiarySiteCondition)}
                className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Equipe A</span>
              <input type="number" min={0} value={teamA} onChange={(e) => setTeamA(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Equipe B</span>
              <input type="number" min={0} value={teamB} onChange={(e) => setTeamB(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Equipe C</span>
              <input type="number" min={0} value={teamC} onChange={(e) => setTeamC(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Terceiros</span>
              <input type="number" min={0} value={thirdParty} onChange={(e) => setThirdParty(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Atividades Executadas *</span>
              <textarea
                rows={2}
                value={activitiesExecuted}
                onChange={(e) => setActivitiesExecuted(e.target.value)}
                placeholder="Ex.: Concretagem de pilares do pavimento térreo e alvenaria..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Ocorrências, Visitas &amp; Recebimentos</span>
              <textarea
                rows={2}
                value={occurrencesAndNotes}
                onChange={(e) => setOccurrencesAndNotes(e.target.value)}
                placeholder="Ex.: Recebimento de aço CA-50, visita técnica do cliente..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <span>📷 Anexar Fotos / Vídeos ({mediaItems.length})</span>
              <input
                type="file"
                accept="image/*,video/*"
                capture="environment"
                multiple
                onChange={(e) => void handleMediaUpload(e.target.files)}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              {saving ? "Salvando..." : "Salvar Registro do Dia"}
            </button>
          </div>
        </form>
      </Card>

      {/* Timeline Cronológica */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Linha do Tempo do Diário de Obra
        </h4>
        {loading ? (
          <p className="text-xs text-slate-500">Carregando registros...</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum registro diário lançado ainda.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const condTone =
                entry.siteCondition === "OPERAVEL"
                  ? "green"
                  : entry.siteCondition === "PARCIAL"
                    ? "amber"
                    : "red";
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-950 dark:text-zinc-100">
                        {fmtDateBr(entry.entryDate)}
                      </span>
                      <Badge tone={condTone}>{entry.siteCondition}</Badge>
                      <Badge tone="neutral">
                        Clima: {entry.weatherMorning} / {entry.weatherAfternoon}
                      </Badge>
                      <Badge tone="blue">
                        Efetivo: {entry.workforceSummary.total} trab.
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-zinc-200">
                    <strong>Atividades:</strong> {entry.activitiesExecuted}
                  </p>
                  {entry.occurrencesAndNotes && (
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      <strong>Ocorrências:</strong> {entry.occurrencesAndNotes}
                    </p>
                  )}
                  {entry.mediaItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {entry.mediaItems.map((m) =>
                        m.mediaType === "IMAGE" && m.dataBase64 ? (
                          <img
                            key={m.id}
                            src={`data:image/jpeg;base64,${m.dataBase64}`}
                            alt={m.caption || m.fileName}
                            className="h-16 w-24 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <Badge key={m.id} tone="neutral">🎥 {m.fileName}</Badge>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-zinc-800 dark:bg-[#13131A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                Pré-visualização — Diário de Obra (PDF)
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/eap/projects/${projectId}/site-diary/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Confirmar &amp; Baixar PDF
                </a>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              O PDF inclui cabeçalho limpo, resumo de dias operáveis/chuva, efetivo médio, tabela cronológica e registro fotográfico.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
