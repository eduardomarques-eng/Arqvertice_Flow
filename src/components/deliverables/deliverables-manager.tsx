"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  parseSheetFileName,
  type ParsedSheetMetadata,
  APPROVAL_STATUS_LABELS,
  DISCIPLINE_LABELS,
} from "@/lib/sheet-metadata-parser";
import {
  SheetMetadataModal,
  type DeliverableData,
  type StageOption,
} from "./sheet-metadata-modal";
import { SheetMatrixView } from "./sheet-matrix-view";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ProjectDiscipline, DeliverableType, ApprovalStatus } from "@prisma/client";

interface DeliverableItem {
  id: string;
  sheetCode: string | null;
  subject: string;
  title: string;
  discipline: ProjectDiscipline;
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
  createdAt: Date | string;
}

interface DeliverablesManagerProps {
  projectId: string;
  initialDeliverables: DeliverableItem[];
  initialMatrix: DeliverableMatrix;
  stages: StageOption[];
}

export function DeliverablesManager({
  projectId,
  initialDeliverables,
  initialMatrix,
  stages,
}: DeliverablesManagerProps) {
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>(initialDeliverables);
  const [matrix, setMatrix] = useState<DeliverableMatrix>(initialMatrix);
  const [loading, setLoading] = useState(false);

  // Controle do Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedMeta, setParsedMeta] = useState<ParsedSheetMetadata | null>(null);
  const [editData, setEditData] = useState<DeliverableData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recarrega lista e matriz após alterações
  const reloadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/deliverables`);
      if (res.ok) {
        const data = await res.json();
        setDeliverables(data.deliverables || []);
        setMatrix(data.matrix);
      }
    } catch (e) {
      console.error("Erro ao recarregar pranchas:", e);
    } finally {
      setLoading(false);
    }
  };

  // 1. Disparo Imediato após Seleção do Arquivo
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setEditData(null);

    // Heurística de metadados inteligentes baseados no nome do arquivo
    const parsed = parseSheetFileName(file.name);
    setParsedMeta(parsed);

    // Abre o modal de cadastro imediatamente
    setModalOpen(true);

    // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 2. Abertura do Modal para Edição Posterior
  const handleEditClick = (item: DeliverableItem) => {
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
      description: item.description,
      status: item.status,
      isClientView: item.isClientView,
      isRequired: item.isRequired,
      fileSize: item.fileSize,
      fileUrl: item.fileUrl,
    });
    setModalOpen(true);
  };

  // 3. Exclusão de Prancha
  const handleDelete = async (id: string, sheetCode: string | null) => {
    if (!confirm(`Deseja realmente remover a prancha ${sheetCode || "selecionada"}?`)) {
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

  return (
    <div className="space-y-6">
      {/* Matriz de Pranchas Técnicas */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Controle de Engenharia
              </span>
              <span className="text-xs font-semibold text-slate-500">Matriz de Conferência</span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Matriz de Pranchas & Plantas Técnicas
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Controle de pranchas entregues vs. pendentes por disciplina com validação de escopo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
              id="sheet-upload-input"
            />
            <label
              htmlFor="sheet-upload-input"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload de Nova Prancha
            </label>
          </div>
        </div>

        {/* Componente da Matriz */}
        <div className="mt-6">
          <SheetMatrixView matrix={matrix} projectId={projectId} />
        </div>
      </Card>

      {/* Tabela de Pranchas e Documentos Técnicos */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Pranchas Cadastradas ({deliverables.length})
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Clique em &quot;Editar Metadados&quot; para atualizar código, assunto, disciplina, versão ou status.
            </p>
          </div>
          {loading ? (
            <span className="text-xs text-blue-600 font-semibold animate-pulse">Sincronizando...</span>
          ) : null}
        </div>

        {deliverables.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-xs font-semibold text-slate-600">Nenhuma prancha cadastrada ainda.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Faça o upload do primeiro arquivo PDF ou imagem para iniciar o cadastro inteligente.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-3 pr-2">Prancha</th>
                  <th className="py-2.5 px-2">Assunto & Descrição</th>
                  <th className="py-2.5 px-2">Disciplina</th>
                  <th className="py-2.5 px-2">Versão</th>
                  <th className="py-2.5 px-2">Etapa Cronograma</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Portal Cliente</th>
                  <th className="py-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {deliverables.map((item) => {
                  const statusMeta = APPROVAL_STATUS_LABELS[item.status] || { label: item.status, tone: "neutral" };
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 pl-3 pr-2 font-mono font-bold text-blue-700">
                        {item.sheetCode || "—"}
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-semibold text-slate-900">{item.subject}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{item.title}</p>
                        {item.environment?.name ? (
                          <span className="mt-0.5 inline-block text-[10px] text-slate-400">
                            Ambiente: {item.environment.name}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {DISCIPLINE_LABELS[item.discipline] || item.discipline}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-mono font-semibold text-slate-700">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          {item.version}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-600">
                        {item.stage?.name || "—"}
                      </td>
                      <td className="py-3 px-2">
                        <Badge tone={statusMeta.tone}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {item.isClientView ? (
                          <span className="text-[11px] font-semibold text-emerald-600">Liberado</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Privado</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/api/projects/${projectId}/deliverables/${item.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                          >
                            Ver
                          </a>
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Inteligente de Cadastro / Edição */}
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
        file={selectedFile}
        parsedMetadata={parsedMeta}
        initialData={editData}
      />
    </div>
  );
}

