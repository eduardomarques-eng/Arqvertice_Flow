"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CANONICAL_STAGES, type CanonicalStageTemplate } from "@/lib/canonical-stages";
import { saveScheduleStageAction } from "@/app/actions/domain-actions";

interface StageFormModalProps {
  projectId: string;
  initialStage?: {
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
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
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

  // Estados dos campos controlados para suportar o autopreenchimento com 1 clique
  const [name, setName] = useState(initialStage?.name ?? "");
  const [discipline, setDiscipline] = useState(initialStage?.discipline ?? "Arquitetura");
  const [designer, setDesigner] = useState(initialStage?.designer ?? "Eduardo Marques");
  const [startDate, setStartDate] = useState(
    initialStage?.startDate
      ? new Date(initialStage.startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(
    initialStage?.dueDate
      ? new Date(initialStage.dueDate).toISOString().slice(0, 10)
      : new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
  );
  const [order, setOrder] = useState(initialStage?.order ?? 1);
  const [weight, setWeight] = useState(initialStage?.weight ?? 10);
  const [description, setDescription] = useState(initialStage?.description ?? "");

  if (!isOpen) return null;

  // Função para aplicar template das 14 etapas canônicas com 1 clique
  function applyTemplate(template: CanonicalStageTemplate) {
    setName(template.name);
    setDiscipline(template.discipline);
    setDesigner(template.designer);
    setWeight(template.weight);
    setOrder(template.order);
    setDescription(template.scopeDescription);

    const start = new Date();
    setStartDate(start.toISOString().slice(0, 10));
    const due = new Date(start.getTime() + template.durationDays * 86_400_000);
    setDueDate(due.toISOString().slice(0, 10));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const payload = {
      id: initialStage?.id,
      projectId,
      name: name.trim(),
      discipline: discipline.trim() || null,
      designer: designer.trim() || null,
      description: description.trim() || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      order: Number(order),
      completion: initialStage?.completion ?? 0,
    };

    startTransition(async () => {
      try {
        await saveScheduleStageAction(payload);
        router.refresh();
        if (onSaved) onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gravar etapa.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Apple HIG */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/70">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Cronograma Operacional
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {initialStage?.id ? "Editar Etapa do Cronograma" : "Nova Etapa do Cronograma"}
            </h2>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* 1. Seletores Rápidos com as 14 Etapas Canônicas */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Seleção Rápida (14 Etapas Canônicas do Estúdio):
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-2xl bg-slate-50 border border-slate-200/80">
              {CANONICAL_STAGES.map((template) => {
                const isSelected = name === template.name;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="opacity-60 mr-1">#{template.order}</span>
                    {template.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Informações Técnicas da Fase (Desacopladas) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                1
              </span>
              Informações Técnicas da Fase
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Etapa / Fase *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Projeto Executivo de Arquitetura"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Disciplina Técnica
                </label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Arquitetura">Arquitetura (Índigo)</option>
                  <option value="Estrutura">Estrutura (Âmbar)</option>
                  <option value="Projeto 3D">Projeto 3D (Magenta)</option>
                  <option value="Complementares">Complementares (Azul Elétrico)</option>
                  <option value="Execução de Obra">Execução de Obra (Verde Esmeralda)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Responsável Técnico
                </label>
                <select
                  value={designer}
                  onChange={(e) => setDesigner(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Eduardo Marques">Eduardo Marques (Arquiteto / 3D / MEP)</option>
                  <option value="Luan Almeida">Luan Almeida (Engenheiro Estrutural)</option>
                  <option value="Erick Santiago">Erick Santiago (Engenheiro de Obra)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prazo de Conclusão (Due Date)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Peso Ponderado no Avanço Geral (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-center font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400">Impacto físico no painel executivo</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ordem de Apresentação
                </label>
                <input
                  type="number"
                  min="1"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-center font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* 3. Descrição Detalhada do Escopo (Desacoplada) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                2
              </span>
              Descrição Detalhada do Escopo e Entregáveis
            </h3>
            <p className="text-xs text-slate-500">
              Descreva detalhadamente o que contempla esta entrega técnica para que o cliente e a equipe visualizem com clareza.
            </p>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Plantas baixas cotadas em escala 1:50, cortes transversais e longitudinais, paginação de pisos e memorial descritivo em PDF..."
              className="w-full rounded-2xl border border-slate-200 p-4 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Footer de Ações Apple-style */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isPending ? "Gravando no Neon..." : "Salvar Etapa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

