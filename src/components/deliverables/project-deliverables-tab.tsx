"use client";

import { useState, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DISCIPLINE_LABELS,
} from "@/lib/sheet-metadata-parser";
import {
  SheetMetadataModal,
  type DeliverableData,
  type StageOption,
  type EnvironmentOption,
  type FolderOption,
} from "./sheet-metadata-modal";
import { StagingCatalogModal } from "./staging-catalog-modal";
import { DeliverableCard, type DeliverableCardItem } from "./deliverable-card";
import { SheetMatrixView } from "./sheet-matrix-view";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type {
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
} from "@prisma/client";

interface ProjectDeliverablesTabProps {
  projectId: string;
  initialDeliverables: DeliverableCardItem[];
  initialMatrix?: DeliverableMatrix | null;
  stages: StageOption[];
  environments?: EnvironmentOption[];
  folders?: FolderOption[];
}

const CANONICAL_DISCIPLINES: Array<{
  key: string;
  label: string;
  icon: string;
  match: (d: ProjectDiscipline) => boolean;
}> = [
  { key: "TODAS", label: "Todas as Pastas", icon: "📁", match: () => true },
  { key: "ARQUITETURA", label: "Arquitetura", icon: "🏛️", match: (d) => d === "ARQUITETURA" },
  {
    key: "ESTRUTURAL",
    label: "Estrutural (TQS)",
    icon: "🏗️",
    match: (d) => d === "ESTRUTURAL" || d === "ESTRUTURA",
  },
  {
    key: "HIDROSSANITARIO",
    label: "Hidrossanitário (Revit)",
    icon: "💧",
    match: (d) => d === "HIDROSSANITARIO",
  },
  {
    key: "ELETRICO",
    label: "Elétrico & Iluminação (Revit)",
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
    label: "Renders 3D (Corona)",
    icon: "🎨",
    match: (d) => d === "RENDER_3D",
  },
  {
    key: "LEGAL_APROVACAO",
    label: "Documentação Legal / ART",
    icon: "📜",
    match: (d) => d === "LEGAL_APROVACAO" || d === "GERAL",
  },
];

const PHASE_SECTIONS: Array<{
  key: ProjectStagePhase;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    key: "PROJETO_PRELIMINAR",
    label: "Projeto Preliminar",
    icon: "📐",
    description: "Estudos preliminares, plantas conceituais e definições de layout",
  },
  {
    key: "PROJETO_LEGAL",
    label: "Projeto Legal",
    icon: "🏛️",
    description: "Pranchas para aprovação em Prefeitura, Condomínio e órgãos reguladores",
  },
  {
    key: "PROJETO_EXECUTIVO",
    label: "Projeto Executivo",
    icon: "🏗️",
    description: "Pranchas detalhadas, cotadas e liberadas para execução em canteiro",
  },
];

