"use client";

import { useState, useTransition, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveScheduleStageAction, editScheduleStageAction } from "@/server/actions/schedule";
import { MASTER_PHASES, MASTER_DISCIPLINES } from "@/lib/master-data";
import { toISODateInput } from "@/lib/formatters";

export interface StageFormData {
  id?: string;
  name: string;
  discipline?: string | null;
  designer?: string | null;
  description?: string | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  order?: number;
  completion?: number;
  weight?: number;
  phase?: string | null;
  notes?: string | null;
  isVisibleInKanban?: boolean;
}

interface StageFormModalProps {
  projectId: string;
  initialStage?: StageFormData | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (savedStage: StageFormData) => void;
}

export function StageFormModal({
  projectId,
  initialStage,
  isOpen,
  onClose,
  onSaved,
}: StageFormModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Estados dos campos controlados
  const [name, setName] = useState(initialStage?.name ?? "");
  const [phase, setPhase] = useState(
    initialStage?.phase ||
      initialStage?.notes?.match(/\[FASE:\s*(.*?)\]/)?.[1] ||
      "Projeto Executivo"
  );
  const [discipline, setDiscipline] = useState(initialStage?.discipline ?? "Arquitetura");
  const [designer, setDesigner] = useState(initialStage?.designer ?? "Eduardo Marques");
  const [startDate, setStartDate] = useState(
    initialStage?.startDate
      ? toISODateInput(initialStage.startDate)
      : new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(
    initialStage?.dueDate
      ? toISODateInput(initialStage.dueDate)
      : new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState(initialStage?.description ?? "");
  const [completion, setCompletion] = useState(initialStage?.completion ?? 0);
  const [isVisibleInKanban, setIsVisibleInKanban] = useState(initialStage?.isVisibleInKanban ?? true);

  // Sincroniza quando o modal abre com novo initialStage
  useEffect(() => {
    if (initialStage) {
      setName(initialStage.name ?? "");
      setPhase(
        initialStage.phase ||
          initialStage.notes?.match(/\[FASE:\s*(.*?)\]/)?.[1] ||
          "Projeto Executivo"
      );
      setDiscipline(initialStage.discipline ?? "Arquitetura");
      setDesigner(
        initialStage.designer === "Luan Almeida"
          ? "Emanoel Luan"
          : initialStage.designer === "Erick Santiago"
          ? "Erick"
          : initialStage.designer ?? "Eduardo Marques"
      );
      setStartDate(
        initialStage.startDate
          ? toISODateInput(initialStage.startDate)
          : new Date().toISOString().slice(0, 10)
      );
      setDueDate(
        initialStage.dueDate
          ? toISODateInput(initialStage.dueDate)
          : new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
      );
      setDescription(initialStage.description ?? "");
      setCompletion(initialStage.completion ?? 0);
      setIsVisibleInKanban(initialStage.isVisibleInKanban ?? true);
      setIsDuplicating(false);
    } else {
      setName("");
      setPhase("Projeto Executivo");
      setDiscipline("Arquitetura");
      setDesigner("Eduardo Marques");
      setStartDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10));
      setDescription("");
      setCompletion(0);
      setIsVisibleInKanban(true);
      setIsDuplicating(false);
    }
    setError(null);
  }, [initialStage, isOpen]);

  if (!isOpen) return null;

  function handleDuplicate() {
    setName((prev) => (prev.endsWith("(Cópia)") ? prev : `${prev} (Cópia)`));
    setIsDuplicating(true);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Constrói a nota com a tag de fase para persistência estruturada
    const phaseTag = `[FASE: ${phase}]`;
    const cleanNotes = (initialStage?.notes || "")
      .replace(/\[FASE:\s*.*?\]/g, "")
      .trim();
    const finalNotes = cleanNotes ? `${phaseTag} ${cleanNotes}` : phaseTag;

    const payload: StageFormData & { projectId: string } = {
      // Se estiver em modo de duplicação, omitir o id para gerar novo registro no banco
      id: isDuplicating ? undefined : initialStage?.id,
      projectId,
      name: name.trim(),
      discipline: discipline.trim() || null,
      designer: designer.trim() || null,
      description: description.trim() || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      // Peso e ordem atribuídos em background de forma transparente
      order: isDuplicating ? Math.floor(Date.now() / 1000) % 10000 : Number(initialStage?.order ?? 999),
      weight: Number(initialStage?.weight ?? 10),
      completion: isDuplicating ? 0 : Number(completion),
      isVisibleInKanban,
      notes: finalNotes,
      phase,
    };

    // Callback otimista síncrono para recálculo instantâneo no cliente
    if (onSaved) {
      onSaved(payload);
    }

    startTransition(async () => {
      try {
        if (initialStage?.id && !isDuplicating) {
          await editScheduleStageAction(initialStage.id, payload, projectId);
        } else {
          await saveScheduleStageAction(payload);
        }
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gravar etapa.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto backdrop-blur-md bg-black/40 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Apple HIG */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Cronograma de Obras & Projetos
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              {isDuplicating
                ? "Duplicar Etapa do Cronograma"
                : initialStage?.id
                ? "Editar Etapa"
                : "Nova Etapa"}
            </h2>
            {isDuplicating && (
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                Criando uma nova etapa baseada em &quot;{initialStage?.name}&quot; sem sobrescrever a original.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 font-semibold">
              {error}
            </div>
          )}

          {/* 1. TÍTULO DA ETAPA (EM DESTAQUE NO TOPO) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Título da Etapa *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Projeto Executivo de Arquitetura"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
            />
          </div>

          {/* 2. INFORMAÇÕES TÉCNICAS ESTRUTURADAS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Configurações Técnicas
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Seletor de Fase do Projeto (Dropdown Limpo) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fase do Projeto *
                </label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {MASTER_PHASES.map((p) => (
                    <option key={p.key} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seletor de Disciplina (Nomes Limpos sem cores) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Disciplina Técnica *
                </label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {MASTER_DISCIPLINES.map((d) => (
                    <option key={d.key} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                  <option value="Execução de Obra">Execução de Obra</option>
                </select>
              </div>

              {/* Seletor de Responsável Técnico (Apenas Nome e Sobrenome) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Responsável Técnico *
                </label>
                <select
                  value={designer}
                  onChange={(e) => setDesigner(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Eduardo Marques">Eduardo Marques</option>
                  <option value="Emanoel Luan">Emanoel Luan</option>
                  <option value="Erick">Erick</option>
                </select>
              </div>

              {/* Prazo de Conclusão */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prazo de Conclusão (Due Date)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Data de Início */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-1/2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Avanço Físico (%) e Visibilidade no Kanban */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Avanço Físico Concluído
                  </label>
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {completion}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={completion}
                  onChange={(e) => setCompletion(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                />
                <div className="flex gap-1.5 mt-2">
                  {[0, 25, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCompletion(val)}
                      className={`min-h-[36px] flex-1 rounded-lg text-[11px] font-bold border transition ${
                        completion === val
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle de Visibilidade no Kanban */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Visibilidade no Quadro Kanban
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {isVisibleInKanban
                      ? "O card será exibido nas colunas do Kanban"
                      : "O card fica oculto do quadro visual (suas métricas continuam no cálculo global)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVisibleInKanban(!isVisibleInKanban)}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-[0.98] select-none ${
                    isVisibleInKanban
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                  }`}
                >
                  <span>{isVisibleInKanban ? "👁️ Visível" : "👁️‍🗨️ Oculto"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. DESCRIÇÃO DO ESCOPO */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Descrição do Escopo e Entregáveis
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhadamente o que contempla esta entrega técnica..."
              className="w-full rounded-2xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
            />
          </div>

          {/* Footer de Ações Apple HIG */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-100">
            {/* Botão de Duplicação e Google Agenda */}
            <div className="flex items-center gap-2">
              {initialStage?.id && !isDuplicating && (
                <>
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95 shadow-xs"
                  >
                    <span>📑</span> Duplicar Etapa
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const start = dueDate ? new Date(dueDate) : new Date();
                      const y = start.getUTCFullYear();
                      const m = String(start.getUTCMonth() + 1).padStart(2, "0");
                      const d = String(start.getUTCDate()).padStart(2, "0");
                      const dateStr = `${y}${m}${d}`;
                      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                        name
                      )}&dates=${dateStr}/${dateStr}&details=${encodeURIComponent(
                        `Disciplina: ${discipline || "Geral"}\nResponsável: ${designer || "Eduardo Marques"}\nAvanço: ${completion}%`
                      )}`;
                      window.open(url, "_blank");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition active:scale-95 shadow-xs"
                    title="Adicionar esta etapa ao Google Agenda"
                  >
                    <span>🗓️</span> Google Agenda
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50 active:scale-95"
              >
                {isPending
                  ? "Salvando..."
                  : isDuplicating
                  ? "Criar Cópia da Etapa"
                  : initialStage?.id
                  ? "Salvar Alterações"
                  : "Criar Etapa"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
