"use client";

import { useState, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  parseSheetFileName,
  type ParsedSheetMetadata,
  DISCIPLINE_LABELS,
} from "@/lib/sheet-metadata-parser";
import {
  SheetMetadataModal,
  type DeliverableData,
  type StageOption,
  type EnvironmentOption,
  type FolderOption,
} from "./sheet-metadata-modal";
import { DeliverableCard, type DeliverableCardItem } from "./deliverable-card";
import { SheetMatrixView } from "./sheet-matrix-view";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ProjectDiscipline } from "@prisma/client";

interface ProjectDeliverablesTabProps {
  projectId: string;
  initialDeliverables: DeliverableCardItem[];
  initialMatrix?: DeliverableMatrix | null;
  stages: StageOption[];
  environments?: EnvironmentOption[];
  folders?: FolderOption[];
}

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
  const [showMatrix, setShowMatrix] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("TODAS");
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("TODOS");

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal de cadastro / edição
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedMeta, setParsedMeta] = useState<ParsedSheetMetadata | null>(null);
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

  // Manipulador de upload
  const handleFileProcess = (file: File) => {
    setSelectedFile(file);
    setEditData(null);
    const parsed = parseSheetFileName(file.name);
    setParsedMeta(parsed);
    setModalOpen(true);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Abrir edição
  const handleEdit = (item: DeliverableCardItem) => {
    setSelectedFile(null);
    setParsedMeta(null);
    setEditData({
      id: item.id,
      sheetCode: item.sheetCode || "",
      subject: item.subject,
      title: item.title,
      discipline: item.discipline,
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
    setModalOpen(true);
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

  // Lista filtrada
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((item) => {
      // Filtro disciplina
      if (selectedDiscipline !== "TODAS" && item.discipline !== selectedDiscipline) {
        return false;
      }
      // Filtro ambiente
      if (
        selectedEnvironment !== "TODOS" &&
        item.environment?.name !== selectedEnvironment
      ) {
        return false;
      }
      // Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (item.sheetCode || "").toLowerCase();
        const subj = item.subject.toLowerCase();
        const title = item.title.toLowerCase();
        const env = (item.environment?.name || "").toLowerCase();
        if (!code.includes(q) && !subj.includes(q) && !title.includes(q) && !env.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [deliverables, selectedDiscipline, selectedEnvironment, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Matriz de Pranchas */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Controle de Engenharia
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {deliverables.length} Pranchas Registradas
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-bold text-slate-900 font-sans">
              Pranchas, Plantas & Detalhamentos Técnicos
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Gestão documental executiva com conferência de escopo por disciplina e versão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {matrix && (
              <button
                type="button"
                onClick={() => setShowMatrix(!showMatrix)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>{showMatrix ? "Ocultar Matriz" : "Exibir Matriz"}</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
              className="hidden"
              id="sheet-upload-btn-main"
            />
            <label
              htmlFor="sheet-upload-btn-main"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Nova Prancha / Upload
            </label>
          </div>
        </div>

        {/* Visão da Matriz (Entregues vs. Pendentes) */}
        {showMatrix && matrix && (
          <div className="mt-5 animate-in fade-in duration-200">
            <SheetMatrixView matrix={matrix} projectId={projectId} />
          </div>
        )}
      </Card>

      {/* 2. Zona de Drag-and-Drop Apple HIG */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-50/70 scale-[1.005]"
            : "border-slate-200 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/20"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200/80 text-blue-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-800">
          Arraste e solte o arquivo da prancha aqui ou clique para selecionar
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Suporta PDFs técnicos de projeto, renders e memoriais (PDF, PNG, JPG até 50MB). O modal de conferência técnica abrirá automaticamente.
        </p>
      </div>

      {/* 3. Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Busca por texto */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código (ex: ARQ-01), assunto ou ambiente..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Disciplina */}
          <select
            value={selectedDiscipline}
            onChange={(e) => setSelectedDiscipline(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none transition"
          >
            <option value="TODAS">Todas as Disciplinas</option>
            {Object.entries(DISCIPLINE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {/* Seletor de Ambiente */}
          {uniqueEnvironments.length > 0 && (
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none transition"
            >
              <option value="TODOS">Todos os Ambientes</option>
              {uniqueEnvironments.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          )}

          {/* Alternador de Modo de Exibição (Cards vs Tabela) */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Exibição em Cards"
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Exibição em Tabela"
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      {/* 4. Lista / Grid de Pranchas */}
      {loading && (
        <div className="flex items-center justify-center py-4 text-xs font-semibold text-blue-600 animate-pulse">
          Sincronizando pranchas técnicas...
        </div>
      )}

      {filteredDeliverables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-xs font-bold text-slate-700">Nenhuma prancha encontrada</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Tente ajustar os filtros de disciplina, ambiente ou faça o upload de um novo arquivo.
          </p>
        </div>
      ) : viewMode === "cards" ? (
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
        /* Visualização em Tabela */
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-3 pr-2">Prancha</th>
                  <th className="py-2.5 px-2">Assunto & Título</th>
                  <th className="py-2.5 px-2">Disciplina</th>
                  <th className="py-2.5 px-2">Versão</th>
                  <th className="py-2.5 px-2">Ambiente</th>
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
                      <p className="font-semibold text-slate-900">{item.subject}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.title}</p>
                    </td>
                    <td className="py-3 px-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-mono text-[11px] font-semibold text-slate-700">
                      {item.version}
                    </td>
                    <td className="py-3 px-2 text-slate-600">
                      {item.environment?.name || "—"}
                    </td>
                    <td className="py-3 px-2">
                      <Badge tone="blue">
                        {item.status}
                      </Badge>
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

      {/* 5. Modal de Conferência e Cadastro de Assunto (Split Layout Apple HIG) */}
      <SheetMetadataModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedFile(null);
          setParsedMeta(null);
          setEditData(null);
        }}
        onSuccess={reloadData}
        projectId={projectId}
        stages={stages}
        environments={environments}
        folders={folders}
        file={selectedFile}
        parsedMetadata={parsedMeta}
        initialData={editData}
      />

      {/* 6. Modal de Visualização em Tela Cheia (Fullscreen Viewer) */}
      {fullscreenDeliverable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
              <div className="flex items-center gap-3">
                {fullscreenDeliverable.sheetCode && (
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {fullscreenDeliverable.sheetCode}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">
                    {fullscreenDeliverable.subject}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Versão {fullscreenDeliverable.version} • {DISCIPLINE_LABELS[fullscreenDeliverable.discipline] || fullscreenDeliverable.discipline}
                    {fullscreenDeliverable.environment?.name ? ` • ${fullscreenDeliverable.environment.name}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/projects/${projectId}/deliverables/${fullscreenDeliverable.id}/file?download=1`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar Arquivo
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

            {/* Viewer Body */}
            <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
              <iframe
                src={`/api/projects/${projectId}/deliverables/${fullscreenDeliverable.id}/file`}
                className="h-full w-full border-0 bg-white"
                title={fullscreenDeliverable.subject}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

