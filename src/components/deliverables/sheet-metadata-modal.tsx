"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DISCIPLINE_LABELS,
  DELIVERABLE_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  type ParsedSheetMetadata,
} from "@/lib/sheet-metadata-parser";
import type {
  ProjectDiscipline,
  DeliverableType,
  ApprovalStatus,
  ProjectStagePhase,
  AcervoCategory,
} from "@prisma/client";

export const PHASE_FOLDER_LABELS: Record<ProjectStagePhase, string> = {
  PROJETO_PRELIMINAR: "1. Projeto Preliminar (Estudo)",
  PROJETO_LEGAL: "2. Projeto Legal (Prefeitura/Condomínio)",
  PROJETO_EXECUTIVO: "3. Projeto Executivo (Obra)",
};

export const ACERVO_CATEGORY_LABELS: Record<AcervoCategory, string> = {
  PLANTA_TECNICA_PDF: "Planta Técnica (PDF)",
  DOCUMENTACAO_MEMORIAL: "Memorial Descritivo & ART / Docs",
  IMAGEM_RENDER: "Imagem & Render 3D",
};

export interface StageOption {
  id: string;
  name: string;
  discipline?: string | null;
}

export interface EnvironmentOption {
  id: string;
  name: string;
}

export interface FolderOption {
  id: string;
  name: string;
}

export interface DeliverableData {
  id?: string;
  sheetCode: string;
  subject: string;
  title: string;
  subtitle?: string | null;
  discipline: ProjectDiscipline;
  phaseFolder?: ProjectStagePhase;
  category?: AcervoCategory;
  type: DeliverableType;
  version: string;
  stageId?: string | null;
  environmentId?: string | null;
  environmentName?: string;
  folderId?: string | null;
  description?: string | null;
  status: ApprovalStatus;
  isClientView: boolean;
  isRequired: boolean;
  fileSize?: string | null;
  fileUrl?: string;
}

interface SheetMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  stages: StageOption[];
  environments?: EnvironmentOption[];
  folders?: FolderOption[];
  // Modo Upload
  file?: File | null;
  parsedMetadata?: ParsedSheetMetadata | null;
  // Modo Edição
  initialData?: DeliverableData | null;
}

const DEFAULT_SUBJECT_SUGGESTIONS = [
  "Plantas Baixas e Layout",
  "Cortes e Elevações",
  "Locação e Cargas de Fundação",
  "Formas e Armaduras",
  "Barrilete e Água Fria",
  "Iluminação e Diagrama Unifilar",
  "Render Diurno Fachada",
  "Detalhamento Construtivo Executivo",
  "Instalações de Esgoto e Ventilação",
  "Esquadrias e Paginação de Pisos",
];

const DEFAULT_ENVIRONMENTS = [
  "Fachada Principal & Acessos",
  "Área Gourmet & Piscina",
  "Living Integrado",
  "Suíte Master",
  "Canteiro & Fundação",
  "Cozinha Funcional",
  "Área de Serviço & Apoio",
  "Garagem & Subsolo",
];

const DEFAULT_FOLDERS_BY_DISCIPLINE: Record<ProjectDiscipline, string[]> = {
  ARQUITETURA: ["01. Plantas & Layout", "02. Cortes & Fachadas", "03. Detalhamento Executivo"],
  ESTRUTURAL: ["01. Pré-Formas", "02. Formas Finais TQS", "03. Armaduras CA-50", "04. Fundações SPT"],
  ELETRICO: ["01. Iluminação & Força", "02. Diagramas Unifilares", "03. Entrada de Energia"],
  HIDROSSANITARIO: ["01. Esgoto & Ventilação", "02. Abastecimento & Água", "03. Drenagem Pluvial"],
  HVAC: ["01. Climatização VRF/Split", "02. Exaustão & Ventilação"],
  INTERIORES: ["01. Marcenaria Detalhada", "02. Paginação de Revestimentos", "03. Forro & Iluminação"],
  COMPATIBILIZACAO: ["01. Matriz BIM & Clashes", "02. Relatórios de Compatibilização"],
  EXECUCAO_OBRA: ["01. Canteiro & Locação", "02. Liberações de Concretagem"],
  ESTRUTURA: ["01. Pré-Formas", "02. Formas Finais TQS", "03. Armaduras CA-50", "04. Fundações SPT"],
  COMBATE_INCENDIO: ["01. Hidrantes & Extintores", "02. Sinalização de Emergência", "03. Alarme & Detecção"],
  RENDER_3D: ["01. Renders Externos", "02. Renders Internos", "03. Plantas Humanizadas"],
  LEGAL_APROVACAO: ["01. Pranchas de Prefeitura", "02. Memorial de Aprovação", "03. Licenças & Alvarás"],
  GERAL: ["01. Geral & Coordenação"],
};

