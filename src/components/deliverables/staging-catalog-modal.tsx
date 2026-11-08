"use client";

import { useState, useEffect } from "react";
import type {
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
  DeliverableType,
} from "@prisma/client";
import { parseSheetFileName } from "@/lib/sheet-metadata-parser";
import type { StageOption } from "./sheet-metadata-modal";

export interface StagedDeliverableItem {
  id: string; // id temporário local
  file: File;
  previewUrl: string;
  sheetCode: string;
  title: string;
  subtitle: string;
  subject: string;
  discipline: ProjectDiscipline;
  phaseFolder: ProjectStagePhase;
  category: AcervoCategory;
  type: DeliverableType;
  stageId: string;
  version: string;
  description: string;
  isClientView: boolean;
  isRequired: boolean;
}

interface StagingCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedPhaseFolder: ProjectStagePhase, savedDiscipline: ProjectDiscipline) => void;
  projectId: string;
  files: File[];
  stages: StageOption[];
  defaultPhase?: ProjectStagePhase;
  defaultDiscipline?: ProjectDiscipline;
}

const PRESET_SUBJECTS = [
  "Plantas Baixas e Layout",
  "Cortes e Fachadas",
  "Formas e Armaduras",
  "Locação de Fundação",
  "Memorial de Cálculo",
  "Memorial Descritivo",
  "Vista Renderizada",
  "Projeto Luminotécnico & Força",
  "Instalações Hidrossanitárias",
  "Combate a Incêndio (PPCI)",
];

const PHASE_OPTIONS: Array<{ value: ProjectStagePhase; label: string; icon: string }> = [
  { value: "PROJETO_PRELIMINAR", label: "Projeto Preliminar", icon: "📐" },
  { value: "PROJETO_LEGAL", label: "Projeto Legal", icon: "🏛️" },
  { value: "PROJETO_EXECUTIVO", label: "Projeto Executivo", icon: "🏗️" },
];

const DISCIPLINE_OPTIONS: Array<{ value: ProjectDiscipline; label: string }> = [
  { value: "ARQUITETURA", label: "Arquitetura" },
  { value: "ESTRUTURAL", label: "Estrutural (TQS)" },
  { value: "HIDROSSANITARIO", label: "Hidrossanitário (Revit)" },
  { value: "ELETRICO", label: "Elétrico & Iluminação (Revit)" },
  { value: "COMBATE_INCENDIO", label: "Combate a Incêndio (PPCI)" },
  { value: "RENDER_3D", label: "Renders 3D (Corona)" },
  { value: "LEGAL_APROVACAO", label: "Documentação Legal / ART" },
  { value: "HVAC", label: "Climatização (HVAC)" },
  { value: "INTERIORES", label: "Interiores & Marcenaria" },
  { value: "COMPATIBILIZACAO", label: "Compatibilização Global" },
  { value: "GERAL", label: "Coordenação Geral" },
];

const CATEGORY_OPTIONS: Array<{ value: AcervoCategory; label: string }> = [
  { value: "PLANTA_TECNICA_PDF", label: "Plantas Técnicas (PDF)" },
  { value: "DOCUMENTACAO_MEMORIAL", label: "Documentação & Memoriais (Cálculos e Descritivos)" },
  { value: "IMAGEM_RENDER", label: "Imagens & Renders 3D" },
];

