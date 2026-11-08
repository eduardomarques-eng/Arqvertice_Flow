"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  DISCIPLINE_LABELS,
  APPROVAL_STATUS_LABELS,
} from "@/lib/sheet-metadata-parser";
import type {
  ProjectDiscipline,
  DeliverableType,
  ApprovalStatus,
  ProjectStagePhase,
  AcervoCategory,
} from "@prisma/client";

export const PHASE_FOLDER_SHORT_LABELS: Record<ProjectStagePhase, string> = {
  PROJETO_PRELIMINAR: "Preliminar",
  PROJETO_LEGAL: "Legal / Aprovação",
  PROJETO_EXECUTIVO: "Executivo",
};

export const ACERVO_CATEGORY_SHORT_LABELS: Record<AcervoCategory, string> = {
  PLANTA_TECNICA_PDF: "PDF Técnico",
  DOCUMENTACAO_MEMORIAL: "Doc / Memorial",
  IMAGEM_RENDER: "Render 3D",
};

export interface DeliverableCardItem {
  id: string;
  sheetCode: string | null;
  subject: string;
  title: string;
  subtitle?: string | null;
  discipline: ProjectDiscipline;
  phaseFolder?: ProjectStagePhase;
  category?: AcervoCategory;
  type: DeliverableType;
  version: string;
  fileSize: string | null;
  fileUrl: string;
  status: ApprovalStatus;
  isClientView: boolean;
  isRequired: boolean;
  description: string | null;
  stageId: string | null;
  environmentId: string | null;
  stage?: { id: string; name: string } | null;
  environment?: { id: string; name: string } | null;
  folder?: { id: string; name: string } | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

interface DeliverableCardProps {
  deliverable: DeliverableCardItem;
  projectId: string;
  onView: (item: DeliverableCardItem) => void;
  onEdit: (item: DeliverableCardItem) => void;
  onDelete: (id: string, sheetCode: string | null) => void;
}

const DISCIPLINE_THEMES: Record<
  ProjectDiscipline,
  { bg: string; text: string; border: string; dot: string }
> = {
  ARQUITETURA: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  ESTRUTURAL: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  ELETRICO: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  HIDROSSANITARIO: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    dot: "bg-cyan-500",
  },
  HVAC: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    dot: "bg-teal-500",
  },
  INTERIORES: {
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700",
    border: "border-fuchsia-200",
    dot: "bg-fuchsia-500",
  },
  COMPATIBILIZACAO: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  EXECUCAO_OBRA: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  ESTRUTURA: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  COMBATE_INCENDIO: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  RENDER_3D: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
  LEGAL_APROVACAO: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  GERAL: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-500",
  },
};

