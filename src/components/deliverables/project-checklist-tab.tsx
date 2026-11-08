"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  toggleChecklistItem,
  createChecklistItem,
  updateChecklistNotes,
  deleteChecklistItem,
  type ChecklistItemData,
} from "@/server/actions/checklist";

interface ProjectChecklistTabProps {
  projectId: string;
  initialItems: ChecklistItemData[];
  stages?: Array<{ id: string; name: string }>;
  currentUser?: { name: string; role?: string } | null;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Aprovação Legal & Prefeitura": {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  "Compatibilização Técnica (Estrutura x MEP)": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  "Responsabilidade Técnica & ARTs": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  "Liberação para Execução em Canteiro": {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
};

export function ProjectChecklistTab({
  projectId,
  initialItems,
  stages = [],
  currentUser,
}: ProjectChecklistTabProps) {
  const [items, setItems] = useState<ChecklistItemData[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  // Estados de UI
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  // Formulário de novo item
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState("Liberação para Execução em Canteiro");
  const [newNotes, setNewNotes] = useState("");
  const [newStageId, setNewStageId] = useState("");

  const defaultVerifier = currentUser?.name || "Eduardo Marques (CAU)";

  // Métricas
  const totalItems = items.length;
  const completedItems = items.filter((i) => i.isCompleted).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Itens críticos (Estrutura, ARTs e Liberação de Canteiro)
  const criticalItems = items.filter(
    (i) =>
      i.category.includes("Estrutura") ||
      i.category.includes("ART") ||
      i.category.includes("Canteiro")
  );
  const isAptoCanteiro =
    criticalItems.length > 0 && criticalItems.every((i) => i.isCompleted);

  // Categorias únicas presentes
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const defaultOrder = [
    "Aprovação Legal & Prefeitura",
    "Compatibilização Técnica (Estrutura x MEP)",
    "Responsabilidade Técnica & ARTs",
    "Liberação para Execução em Canteiro",
  ];
  const sortedCategories = [
    ...defaultOrder.filter((c) => categories.includes(c)),
    ...categories.filter((c) => !defaultOrder.includes(c)),
  ];

  // 1. Alternar Checkbox com Atualização Otimista
  const handleToggle = (item: ChecklistItemData) => {
    const nextCompleted = !item.isCompleted;
    const now = new Date();

    // Atualização otimista
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        return {
          ...i,
          isCompleted: nextCompleted,
          verifiedBy: nextCompleted ? defaultVerifier : null,
          verifiedAt: nextCompleted ? now : null,
          completedAt: nextCompleted ? now : null,
        };
      })
    );

    startTransition(async () => {
      try {
        const res = await toggleChecklistItem(
          item.id,
          projectId,
          nextCompleted,
          defaultVerifier
        );
        if (!res.success) {
          // Reverte se falhou
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? item : i))
          );
        }
      } catch (e) {
        console.error("Erro ao alternar item:", e);
        setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      }
    });
  };

  // 2. Salvar Notas do Item
  const handleSaveNotes = async (itemId: string) => {
    const noteText = editingNotes[itemId] ?? "";
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, notes: noteText } : i))
    );
    setOpenNotesId(null);

    startTransition(async () => {
      try {
        await updateChecklistNotes(itemId, projectId, noteText);
      } catch (e) {
        console.error("Erro ao salvar nota:", e);
      }
    });
  };

  // 3. Adicionar Novo Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    startTransition(async () => {
      try {
        const res = await createChecklistItem({
          projectId,
          category: newCategory,
          task: newTask,
          notes: newNotes,
          stageId: newStageId || undefined,
          verifiedBy: defaultVerifier,
        });

        if (res.success && res.item) {
          setItems((prev) => [...prev, res.item as ChecklistItemData]);
          setNewTask("");
          setNewNotes("");
          setNewStageId("");
          setShowAddModal(false);
        }
      } catch (e) {
        console.error("Erro ao criar item:", e);
      }
    });
  };

  // 4. Excluir Item
  const handleDeleteItem = async (itemId: string, taskTitle: string) => {
    if (!confirm(`Remover "${taskTitle}" do checklist?`)) return;

    setItems((prev) => prev.filter((i) => i.id !== itemId));

    startTransition(async () => {
      try {
        await deleteChecklistItem(itemId, projectId);
      } catch (e) {
        console.error("Erro ao excluir item:", e);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Métricas de Avanço Documental (Topo) */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Controle de Canteiro
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Auditoria Técnica & Liberações
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-bold text-slate-900 font-sans">
              Checklist de Obra & Liberação Técnica
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Conferência mandatória de ARTs, memoriais, compatibilizações TQS x Revit e locação de fundações.
            </p>
          </div>

          {/* Badges de Status Geral */}
          <div className="flex flex-wrap items-center gap-2">
            {isAptoCanteiro ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ✓ Apto para Canteiro
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                ⚠️ Pendências Técnicas
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Adicionar Item
            </button>
          </div>
        </div>

        {/* Barra de Progresso Visual */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Avanço de Validação:{" "}
              <strong className="text-blue-600">
                {completedItems} de {totalItems} verificados
              </strong>
            </span>
            <span className="font-mono font-bold text-slate-900">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2.5 rounded-full bg-slate-100" />
        </div>
      </Card>

      {/* 2. Categorias e Itens de Checklist */}
      <div className="space-y-6">
        {sortedCategories.map((category) => {
          const categoryItems = items.filter((i) => i.category === category);
          const catCompleted = categoryItems.filter((i) => i.isCompleted).length;
          const catTotal = categoryItems.length;
          const catColors = CATEGORY_COLORS[category] || {
            bg: "bg-slate-50",
            text: "text-slate-700",
            border: "border-slate-200",
          };

          return (
            <Card
              key={category}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
            >
              {/* Category Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${catColors.bg} ${catColors.text} ${catColors.border}`}
                  >
                    {category}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {catCompleted}/{catTotal} concluídos
                  </span>
                </div>
                <div className="w-24">
                  <Progress
                    value={catTotal > 0 ? (catCompleted / catTotal) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="mt-4 divide-y divide-slate-100 font-sans">
                {categoryItems.map((item) => {
                  const isNotesOpen = openNotesId === item.id;
                  const currentNoteValue =
                    editingNotes[item.id] !== undefined
                      ? editingNotes[item.id]
                      : item.notes || "";

                  return (
                    <div
                      key={item.id}
                      className="group py-3.5 first:pt-1 last:pb-1 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Checkbox + Task Name */}
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggle(item)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border text-white transition-all duration-150 ${
                              item.isCompleted
                                ? "border-blue-600 bg-blue-600 shadow-sm"
                                : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
                            }`}
                          >
                            {item.isCompleted && (
                              <svg className="h-3.5 w-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1">
                            <p
                              className={`text-xs font-semibold transition-all ${
                                item.isCompleted
                                  ? "text-slate-500 line-through decoration-slate-300"
                                  : "text-slate-900"
                              }`}
                            >
                              {item.task}
                            </p>

                            {/* Carimbo de Validação */}
                            {item.isCompleted && item.verifiedBy && (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Validado por {item.verifiedBy}
                                {item.verifiedAt && (
                                  <span className="text-slate-400">
                                    • {new Date(item.verifiedAt).toLocaleDateString("pt-BR")}{" "}
                                    {new Date(item.verifiedAt).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </p>
                            )}

                            {/* Resumo da Nota se Fechada */}
                            {!isNotesOpen && item.notes && (
                              <p className="mt-1 text-[11px] text-slate-500 italic bg-slate-50/80 rounded-lg p-1.5 border border-slate-100">
                                💬 {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ações (Notas & Excluir) */}
                        <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              if (isNotesOpen) {
                                setOpenNotesId(null);
                              } else {
                                setOpenNotesId(item.id);
                                setEditingNotes((prev) => ({
                                  ...prev,
                                  [item.id]: item.notes || "",
                                }));
                              }
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                              isNotesOpen
                                ? "bg-blue-50 text-blue-700"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            }`}
                            title="Anotações e Recomendações"
                          >
                            💬 Notas
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.task)}
                            className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Remover item"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Campo Colapsável de Notas Técnicas */}
                      {isNotesOpen && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 animate-in fade-in duration-150">
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Observações Técnicas & Recomendações de Canteiro:
                          </label>
                          <textarea
                            value={currentNoteValue}
                            onChange={(e) =>
                              setEditingNotes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="Insira detalhes de cobrimento, número de ART, normas ou detalhes construtivos..."
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenNotesId(null)}
                              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 transition"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveNotes(item.id)}
                              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 transition"
                            >
                              Salvar Observação
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 3. Modal de Adicionar Item ao Checklist */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                + Novo Item de Checklist Técnico
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Categoria de Engenharia *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Aprovação Legal & Prefeitura">Aprovação Legal & Prefeitura</option>
                  <option value="Compatibilização Técnica (Estrutura x MEP)">Compatibilização Técnica (Estrutura x MEP)</option>
                  <option value="Responsabilidade Técnica & ARTs">Responsabilidade Técnica & ARTs</option>
                  <option value="Liberação para Execução em Canteiro">Liberação para Execução em Canteiro</option>
                  <option value="Outros Controles">Outros Controles</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tarefa / Verificação Técnica *
                </label>
                <input
                  type="text"
                  required
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Ex: Conferência do cobrimento mínimo de estacas e armaduras"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Etapa do Cronograma Vinculada (Opcional)
                </label>
                <select
                  value={newStageId}
                  onChange={(e) => setNewStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Nenhuma etapa específica</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações Técnicas Iniciais (Opcional)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Orientações e especificações técnicas de canteiro..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
                >
                  {isPending ? "Gravando..." : "Adicionar Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