export function StagingCatalogModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  files,
  stages,
  defaultPhase = "PROJETO_EXECUTIVO",
  defaultDiscipline = "ARQUITETURA",
}: StagingCatalogModalProps) {
  const [items, setItems] = useState<StagedDeliverableItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Inicializa os arquivos com dados inferidos ao abrir
  useEffect(() => {
    if (!isOpen || !files.length) {
      setItems([]);
      setSelectedIndex(0);
      setErrorMessage("");
      return;
    }

    const createdItems: StagedDeliverableItem[] = files.map((file, idx) => {
      const parsed = parseSheetFileName(file.name);
      const url = URL.createObjectURL(file);

      // Determinar categoria inicial
      let cat: AcervoCategory = "PLANTA_TECNICA_PDF";
      if (
        file.type.startsWith("image/") ||
        file.name.match(/\.(png|jpg|jpeg|webp)$/i) ||
        parsed.type === "RENDER_3D"
      ) {
        cat = "IMAGEM_RENDER";
      } else if (
        parsed.type === "MEMORIAL_DESCRITIVO" ||
        parsed.type === "ESPECIFICACAO_TECNICA" ||
        file.name.match(/(memorial|calculo|art|descritivo)/i)
      ) {
        cat = "DOCUMENTACAO_MEMORIAL";
      }

      // Determinar subpasta normativa
      let phase: ProjectStagePhase = defaultPhase;
      const lower = file.name.toLowerCase();
      if (lower.includes("prelim") || lower.includes("estudo") || lower.includes("conceit")) {
        phase = "PROJETO_PRELIMINAR";
      } else if (lower.includes("legal") || lower.includes("prefeitura") || lower.includes("aprov")) {
        phase = "PROJETO_LEGAL";
      }

      // Tentar associar etapa sugerida
      let stageId = "";
      if (parsed.suggestedStageName) {
        const found = stages.find(
          (s) =>
            s.name.toLowerCase().includes(parsed.suggestedStageName!.toLowerCase()) ||
            parsed.suggestedStageName!.toLowerCase().includes(s.name.toLowerCase()),
        );
        if (found) stageId = found.id;
      }

      return {
        id: `staging-${idx}-${Date.now()}`,
        file,
        previewUrl: url,
        sheetCode: parsed.sheetCode || `DOC-${idx + 1}`,
        title: parsed.title || `${parsed.sheetCode || "PRANCHA"} - ${parsed.subject}`,
        subtitle: "",
        subject: parsed.subject || "Plantas Baixas e Layout",
        discipline: parsed.discipline || defaultDiscipline,
        phaseFolder: phase,
        category: cat,
        type: parsed.type || "PRANCHA_EXECUTIVA",
        stageId,
        version: parsed.version || "R00",
        description: "",
        isClientView: true,
        isRequired: true,
      };
    });

    setItems(createdItems);
    setSelectedIndex(0);

    return () => {
      createdItems.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
  }, [isOpen, files, stages, defaultPhase, defaultDiscipline]);

  if (!isOpen || !items.length) return null;

  const activeItem = items[selectedIndex];

  const updateActiveItem = (fields: Partial<StagedDeliverableItem>) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === selectedIndex ? { ...item, ...fields } : item)),
    );
  };

  const handleConfirmCatalog = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const formData = new FormData();
      items.forEach((item) => {
        formData.append("files", item.file);
      });

      const metadataPayload = items.map((item) => ({
        sheetCode: item.sheetCode,
        title: item.title,
        subtitle: item.subtitle,
        subject: item.subject,
        discipline: item.discipline,
        phaseFolder: item.phaseFolder,
        category: item.category,
        type: item.type,
        stageId: item.stageId || null,
        version: item.version,
        description: item.description,
        isClientView: item.isClientView,
        isRequired: item.isRequired,
      }));

      formData.append("metadata", JSON.stringify(metadataPayload));

      const res = await fetch(`/api/projects/${projectId}/deliverables/batch`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao catalogar pranchas no acervo.");
      }

      // Notifica com a fase e disciplina do primeiro item para navegação direta
      onSuccess(activeItem.phaseFolder, activeItem.discipline);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha na catalogação.");
    } finally {
      setLoading(false);
    }
  };

  const isPdf =
    activeItem?.file.type === "application/pdf" ||
    activeItem?.file.name.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Cabeçalho da Janela de Catalogação */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">
              📁
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Janela Temporária de Catalogação
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {items.length} arquivo(s) na fila pós-upload
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                Conferência Técnica & Catalogação no Acervo
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Corpo com Grid Split: Lista/Preview à Esquerda, Formulário de Catalogação à Direita */}
        <div className="grid flex-1 overflow-y-auto lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* ========================================================= */}
          {/* COLUNA ESQUERDA: NAVEGADOR DE ARQUIVOS + MINIATURA PREVIEW */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 flex flex-col bg-slate-100/70 p-4 sm:p-5">
            {/* Lista de Arquivos Carregados (Se houver mais de 1) */}
            {items.length > 1 && (
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Arquivos na Fila ({items.length})
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {items.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selectedIndex === idx
                          ? "border-blue-600 bg-white shadow-sm ring-1 ring-blue-600 text-blue-900 font-bold"
                          : "border-slate-200 bg-white/70 text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span className="text-sm">{item.file.name.endsWith(".pdf") ? "📄" : "🖼️"}</span>
                      <div className="max-w-[140px] truncate">
                        <p className="truncate font-semibold">{item.sheetCode || item.file.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.subject}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Painel de Miniatura / Preview Rápido */}
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Preview Visual de Conferência
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {(activeItem.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>

              <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner flex items-center justify-center">
                {isPdf ? (
                  <iframe
                    src={`${activeItem.previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                    className="h-full w-full min-h-[350px] border-none"
                    title={`Preview ${activeItem.file.name}`}
                  />
                ) : (
                  <img
                    src={activeItem.previewUrl}
                    alt={activeItem.file.name}
                    className="max-h-[420px] max-w-full object-contain p-2"
                  />
                )}
              </div>

              <div className="mt-3 rounded-xl bg-blue-50/80 p-3 text-[11px] text-blue-800 border border-blue-200/80">
                <p className="font-semibold">🔍 Conferência Visual:</p>
                <p className="mt-0.5 text-blue-700">
                  Verifique o carimbo técnico e cotas antes de confirmar o cadastro no acervo definitivo.
                </p>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUNA DIREITA: FORMULÁRIO DE METADADOS DA PRANCHA ATIVA   */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 flex flex-col justify-between p-5 sm:p-6 bg-white">
            <div className="space-y-4">
              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {errorMessage}
                </div>
              )}

              {/* 1. Código da Prancha & Revisão */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-7">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Código da Prancha *
                  </label>
                  <input
                    type="text"
                    required
                    value={activeItem.sheetCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      updateActiveItem({
                        sheetCode: code,
                        title: code ? `${code} · ${activeItem.subject}` : activeItem.subject,
                      });
                    }}
                    placeholder="Ex: ARQ-01, EST-E01, HID-H01"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold uppercase text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="col-span-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Revisão *
                  </label>
                  <div className="mt-1 flex items-center gap-1">
                    {["R00", "R01", "R02", "R03"].map((rev) => (
                      <button
                        key={rev}
                        type="button"
                        onClick={() => updateActiveItem({ version: rev })}
                        className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                          activeItem.version === rev
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {rev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Assunto da Planta (Dropdown com Preset + Custom) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Assunto da Planta / Prancha *
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={PRESET_SUBJECTS.includes(activeItem.subject) ? activeItem.subject : "__CUSTOM__"}
                    onChange={(e) => {
                      if (e.target.value !== "__CUSTOM__") {
                        const subj = e.target.value;
                        updateActiveItem({
                          subject: subj,
                          title: activeItem.sheetCode ? `${activeItem.sheetCode} · ${subj}` : subj,
                        });
                      }
                    }}
                    className="w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    <option value="" disabled>Selecione um assunto...</option>
                    {PRESET_SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__CUSTOM__">✍️ Outro (digitar manual)...</option>
                  </select>

                  <input
                    type="text"
                    required
                    value={activeItem.subject}
                    onChange={(e) => {
                      const subj = e.target.value;
                      updateActiveItem({
                        subject: subj,
                        title: activeItem.sheetCode ? `${activeItem.sheetCode} · ${subj}` : subj,
                      });
                    }}
                    placeholder="Ou digite o assunto específico..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. Título Principal & Subtítulo Conjugado */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-7">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Título Principal *
                  </label>
                  <input
                    type="text"
                    required
                    value={activeItem.title}
                    onChange={(e) => updateActiveItem({ title: e.target.value })}
                    placeholder="Ex: ARQ-01 · Planta Baixa Térreo"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="col-span-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Subtítulo Conjugado
                  </label>
                  <input
                    type="text"
                    value={activeItem.subtitle}
                    onChange={(e) => updateActiveItem({ subtitle: e.target.value })}
                    placeholder="Ex: Layout Humanizado, Cotas e Níveis"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* 4. Disciplina & Fase / Subpasta Destino */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Disciplina *
                  </label>
                  <select
                    value={activeItem.discipline}
                    onChange={(e) => updateActiveItem({ discipline: e.target.value as ProjectDiscipline })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {DISCIPLINE_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Fase / Subpasta Destino *
                  </label>
                  <select
                    value={activeItem.phaseFolder}
                    onChange={(e) => updateActiveItem({ phaseFolder: e.target.value as ProjectStagePhase })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {PHASE_OPTIONS.map((ph) => (
                      <option key={ph.value} value={ph.value}>
                        {ph.icon} {ph.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Categoria do Acervo & Etapa do Cronograma */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Categoria do Acervo *
                  </label>
                  <select
                    value={activeItem.category}
                    onChange={(e) => updateActiveItem({ category: e.target.value as AcervoCategory })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Etapa do Cronograma
                  </label>
                  <select
                    value={activeItem.stageId}
                    onChange={(e) => updateActiveItem({ stageId: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    <option value="">Não vinculada diretamente</option>
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.discipline ? `(${st.discipline})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 6. Descrição / Observações da Revisão */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Descrição / Observações da Revisão
                </label>
                <textarea
                  rows={2}
                  value={activeItem.description}
                  onChange={(e) => updateActiveItem({ description: e.target.value })}
                  placeholder="Anotações de revisão técnica, pranchas complementares referenciadas ou especificações de execução..."
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* 7. Visibilidade no Portal do Cliente */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                <div>
                  <p className="font-bold text-slate-800">Liberar no Portal do Cliente</p>
                  <p className="text-[11px] text-slate-500">Permite que o contratante visualize a prancha online</p>
                </div>
                <input
                  type="checkbox"
                  checked={activeItem.isClientView}
                  onChange={(e) => updateActiveItem({ isClientView: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Rodapé com Ações */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-500 font-medium">
                Prancha {selectedIndex + 1} de {items.length}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCatalog}
                  disabled={loading}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
                >
                  {loading
                    ? "Gravando no Acervo..."
                    : `Confirmar e Cadastrar no Acervo (${items.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