export function DeliverableCard({
  deliverable,
  projectId,
  onView,
  onEdit,
  onDelete,
}: DeliverableCardProps) {
  const theme =
    DISCIPLINE_THEMES[deliverable.discipline] || DISCIPLINE_THEMES.GERAL;
  const statusMeta = APPROVAL_STATUS_LABELS[deliverable.status] || {
    label: deliverable.status,
    tone: "neutral" as const,
  };

  const isPdf =
    deliverable.type === "PLANTA_BAIXA" ||
    deliverable.type === "CORTE_FACHADA" ||
    deliverable.type === "MEMORIAL_DESCRITIVO" ||
    deliverable.fileUrl?.toLowerCase().includes(".pdf");

  const isImage =
    !isPdf &&
    (deliverable.category === "IMAGEM_RENDER" ||
      deliverable.type === "RENDER_3D" ||
      Boolean(deliverable.fileUrl?.match(/\.(png|jpg|jpeg|webp)$/i)));

  // Nome padronizado para download
  const cleanCode = deliverable.sheetCode
    ? deliverable.sheetCode.replace(/[\/\\]/g, "-")
    : "DOC";
  const cleanSubject = deliverable.subject.replace(/[\s\/\\]+/g, "_");
  const downloadFileName = `${cleanCode}_${cleanSubject}_${deliverable.version}.pdf`;

  const downloadUrl = `/api/projects/${projectId}/deliverables/${deliverable.id}/file?download=1&filename=${encodeURIComponent(
    downloadFileName
  )}`;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs hover:shadow-md hover:border-zinc-300 transition-all duration-200">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2.5">
          {/* Badge de Código e Disciplina */}
          <div className="flex flex-wrap items-center gap-1.5">
            {deliverable.sheetCode ? (
              <span className="inline-flex items-center rounded-lg bg-zinc-900 px-2 py-0.5 font-mono text-xs font-bold tracking-tight text-white shadow-xs">
                {deliverable.sheetCode}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium text-zinc-500">
                PRANCHA
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${theme.bg} ${theme.text} ${theme.border}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
              {DISCIPLINE_LABELS[deliverable.discipline] || deliverable.discipline}
            </span>

            {/* Revisão em Destaque */}
            <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700">
              {deliverable.version}
            </span>
          </div>

          {/* Status Badge */}
          <Badge tone={statusMeta.tone} className="text-[10px] shrink-0 font-medium">
            {statusMeta.label}
          </Badge>
        </div>

        {/* Hierarquia: Título Principal e Subtítulo Conjugado sem quebra desalinhada */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {deliverable.phaseFolder && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700 font-mono">
                📂 {PHASE_FOLDER_SHORT_LABELS[deliverable.phaseFolder] || deliverable.phaseFolder}
              </span>
            )}
            {deliverable.category && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {ACERVO_CATEGORY_SHORT_LABELS[deliverable.category] || deliverable.category}
              </span>
            )}
          </div>

          <div>
            <h4
              className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors leading-snug"
              title={`${deliverable.sheetCode ? `${deliverable.sheetCode} · ` : ""}${deliverable.title}${deliverable.subtitle ? ` — ${deliverable.subtitle}` : ""}`}
            >
              {deliverable.sheetCode ? (
                <span className="font-mono text-xs font-bold text-blue-700 mr-1.5">
                  {deliverable.sheetCode} ·
                </span>
              ) : null}
              <span>{deliverable.title}</span>
              {deliverable.subtitle ? (
                <span className="font-normal text-zinc-600"> — {deliverable.subtitle}</span>
              ) : null}
            </h4>
          </div>

          {/* Tag de Assunto */}
          <div className="pt-0.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
              🏷️ {deliverable.subject}
            </span>
          </div>

          {/* Descrição Técnica se houver */}
          {deliverable.description ? (
            <p className="mt-1 text-[11px] text-zinc-600 line-clamp-2 leading-relaxed bg-zinc-50 p-2 rounded-xl border border-zinc-100">
              {deliverable.description}
            </p>
          ) : null}

          {/* Miniatura Otimizada para Renders 3D / Imagens */}
          {isImage && (
            <div
              onClick={() => onView(deliverable)}
              className="mt-2.5 relative aspect-video w-full cursor-pointer rounded-xl bg-zinc-900 overflow-hidden group/thumb shadow-2xs"
            >
              <Image
                src={deliverable.fileUrl}
                alt={deliverable.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                loading="lazy"
                className="object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                unoptimized={deliverable.fileUrl.startsWith("/api/")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white pointer-events-none">
                <span className="rounded bg-blue-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs">
                  Render 3D Corona
                </span>
                <span className="text-[10px] font-medium opacity-90">🔍 Ver Imagem</span>
              </div>
            </div>
          )}
        </div>

        {/* Metadados Técnicos (Ambiente, Etapa, Pasta) */}
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-[11px]">
          {deliverable.environment?.name && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium text-slate-700">{deliverable.environment.name}</span>
            </div>
          )}

          {deliverable.stage?.name && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="truncate text-slate-600">{deliverable.stage.name}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              {isPdf ? "📄 Documento PDF" : "🖼️ Imagem / Render"}
              {deliverable.fileSize ? ` • ${deliverable.fileSize}` : ""}
            </span>
            <span className="font-mono text-slate-400">
              {new Date(deliverable.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
      </div>

      {/* Footer com Botões de Ação */}
      <div className="mt-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 border-t border-slate-100 pt-3">
        {/* Visualizar Planta */}
        <button
          type="button"
          onClick={() => onView(deliverable)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98] transition-transform duration-75 select-none"
          title="Abrir visualizador da planta técnica"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Visualizar
        </button>

        {/* Download Direto */}
        <a
          href={downloadUrl}
          download={downloadFileName}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-transform duration-75 select-none"
          title="Baixar arquivo da prancha"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>

        {/* Editar Cadastro */}
        <button
          type="button"
          onClick={() => onEdit(deliverable)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 active:scale-[0.98] transition-transform duration-75 select-none"
          title="Editar cadastro da prancha (título, subtítulo, revisão, subpasta)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Editar
        </button>

        {/* Excluir */}
        <button
          type="button"
          onClick={() => onDelete(deliverable.id, deliverable.sheetCode)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98] transition-transform duration-75 select-none"
          title="Remover prancha"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

