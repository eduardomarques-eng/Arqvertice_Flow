"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DISCIPLINE_LABELS,
  APPROVAL_STATUS_LABELS,
} from "@/lib/sheet-metadata-parser";
import type {
  DeliverableData,
  StageOption,
  EnvironmentOption,
  FolderOption,
} from "./sheet-metadata-modal";
import { DeliverableCard, type DeliverableCardItem } from "./deliverable-card";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type {
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
} from "@prisma/client";
import { MASTER_PHASES, MASTER_DISCIPLINES } from "@/lib/master-data";

// Modal de Preview de PDFs e Imagens em alta resolução carregado sob demanda
const DeliverablePreviewModal = dynamic(
  () => import("./deliverable-preview-modal").then((mod) => mod.DeliverablePreviewModal),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-xs z-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

// Janela Temporária de Catalogação Pós-Upload
const StagingCatalogModal = dynamic(
  () => import("./staging-catalog-modal").then((mod) => mod.StagingCatalogModal),
  { ssr: false }
);

// Modal de Edição de Metadados da Prancha
const SheetMetadataModal = dynamic(
  () => import("./sheet-metadata-modal").then((mod) => mod.SheetMetadataModal),
  { ssr: false }
);

// Matriz de Pranchas Normativa
const SheetMatrixView = dynamic(
  () => import("./sheet-matrix-view").then((mod) => mod.SheetMatrixView),
  { ssr: false }
);

export interface ProjectAcervoTabProps {
  projectId: string;
  projectName?: string;
  initialDeliverables: DeliverableCardItem[];
  initialMatrix?: DeliverableMatrix | null;
  stages: StageOption[];
  environments?: EnvironmentOption[];
  folders?: FolderOption[];
  triggerUploadSignal?: number;
}

/**
 * NÍVEL 2: DISCIPLINAS TÉCNICAS HOMOLOGADAS
 */
const CANONICAL_DISCIPLINES: Array<{
  key: string;
  label: string;
  icon: string;
  match: (d: ProjectDiscipline) => boolean;
}> = [
  { key: "TODAS", label: "Todas as Disciplinas", icon: "📁", match: () => true },
  { key: "ARQUITETURA", label: "Arquitetura", icon: "🏛️", match: (d) => d === "ARQUITETURA" },
  {
    key: "ESTRUTURAL",
    label: "Estrutural (TQS)",
    icon: "🏗️",
    match: (d) => d === "ESTRUTURAL" || d === "ESTRUTURA",
  },
  {
    key: "HIDROSSANITARIO",
    label: "Instalações Hidráulicas",
    icon: "💧",
    match: (d) => d === "HIDROSSANITARIO",
  },
  {
    key: "ELETRICO",
    label: "Instalações Elétricas",
    icon: "⚡",
    match: (d) => d === "ELETRICO",
  },
  {
    key: "COMBATE_INCENDIO",
    label: "Combate a Incêndio",
    icon: "🔥",
    match: (d) => d === "COMBATE_INCENDIO",
  },
  {
    key: "RENDER_3D",
    label: "3D Renders",
    icon: "🎨",
    match: (d) => d === "RENDER_3D",
  },
  {
    key: "LEGAL_APROVACAO",
    label: "Memoriais & Documentos / ART",
    icon: "📜",
    match: (d) => d === "LEGAL_APROVACAO" || d === "GERAL",
  },
];

/**
 * NÍVEL 3: FASES NORMATIVAS OBRIGATÓRIAS
 */
const PHASE_SECTIONS: Array<{
  key: ProjectStagePhase;
  label: string;
  icon: string;
  description: string;
}> = MASTER_PHASES.map((p) => ({
  key: p.key as ProjectStagePhase,
  label: p.label,
  icon: p.icon,
  description: p.description,
}));

export function ProjectAcervoTab({
  projectId,
  projectName = "Residência de Praia - Pedro",
  initialDeliverables,
  initialMatrix,
  stages,
  environments = [],
  folders = [],
  triggerUploadSignal,
}: ProjectAcervoTabProps) {
  const [deliverables, setDeliverables] = useState<DeliverableCardItem[]>(initialDeliverables);
  const [matrix, setMatrix] = useState<DeliverableMatrix | null | undefined>(initialMatrix);
  const [loading, setLoading] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Reage ao sinal do Record Banner para abrir upload imediatamente
  useEffect(() => {
    if (triggerUploadSignal && triggerUploadSignal > 0) {
      fileInputRef.current?.click();
    }
  }, [triggerUploadSignal]);

  // Filtros Hierárquicos
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("TODAS");
  const [selectedPhaseFolder, setSelectedPhaseFolder] = useState<string>("TODAS");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [selectedSubject, setSelectedSubject] = useState<string>("TODOS");

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Janela Temporária de Catalogação Pós-Upload (Multi-arquivos)
  const [stagingModalOpen, setStagingModalOpen] = useState(false);
  const [stagingFiles, setStagingFiles] = useState<File[]>([]);

  // Modal de edição individual
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<DeliverableData | null>(null);

  // Modal de visualização em tela cheia
  const [fullscreenDeliverable, setFullscreenDeliverable] = useState<DeliverableCardItem | null>(null);

  // Recarga dos dados após mutações
  const reloadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/deliverables`);
      if (res.ok) {
        const data = await res.json();
        setDeliverables(data.deliverables || []);
        if (data.matrix) setMatrix(data.matrix);
      }
    } catch (e) {
      console.error("Erro ao sincronizar pranchas:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filtragem dos entregáveis com suporte aos 4 níveis
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((item) => {
      // 1. Filtro de Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = item.sheetCode?.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSubtitle = item.subtitle?.toLowerCase().includes(q);
        const matchesSubject = item.subject?.toLowerCase().includes(q);
        const matchesDiscipline = item.discipline.toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesSubtitle && !matchesSubject && !matchesDiscipline) {
          return false;
        }
      }

      // 2. Filtro de Disciplina (Nível 2)
      if (selectedDiscipline !== "TODAS") {
        const discDef = CANONICAL_DISCIPLINES.find((d) => d.key === selectedDiscipline);
        if (discDef && !discDef.match(item.discipline)) {
          return false;
        }
      }

      // 3. Filtro de Subpasta Normativa (Nível 3)
      if (selectedPhaseFolder !== "TODAS") {
        const currentPhase = item.phaseFolder || "PROJETO_EXECUTIVO";
        if (currentPhase !== selectedPhaseFolder) {
          return false;
        }
      }

      // 4. Filtro de Categoria
      if (selectedCategory !== "TODAS") {
        const currentCat = item.category || "PLANTA_TECNICA_PDF";
        if (currentCat !== selectedCategory) {
          return false;
        }
      }

      // 5. Filtro de Assunto Técnico (Nível 4)
      if (selectedSubject !== "TODOS") {
        const subj = item.subject?.trim() || "Geral";
        if (subj !== selectedSubject) {
          return false;
        }
      }

      return true;
    });
  }, [
    deliverables,
    searchQuery,
    selectedDiscipline,
    selectedPhaseFolder,
    selectedCategory,
    selectedSubject,
  ]);

  // Lista de Assuntos únicos disponíveis no filtro atual
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    deliverables.forEach((d) => {
      if (d.subject?.trim()) set.add(d.subject.trim());
    });
    return Array.from(set).sort();
  }, [deliverables]);

  // Upload Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setStagingFiles(files);
    setStagingModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    setStagingFiles(files);
    setStagingModalOpen(true);
  };

  // Abrir modal de edição individual
  const handleEdit = (item: DeliverableCardItem) => {
    setEditData({
      id: item.id,
      sheetCode: item.sheetCode || "",
      subject: item.subject,
      title: item.title,
      subtitle: item.subtitle,
      discipline: item.discipline,
      phaseFolder: item.phaseFolder,
      category: item.category,
      type: item.type,
      version: item.version,
      stageId: item.stageId,
      environmentId: item.environmentId,
      description: item.description,
      status: item.status,
      isClientView: item.isClientView,
      isRequired: item.isRequired,
      fileSize: item.fileSize,
      fileUrl: item.fileUrl,
    });
    setEditModalOpen(true);
  };

  // Excluir prancha
  const handleDelete = async (id: string, sheetCode: string | null) => {
    const label = sheetCode ? `a prancha [${sheetCode}]` : "este entregável";
    if (!window.confirm(`Tem certeza que deseja remover ${label} do acervo?`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await reloadData();
      } else {
        alert("Erro ao excluir entregável.");
      }
    } catch {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // Rótulos para os breadcrumbs hierárquicos
  const activeDisciplineObj = CANONICAL_DISCIPLINES.find((d) => d.key === selectedDiscipline);
  const activePhaseObj = PHASE_SECTIONS.find((p) => p.key === selectedPhaseFolder);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* NÍVEL 1 & BREADCRUMBS HIERÁRQUICOS ESTRITOS (PROJETO → DISCIPLINA → FASE)  */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumbs de Navegação */}
          <div className="flex items-center gap-1.5 text-xs font-semibold overflow-x-auto py-0.5">
            {/* Nível 1: Projeto */}
            <span className="flex items-center gap-1.5 text-zinc-900 font-bold bg-zinc-100 px-2.5 py-1 rounded-lg">
              🏢 {projectName}
            </span>
            <span className="text-zinc-400 font-normal">/</span>

            {/* Nível 2: Disciplina */}
            <button
              type="button"
              onClick={() => setSelectedDiscipline("TODAS")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                selectedDiscipline === "TODAS"
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <span>{activeDisciplineObj?.icon || "📁"}</span>
              <span>{activeDisciplineObj?.label || "Todas as Disciplinas"}</span>
            </button>
            <span className="text-zinc-400 font-normal">/</span>

            {/* Nível 3: Fase Normativa */}
            <button
              type="button"
              onClick={() => setSelectedPhaseFolder("TODAS")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                selectedPhaseFolder === "TODAS"
                  ? "bg-blue-50 text-blue-700 font-bold"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <span>{activePhaseObj?.icon || "📂"}</span>
              <span>{activePhaseObj?.label || "Todas as Fases"}</span>
            </button>

            {/* Nível 4: Assunto Técnico (se filtrado) */}
            {selectedSubject !== "TODOS" && (
              <>
                <span className="text-zinc-400 font-normal">/</span>
                <span className="flex items-center gap-1 bg-amber-50 text-amber-800 font-bold px-2 py-1 rounded-lg">
                  🏷️ {selectedSubject}
                  <button
                    type="button"
                    onClick={() => setSelectedSubject("TODOS")}
                    className="ml-1 text-amber-600 hover:text-amber-900"
                  >
                    ×
                  </button>
                </span>
              </>
            )}
          </div>

          {/* Botões de Ação Global à Direita */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 shadow-xs hover:bg-zinc-50 active:scale-[0.98] transition-transform duration-75 select-none"
            >
              <span>{viewMode === "cards" ? "☰ Ver em Tabela" : "⊞ Ver em Cards"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMatrix(!showMatrix)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border active:scale-[0.98] transition-transform duration-75 select-none ${
                showMatrix
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <span>{showMatrix ? "Ocultar Matriz" : "Matriz de Pranchas"}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition-transform duration-75 select-none"
            >
              <span>+</span> Upload de Pranchas
            </button>
          </div>
        </div>
      </div>

      {/* Matriz de Pranchas Expansível */}
      {showMatrix && matrix && (
        <Card className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm">
          <SheetMatrixView
            matrix={matrix}
            projectId={projectId}
          />
        </Card>
      )}

      {/* ========================================================================= */}
      {/* NÍVEL 2: NAVEGADOR DE DISCIPLINAS TÉCNICAS (ABAS HORIZONTAIS)             */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 border-b border-zinc-200/80">
        {CANONICAL_DISCIPLINES.map((d) => {
          const isActive = selectedDiscipline === d.key;
          const count = deliverables.filter((item) => d.match(item.discipline)).length;

          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedDiscipline(d.key)}
              className={`flex min-h-[44px] items-center gap-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap rounded-t-xl border-b-2 -mb-[1px] active:scale-[0.98] transition-transform duration-75 select-none ${
                isActive
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              <span>{d.icon}</span>
              <span>{d.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  isActive ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros Complementares: Subpastas Normativas & Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-zinc-50/70 p-3 rounded-2xl border border-zinc-200/70">
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Subpasta Normativa (Nível 3) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Fase:
            </span>
            <select
              aria-label="Filtrar por subpasta normativa"
              value={selectedPhaseFolder}
              onChange={(e) => setSelectedPhaseFolder(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs focus:border-blue-500 focus:outline-none"
            >
              <option value="TODAS">Todas as Fases Normativas</option>
              {PHASE_SECTIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.icon} {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Assunto Técnico (Nível 4) */}
          {availableSubjects.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Assunto:
              </span>
              <select
                aria-label="Filtrar por assunto técnico"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs focus:border-blue-500 focus:outline-none"
              >
                <option value="TODOS">Todos os Assuntos Técnicos</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Input de Busca Textual */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por código, título ou assunto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Input de Arquivos Oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.dwg"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Zona de Drag & Drop para Upload de Pranchas */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20"
            : "border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
        }`}
      >
        <p className="text-xs font-bold text-zinc-700">
          Arraste e solte arquivos PDF, imagens ou DWG aqui para catalogar no acervo
        </p>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Suporte a pranchas de arquitetura, estrutural TQS, instalações e renders
        </p>
      </div>

      {/* ========================================================================= */}
      {/* NÍVEL 3 (FASES NORMATIVAS) E NÍVEL 4 (AGRUPAMENTO POR ASSUNTO TÉCNICO)    */}
      {/* ========================================================================= */}
      {filteredDeliverables.length === 0 ? (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-200/60 text-xl text-zinc-400">
            📁
          </div>
          <p className="mt-3 text-sm font-bold text-zinc-800">
            Nenhuma prancha cadastrada {selectedPhaseFolder !== "TODAS" ? `no ${PHASE_SECTIONS.find((p) => p.key === selectedPhaseFolder)?.label || selectedPhaseFolder}` : "neste filtro"}.
          </p>
          <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
            Carregue os arquivos para alimentar a hierarquia técnica do acervo.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-95"
          >
            Clique para carregar pranchas
          </button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="space-y-8">
          {/* Se o usuário filtrou uma subpasta normativa específica */}
          {selectedPhaseFolder !== "TODAS" ? (
            <div className="space-y-6">
              {(() => {
                const groups: Record<string, typeof filteredDeliverables> = {};
                filteredDeliverables.forEach((d) => {
                  const s = d.subject?.trim() || "Plantas e Documentos Gerais";
                  if (!groups[s]) groups[s] = [];
                  groups[s].push(d);
                });
                return Object.entries(groups).map(([subjectName, items]) => (
                  <div key={subjectName} className="space-y-3">
                    {/* Header do Nível 4: Assunto Técnico */}
                    <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-1.5">
                      <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">
                        🏷️ {subjectName}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-600">
                        {items.length} {items.length === 1 ? "prancha" : "pranchas"}
                      </span>
                    </div>

                    {/* Grade de Cards com Código + Título & Subtítulo conjugados */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {items.map((item) => (
                        <DeliverableCard
                          key={item.id}
                          deliverable={item}
                          projectId={projectId}
                          onView={(d) => setFullscreenDeliverable(d)}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            /* Se estiver em "Todas as Fases", exibe a árvore completa: Nível 3 (Fases) → Nível 4 (Assunto) */
            PHASE_SECTIONS.map((phase) => {
              const itemsInPhase = filteredDeliverables.filter(
                (d) => (d.phaseFolder || "PROJETO_EXECUTIVO") === phase.key,
              );

              const groups: Record<string, typeof itemsInPhase> = {};
              itemsInPhase.forEach((d) => {
                const s = d.subject?.trim() || "Plantas e Documentos Gerais";
                if (!groups[s]) groups[s] = [];
                groups[s].push(d);
              });
              const subjectEntries = Object.entries(groups);

              return (
                <div key={phase.key} className="space-y-4">
                  {/* Header do Nível 3: Subpasta Normativa */}
                  <div className="flex items-center justify-between border-b border-zinc-200/90 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{phase.icon}</span>
                      <h4 className="text-sm font-bold text-zinc-900 tracking-tight">
                        {phase.label}
                      </h4>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-600">
                        {itemsInPhase.length} {itemsInPhase.length === 1 ? "prancha" : "pranchas"}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 hidden sm:inline">
                      {phase.description}
                    </span>
                  </div>

                  {itemsInPhase.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6 text-center">
                      <p className="text-xs font-bold text-zinc-700">
                        Nenhuma prancha cadastrada no {phase.label}.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhaseFolder(phase.key);
                          fileInputRef.current?.click();
                        }}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-xs hover:bg-zinc-100 transition active:scale-95"
                      >
                        Carregar arquivos para {phase.label}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Nível 4: Assuntos Técnicos dentro da Fase */}
                      {subjectEntries.map(([subjectName, items]) => (
                        <div key={subjectName} className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-zinc-100 pb-1">
                            <span className="text-xs font-bold text-zinc-800 flex items-center gap-1">
                              🏷️ {subjectName}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.2 font-mono text-[10px] font-semibold text-zinc-500">
                              {items.length} {items.length === 1 ? "prancha" : "pranchas"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {items.map((item) => (
                              <DeliverableCard
                                key={item.id}
                                deliverable={item}
                                projectId={projectId}
                                onView={(d) => setFullscreenDeliverable(d)}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Visualização em Tabela de Alta Densidade (Linear LDS) */
        <Card className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-bold uppercase tracking-wider text-zinc-500 h-10">
                  <th className="py-2 pl-3 pr-2 font-mono">Código</th>
                  <th className="py-2 px-2">Prancha / Título & Subtítulo Conjugados</th>
                  <th className="py-2 px-2">Fase Normativa</th>
                  <th className="py-2 px-2">Assunto Técnico</th>
                  <th className="py-2 px-2">Disciplina</th>
                  <th className="py-2 px-2 font-mono">Versão</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDeliverables.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/80 transition">
                    <td className="py-2.5 pl-3 pr-2 font-mono font-bold text-blue-700">
                      {item.sheetCode || "—"}
                    </td>
                    <td className="py-2.5 px-2">
                      <p className="font-bold text-zinc-900 leading-snug">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-zinc-500 font-normal leading-snug">
                          {item.subtitle}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-zinc-700">
                      📂 {item.phaseFolder ? (item.phaseFolder === "PROJETO_PRELIMINAR" ? "Preliminar" : item.phaseFolder === "PROJETO_LEGAL" ? "Legal" : "Executivo") : "Executivo"}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                        🏷️ {item.subject}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-semibold text-zinc-800">
                        {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-zinc-900">
                      {item.version}
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge
                        tone={
                          item.status === "APROVADO_CLIENTE" || item.status === "LIBERADO_OBRA"
                            ? "green"
                            : item.status === "APROVADO_INTERNO" || item.status === "REVISAO_INTERNA"
                            ? "blue"
                            : "neutral"
                        }
                      >
                        {APPROVAL_STATUS_LABELS[item.status]?.label || item.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFullscreenDeliverable(item)}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 transition shadow-2xs"
                        >
                          👁️ Ver
                        </button>
                        <a
                          href={`/api/projects/${projectId}/deliverables/${item.id}/file?download=1`}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 transition shadow-2xs"
                        >
                          ⬇️ Baixar
                        </a>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-bold text-zinc-600 hover:bg-zinc-100 transition shadow-2xs"
                        >
                          ✏️ Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de Catalogação Inicial (Upload Múltiplo) */}
      <StagingCatalogModal
        isOpen={stagingModalOpen}
        onClose={() => setStagingModalOpen(false)}
        onSuccess={async () => {
          setStagingModalOpen(false);
          await reloadData();
        }}
        projectId={projectId}
        files={stagingFiles}
        stages={stages}
        defaultPhase={
          selectedPhaseFolder !== "TODAS"
            ? (selectedPhaseFolder as ProjectStagePhase)
            : "PROJETO_EXECUTIVO"
        }
        defaultDiscipline={
          selectedDiscipline !== "TODAS"
            ? (selectedDiscipline as ProjectDiscipline)
            : "ARQUITETURA"
        }
      />

      {/* Modal de Edição Individual de Metadados */}
      {editModalOpen && editData && (
        <SheetMetadataModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={async () => {
            setEditModalOpen(false);
            await reloadData();
          }}
          projectId={projectId}
          initialData={editData}
          stages={stages}
          environments={environments}
          folders={folders}
        />
      )}

      {/* Modal Fullscreen de Pré-visualização de Prancha (PDF/Imagem) carregado sob demanda */}
      {fullscreenDeliverable && (
        <DeliverablePreviewModal
          deliverable={fullscreenDeliverable}
          projectId={projectId}
          onClose={() => setFullscreenDeliverable(null)}
        />
      )}
    </div>
  );
}