export function SheetMetadataModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  stages,
  environments = [],
  folders = [],
  file,
  parsedMetadata,
  initialData,
}: SheetMetadataModalProps) {
  const isEditing = Boolean(initialData?.id);

  // Estados dos campos
  const [sheetCode, setSheetCode] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [discipline, setDiscipline] = useState<ProjectDiscipline>("ARQUITETURA");
  const [phaseFolder, setPhaseFolder] = useState<ProjectStagePhase>("PROJETO_EXECUTIVO");
  const [category, setCategory] = useState<AcervoCategory>("PLANTA_TECNICA_PDF");
  const [type, setType] = useState<DeliverableType>("PRANCHA_EXECUTIVA");
  const [version, setVersion] = useState("R00");
  const [stageId, setStageId] = useState<string>("");
  const [environmentId, setEnvironmentId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ApprovalStatus>("EM_ELABORACAO");
  const [isClientView, setIsClientView] = useState(false);
  const [isRequired, setIsRequired] = useState(true);

  // Preview do arquivo
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);

  // Preenche dados ao abrir
  useEffect(() => {
    if (!isOpen) {
      setPreviewUrl(null);
      setErrorMessage("");
      setZoomLevel(1);
      return;
    }

    if (initialData) {
      // Modo Edição
      setSheetCode(initialData.sheetCode || "");
      setSubject(initialData.subject || "");
      setTitle(initialData.title || "");
      setSubtitle(initialData.subtitle || "");
      setDiscipline(initialData.discipline || "ARQUITETURA");
      setPhaseFolder(initialData.phaseFolder || "PROJETO_EXECUTIVO");
      setCategory(initialData.category || "PLANTA_TECNICA_PDF");
      setType(initialData.type || "PRANCHA_EXECUTIVA");
      setVersion(initialData.version || "R00");
      setStageId(initialData.stageId || "");
      setEnvironmentId(initialData.environmentId || initialData.environmentName || "");
      setFolderId(initialData.folderId || "");
      setDescription(initialData.description || "");
      setStatus(initialData.status || "EM_ELABORACAO");
      setIsClientView(initialData.isClientView ?? false);
      setIsRequired(initialData.isRequired ?? true);

      if (initialData.fileUrl) {
        setPreviewUrl(`/api/projects/${projectId}/deliverables/${initialData.id}/file`);
      }
    } else if (parsedMetadata) {
      // Modo Upload com metadados inferidos
      setSheetCode(parsedMetadata.sheetCode);
      setSubject(parsedMetadata.subject);
      setTitle(parsedMetadata.title);
      setSubtitle("");
      setDiscipline(parsedMetadata.discipline);
      setPhaseFolder("PROJETO_EXECUTIVO");
      setCategory(
        parsedMetadata.type === "RENDER_3D"
          ? "IMAGEM_RENDER"
          : parsedMetadata.type === "MEMORIAL_DESCRITIVO"
          ? "DOCUMENTACAO_MEMORIAL"
          : "PLANTA_TECNICA_PDF"
      );
      setType(parsedMetadata.type);
      setVersion(parsedMetadata.version || "R00");
      setEnvironmentId(parsedMetadata.environmentName || "");
      setFolderId("");
      setDescription("");
      setStatus("EM_ELABORACAO");
      setIsClientView(false);
      setIsRequired(true);

      // Tenta associar com a etapa do cronograma sugerida
      if (parsedMetadata.suggestedStageName) {
        const found = stages.find(
          (s) =>
            s.name.toLowerCase().includes(parsedMetadata.suggestedStageName!.toLowerCase()) ||
            parsedMetadata.suggestedStageName!.toLowerCase().includes(s.name.toLowerCase())
        );
        if (found) setStageId(found.id);
      } else {
        setStageId("");
      }

      // Gera preview a partir do File local
      if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    }
  }, [isOpen, initialData, parsedMetadata, file, projectId, stages]);

  const handleSubjectChange = (val: string) => {
    setSubject(val);
    if (!isEditing) {
      setTitle(sheetCode ? `${sheetCode} - ${val}` : val);
    }
  };

  const handleSheetCodeChange = (val: string) => {
    setSheetCode(val);
    if (!isEditing) {
      setTitle(val ? `${val} - ${subject}` : subject);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetCode.trim() || !subject.trim()) {
      setErrorMessage("Preencha o código da prancha e o assunto.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      if (isEditing && initialData?.id) {
        const res = await fetch(`/api/projects/${projectId}/deliverables/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetCode,
            subject,
            title: title || `${sheetCode} - ${subject}`,
            subtitle: subtitle || null,
            discipline,
            phaseFolder,
            category,
            type,
            version,
            stageId: stageId || null,
            environmentId: environmentId || null,
            folderId: folderId || null,
            description,
            status,
            isClientView,
            isRequired,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao atualizar prancha.");
        }
      } else {
        if (!file) throw new Error("Selecione o arquivo da prancha.");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("sheetCode", sheetCode);
        formData.append("subject", subject);
        formData.append("title", title || `${sheetCode} - ${subject}`);
        if (subtitle) formData.append("subtitle", subtitle);
        formData.append("discipline", discipline);
        formData.append("phaseFolder", phaseFolder);
        formData.append("category", category);
        formData.append("type", type);
        formData.append("version", version);
        if (stageId) formData.append("stageId", stageId);
        if (environmentId) formData.append("environmentId", environmentId);
        if (folderId) formData.append("folderId", folderId);
        if (description) formData.append("description", description);
        formData.append("status", status);
        formData.append("isClientView", String(isClientView));
        formData.append("isRequired", String(isRequired));

        const res = await fetch(`/api/projects/${projectId}/deliverables`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao gravar prancha técnica.");
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha na gravação.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPdf =
    file?.type === "application/pdf" ||
    file?.name.toLowerCase().endsWith(".pdf") ||
    initialData?.fileUrl?.toLowerCase().includes(".pdf") ||
    true;

  // Sugestões de pastas da disciplina atual
  const suggestedFolders = DEFAULT_FOLDERS_BY_DISCIPLINE[discipline] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Cabeçalho do Modal Split */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {isEditing ? "Edição Técnica" : "Conferência & Cadastro de Prancha"}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {isEditing ? sheetCode : file?.name}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
              {isEditing ? `Editar Metadados · ${sheetCode} (${version})` : "Conferência Visual & Metadados da Prancha"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Corpo com Grid Split: Preview à Esquerda / Formulário à Direita */}
        <div className="grid flex-1 overflow-y-auto lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* ========================================================= */}
          {/* COLUNA ESQUERDA: PREVIEW DE CONFERÊNCIA TÉCNICA VISUAL    */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 flex flex-col bg-slate-100/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Preview de Conferência
                </p>
                <p className="text-[11px] text-slate-500">Inspecione cotas, carimbo técnico e legenda</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                  className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50"
                  title="Diminuir Zoom"
                >
                  -
                </button>
                <span className="text-[10px] font-mono text-slate-500 w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50"
                  title="Aumentar Zoom"
                >
                  +
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[340px] lg:min-h-[460px] rounded-2xl border border-slate-300 bg-white shadow-inner overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                isPdf ? (
                  <iframe
                    src={`${previewUrl}#toolbar=0&navpanes=0`}
                    title="Pré-visualização da Prancha"
                    className="h-full w-full border-0 transition-transform duration-150"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
                  />
                ) : (
                  <div className="overflow-auto max-h-full max-w-full p-2">
                    <img
                      src={previewUrl}
                      alt="Preview da Prancha"
                      className="max-h-full max-w-full object-contain transition-transform duration-150"
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center" }}
                    />
                  </div>
                )
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-xs font-medium">Carregando visualizador da prancha...</p>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl bg-white/90 p-3 text-[11px] text-slate-600 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-bold">💡 Dica Técnica:</span>
                <span>Confira se o número da prancha confere com a legenda antes de salvar.</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUNA DIREITA: FORMULÁRIO DE METADADOS INTELIGENTES      */}
          {/* ========================================================= */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 flex flex-col justify-between p-6">
            <div className="space-y-4">
              {errorMessage ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {errorMessage}
                </div>
              ) : null}

              {/* Linha 1: Código da Prancha & Versão Rápida */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-7">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Código da Prancha *
                  </label>
                  <input
                    type="text"
                    required
                    value={sheetCode}
                    onChange={(e) => handleSheetCodeChange(e.target.value)}
                    placeholder="Ex: ARQ-01/04, EST-E01, HID-H01"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold uppercase text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Sugestão automática baseada no padrão do estúdio</p>
                </div>

                <div className="col-span-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Versão / Revisão *
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    {["R00", "R01", "R02", "R03"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVersion(v)}
                        className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                          version === v
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Linha 2: Assunto da Planta com Datalist de Sugestões Rápidas */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Assunto da Planta / Prancha *
                  </label>
                  <span className="text-[10px] text-slate-400">Selecione ou digite</span>
                </div>
                <input
                  type="text"
                  required
                  list="subject-suggestions"
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  placeholder="Ex: Plantas Baixas e Layout, Formas e Armaduras, Barrilete e Água Fria"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                />
                <datalist id="subject-suggestions">
                  {DEFAULT_SUBJECT_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>

                {/* Chips rápidos de assunto */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {["Plantas Baixas e Layout", "Cortes e Elevações", "Formas e Armaduras", "Locação e Cargas de Fundação"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSubjectChange(chip)}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linha 2.1: Título & Subtítulo Complementar */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-7">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Título da Prancha *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: ARQ-01 · Planta Baixa de Layout"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Identificação canônica exibida nas listas e relatórios</p>
                </div>

                <div className="col-span-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Subtítulo / Complemento
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ex: Pavimento Térreo e Coberta"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Detalhamento específico do desenho</p>
                </div>
              </div>

              {/* Linha 2.2: Subpasta Normativa & Categoria do Acervo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Subpasta Normativa *
                  </label>
                  <select
                    value={phaseFolder}
                    onChange={(e) => setPhaseFolder(e.target.value as ProjectStagePhase)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {Object.entries(PHASE_FOLDER_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Categoria do Acervo *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AcervoCategory)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {Object.entries(ACERVO_CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 3: Disciplina & Tipo de Entregável */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Disciplina *
                  </label>
                  <select
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value as ProjectDiscipline)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tipo de Entregável *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as DeliverableType)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {Object.entries(DELIVERABLE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 4: Ambiente da Obra & Pasta */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ambiente da Edificação
                  </label>
                  <input
                    type="text"
                    list="environment-suggestions"
                    value={environmentId}
                    onChange={(e) => setEnvironmentId(e.target.value)}
                    placeholder="Ex: Fachada Principal, Living, Suíte Master"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                  <datalist id="environment-suggestions">
                    {DEFAULT_ENVIRONMENTS.map((env) => (
                      <option key={env} value={env} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Pasta da Disciplina
                  </label>
                  <input
                    type="text"
                    list="folder-suggestions"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    placeholder="Selecione ou crie uma pasta"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                  <datalist id="folder-suggestions">
                    {suggestedFolders.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Linha 5: Etapa Vinculada do Cronograma & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Etapa do Cronograma
                  </label>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    <option value="">Não vinculada</option>
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.discipline ? `(${st.discipline})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Status de Homologação
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ApprovalStatus)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {Object.entries(APPROVAL_STATUS_LABELS).map(([stKey, meta]) => (
                      <option key={stKey} value={stKey}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 6: Toggle de Visibilidade no Portal & Prancha Obrigatória */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Prancha Obrigatória para Obra</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-bold text-blue-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isClientView}
                    onChange={(e) => setIsClientView(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Liberar visualização no Portal do Cliente</span>
                </label>
              </div>

              {/* Linha 7: Descrição / Notas Técnicas */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Descrição / Notas Técnicas de Revisão
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Anotações de revisão, pranchas complementares referenciadas ou especificações de execução..."
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Rodapé com Botão Principal "Validar e Gravar Prancha" */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Gravando Prancha...
                  </>
                ) : isEditing ? (
                  "Salvar Alterações dos Metadados"
                ) : (
                  "Validar e Gravar Prancha"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