export function ProjectDeliverablesTab({
  projectId,
  initialDeliverables,
  initialMatrix,
  stages,
  environments = [],
  folders = [],
}: ProjectDeliverablesTabProps) {
  const [deliverables, setDeliverables] = useState<DeliverableCardItem[]>(initialDeliverables);
  const [matrix, setMatrix] = useState<DeliverableMatrix | null | undefined>(initialMatrix);
  const [loading, setLoading] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("TODAS");
  const [selectedPhaseFolder, setSelectedPhaseFolder] = useState<string>("TODAS");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("TODOS");

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

  // Manipulador de upload (1 ou múltiplos arquivos)
  const handleFilesUpload = (files: File[]) => {
    if (!files.length) return;
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(Array.from(e.dataTransfer.files));
    }
  };

  // Abrir edição
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
      environmentName: item.environment?.name || "",
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

  // Excluir
  const handleDelete = async (id: string, sheetCode: string | null) => {
    if (!confirm(`Deseja realmente remover a prancha "${sheetCode || "selecionada"}"?`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/deliverables/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await reloadData();
      } else {
        alert("Não foi possível excluir a prancha.");
      }
    } catch {
      alert("Erro ao excluir prancha.");
    } finally {
      setLoading(false);
    }
  };

  // Lista de ambientes únicos presentes nas pranchas
  const uniqueEnvironments = useMemo(() => {
    const envSet = new Set<string>();
    deliverables.forEach((d) => {
      if (d.environment?.name) envSet.add(d.environment.name);
    });
    return Array.from(envSet).sort();
  }, [deliverables]);

  // Contagem de pranchas por tipo de acervo
  const categoryCounts = useMemo(() => {
    const counts = {
      TODOS: deliverables.length,
      PLANTA_TECNICA_PDF: 0,
      DOCUMENTACAO_MEMORIAL: 0,
      IMAGEM_RENDER: 0,
    };
    deliverables.forEach((d) => {
      const cat = d.category || "PLANTA_TECNICA_PDF";
      if (cat in counts) {
        counts[cat as keyof typeof counts]++;
      }
    });
    return counts;
  }, [deliverables]);

  // Contagem de pranchas por disciplina
  const disciplineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CANONICAL_DISCIPLINES.forEach((disc) => {
      counts[disc.key] = deliverables.filter((d) => disc.match(d.discipline)).length;
    });
    return counts;
  }, [deliverables]);

  // Lista filtrada
  const filteredDeliverables = useMemo(() => {
    const discRule = CANONICAL_DISCIPLINES.find((d) => d.key === selectedDiscipline);

    return deliverables.filter((item) => {
      // Filtro disciplina
      if (discRule && !discRule.match(item.discipline)) {
        return false;
      }
      // Filtro subpasta de fase
      if (selectedPhaseFolder !== "TODAS" && item.phaseFolder !== selectedPhaseFolder) {
        return false;
      }
      // Filtro tipo de acervo
      if (selectedCategory !== "TODAS" && item.category !== selectedCategory) {
        return false;
      }
      // Filtro ambiente
      if (selectedEnvironment !== "TODOS" && item.environment?.name !== selectedEnvironment) {
        return false;
      }
      // Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (item.sheetCode || "").toLowerCase();
        const subj = item.subject.toLowerCase();
        const title = item.title.toLowerCase();
        const subtitle = (item.subtitle || "").toLowerCase();
        const env = (item.environment?.name || "").toLowerCase();
        if (
          !code.includes(q) &&
          !subj.includes(q) &&
          !title.includes(q) &&
          !subtitle.includes(q) &&
          !env.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    deliverables,
    selectedDiscipline,
    selectedPhaseFolder,
    selectedCategory,
    selectedEnvironment,
    searchQuery,
  ]);

  return (
    <div className="space-y-6 font-sans">
      {/* ============================================================== */}
      {/* 1. CABEÇALHO DO ACERVO + ÁREA DE UPLOAD DRAG & DROP           */}
      {/* ============================================================== */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Acervo Técnico Oficial
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {deliverables.length} itens catalogados
              </span>
            </div>
            <h3 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 font-sans">
              Plantas Cadastradas & Acervo Técnico
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Gestão executiva de pranchas normativas, memoriais de cálculo e renders 3D em alta resolução.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {matrix && (
              <button
                type="button"
                onClick={() => setShowMatrix(!showMatrix)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  showMatrix
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {showMatrix ? "Ocultar Matriz" : "Matriz de Pranchas (BIM)"}
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload de Pranchas (PDF / Imagens)
            </button>
          </div>
        </div>

        {/* Matriz de Pranchas Expansível */}
        {showMatrix && matrix && (
          <div className="mt-5 border-b border-slate-100 pb-5">
            <SheetMatrixView matrix={matrix} projectId={projectId} />
          </div>
        )}

        {/* Área de Drag-and-Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
            isDragging
              ? "border-blue-600 bg-blue-50/80 ring-4 ring-blue-100 scale-[1.01]"
              : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesUpload(Array.from(e.target.files));
              }
            }}
          />
          <div className="flex flex-col items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 mb-2">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-800">
              Arraste e solte 1 ou múltiplos arquivos PDF ou Renders 3D aqui
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Abre imediatamente a <strong className="text-blue-700">Janela Temporária de Catalogação</strong> com preview visual antes da gravação definitiva.
            </p>
          </div>
        </div>
      </Card>

      {/* ============================================================== */}
      {/* 2. FILTRO SUPERIOR DE TIPO DE ACERVO (SEGMENTED CONTROL APPLE) */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-100/80 p-2 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pl-2 pr-1">
            Tipo de Acervo:
          </span>
          {[
            { key: "TODOS", label: "Todos os Arquivos", count: categoryCounts.TODOS },
            { key: "PLANTA_TECNICA_PDF", label: "Plantas Técnicas (PDF)", count: categoryCounts.PLANTA_TECNICA_PDF },
            { key: "DOCUMENTACAO_MEMORIAL", label: "Documentação & Memoriais", count: categoryCounts.DOCUMENTACAO_MEMORIAL },
            { key: "IMAGEM_RENDER", label: "Imagens & Renders 3D", count: categoryCounts.IMAGEM_RENDER },
          ].map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                  active
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pr-1">
          {/* Alternador Cards vs Tabela */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === "cards" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === "table" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. PASTAS DE DISCIPLINAS (ÁRVORE DE PASTAS VISUAIS)           */}
      {/* ============================================================== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Pastas de Disciplinas Técnicas
          </span>
          <span className="text-xs text-slate-400">
            {deliverables.length} itens no projeto
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {CANONICAL_DISCIPLINES.map((disc) => {
            const active = selectedDiscipline === disc.key;
            const count = disciplineCounts[disc.key] || 0;

            return (
              <button
                key={disc.key}
                type="button"
                onClick={() => setSelectedDiscipline(disc.key)}
                className={`group flex flex-col justify-between rounded-2xl border p-3 text-left transition-all duration-200 ${
                  active
                    ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600"
                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{disc.icon}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <p className={`mt-2 text-xs font-bold line-clamp-2 ${active ? "text-blue-900" : "text-slate-800"}`}>
                  {disc.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. SUBPASTAS DE FASE (PRELIMINAR, LEGAL, EXECUTIVO) + FILTROS  */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
        {/* Seletor de Subpasta de Fase */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mr-1">
            Subpastas de Fase:
          </span>
          <button
            type="button"
            onClick={() => setSelectedPhaseFolder("TODAS")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              selectedPhaseFolder === "TODAS"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            📂 Todas as Fases
          </button>
          {PHASE_SECTIONS.map((phase) => {
            const active = selectedPhaseFolder === phase.key;
            return (
              <button
                key={phase.key}
                type="button"
                onClick={() => setSelectedPhaseFolder(phase.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{phase.icon}</span>
                <span>{phase.label}</span>
              </button>
            );
          })}
        </div>

        {/* Busca e Filtro de Ambiente */}
        <div className="flex items-center gap-2">
          {uniqueEnvironments.length > 0 && (
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="TODOS">Todos os Ambientes</option>
              {uniqueEnvironments.map((env) => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          )}

          <div className="relative w-52 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar prancha ou assunto..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-xs"
            />
            <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. LISTA / GRID DE PRANCHAS ORGANIZADAS POR SUBPASTA           */}
      {/* ============================================================== */}
      {loading && (
        <div className="flex items-center justify-center py-4 text-xs font-semibold text-blue-600 animate-pulse">
          Sincronizando acervo técnico...
        </div>
      )}

      {filteredDeliverables.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            📁
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800">Nenhuma prancha encontrada nesta subpasta</p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Faça o upload de novas pranchas no cabeçalho ou ajuste os filtros de disciplina e fase.
          </p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="space-y-8">
          {/* Se o usuário filtrou uma subpasta específica */}
          {selectedPhaseFolder !== "TODAS" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDeliverables.map((item) => (
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
          ) : (
            /* Se estiver em "Todas as Fases", agrupa visualmente em seções de subpastas normativas */
            PHASE_SECTIONS.map((phase) => {
              const itemsInPhase = filteredDeliverables.filter(
                (d) => (d.phaseFolder || "PROJETO_EXECUTIVO") === phase.key,
              );

              if (itemsInPhase.length === 0) return null;

              return (
                <div key={phase.key} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{phase.icon}</span>
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                        {phase.label}
                      </h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                        {itemsInPhase.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      {phase.description}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {itemsInPhase.map((item) => (
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
              );
            })
          )}
        </div>
      ) : (
        /* Visualização em Tabela */
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-3 pr-2">Prancha</th>
                  <th className="py-2.5 px-2">Título & Subtítulo</th>
                  <th className="py-2.5 px-2">Fase / Subpasta</th>
                  <th className="py-2.5 px-2">Disciplina</th>
                  <th className="py-2.5 px-2">Versão</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredDeliverables.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 pl-3 pr-2 font-mono font-bold text-blue-700">
                      {item.sheetCode || "—"}
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 italic">{item.subtitle}</p>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {item.phaseFolder?.replace("PROJETO_", "") || "EXECUTIVO"}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-mono text-[11px] font-bold text-slate-700">
                      {item.version}
                    </td>
                    <td className="py-3 px-2">
                      <Badge tone="blue">{item.status}</Badge>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFullscreenDeliverable(item)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.sheetCode)}
                          className="rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          ✕
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

      {/* ============================================================== */}
      {/* 6. JANELA TEMPORÁRIA DE CATALOGAÇÃO PÓS-UPLOAD (MULTI-ARQUIVOS) */}
      {/* ============================================================== */}
      <StagingCatalogModal
        isOpen={stagingModalOpen}
        onClose={() => {
          setStagingModalOpen(false);
          setStagingFiles([]);
        }}
        onSuccess={(savedPhase, savedDiscipline) => {
          reloadData();
          setSelectedPhaseFolder(savedPhase);
          setSelectedDiscipline(savedDiscipline);
        }}
        projectId={projectId}
        files={stagingFiles}
        stages={stages}
        defaultPhase={selectedPhaseFolder !== "TODAS" ? (selectedPhaseFolder as ProjectStagePhase) : "PROJETO_EXECUTIVO"}
        defaultDiscipline={selectedDiscipline !== "TODAS" ? (selectedDiscipline as ProjectDiscipline) : "ARQUITETURA"}
      />

      {/* ============================================================== */}
      {/* 7. MODAL DE EDIÇÃO DE METADADOS EXISTENTES                     */}
      {/* ============================================================== */}
      <SheetMetadataModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditData(null);
        }}
        onSuccess={reloadData}
        projectId={projectId}
        stages={stages}
        environments={environments}
        folders={folders}
        initialData={editData}
      />

      {/* ============================================================== */}
      {/* 8. MODAL DE VISUALIZAÇÃO EM TELA CHEIA (FULLSCREEN VIEWER)     */}
      {/* ============================================================== */}
      {fullscreenDeliverable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
          <div className="flex h-full w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Barra Superior do Visualizador */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/90">
              <div className="flex items-center gap-3">
                {fullscreenDeliverable.sheetCode && (
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {fullscreenDeliverable.sheetCode}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {fullscreenDeliverable.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {fullscreenDeliverable.subtitle ? `${fullscreenDeliverable.subtitle} • ` : ""}
                    Revisão {fullscreenDeliverable.version} • {DISCIPLINE_LABELS[fullscreenDeliverable.discipline] || fullscreenDeliverable.discipline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/projects/${projectId}/deliverables/${fullscreenDeliverable.id}/file?download=1`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setFullscreenDeliverable(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                  title="Fechar (ESC)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Corpo do Visualizador */}
            <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
              <iframe
                src={`/api/projects/${projectId}/deliverables/${fullscreenDeliverable.id}/file`}
                className="h-full w-full border-0 bg-white"
                title={fullscreenDeliverable.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
