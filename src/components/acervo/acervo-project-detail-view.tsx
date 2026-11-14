"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/formatters";
import dynamic from "next/dynamic";
import { CadBimIntegrationTab } from "@/components/acervo/cad-bim-integration-tab";

const CdeOnlineViewerModal = dynamic(
  () =>
    import("@/components/acervo/cde-online-viewer-modal").then(
      (mod) => mod.CdeOnlineViewerModal
    ),
  { ssr: false }
);

export interface ProjectDetailData {
  id: string;
  name: string;
  clientName?: string;
  namingRules: Array<{
    id: string;
    mask: string;
    example: string;
    policy: string;
  }>;
  documents: Array<{
    id: string;
    code: string;
    title: string;
    discipline: string;
    phase: string;
    revisions: Array<{
      id: string;
      revisionNumber: string;
      status: string;
      fileName: string;
      fileUrl: string;
      fileSize?: string | null;
      isCurrent: boolean;
      createdAt: string | Date;
      workflowLogs: Array<{
        id: string;
        action: string;
        fromStatus?: string | null;
        toStatus: string;
        performedByName: string;
        performedByRole: string;
        createdAt: string | Date;
      }>;
    }>;
  }>;
  grds: Array<{
    id: string;
    code: string;
    recipientName: string;
    recipientOrg?: string | null;
    createdAt: string | Date;
    itemsCount: number;
  }>;
}

export function AcervoProjectDetailView({
  project,
  basePath,
  userRole,
}: {
  project: ProjectDetailData;
  basePath: "/admin" | "/equipe";
  userRole: string;
}) {
  const [activeTab, setActiveTab] = useState<"DOCS" | "GRD" | "REGRAS" | "INTEGRACOES">("DOCS");
  const [selectedDocId, setSelectedDocId] = useState<string>(project.documents[0]?.id || "");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [auditReasonModal, setAuditReasonModal] = useState<{ isOpen: boolean; revisionId?: string; fileUrl?: string }>({
    isOpen: false,
  });
  const [auditReason, setAuditReason] = useState("");
  const [viewerModalState, setViewerModalState] = useState<{
    isOpen: boolean;
    revId?: string;
  }>({ isOpen: false });

  const currentDoc = project.documents.find((d) => d.id === selectedDocId);

  async function handleStatusTransition(revisionId: string, toStatus: string) {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/acervo/revisions/${revisionId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus,
          action: `TRANSIÇÃO_PARA_${toStatus}`,
          notes: `Atualizado pelo painel Acervo Manager por ${userRole}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(data.error || "Erro ao atualizar status.");
      }
    } catch {
      alert("Falha de conexão com o servidor.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function handleDownloadClick(rev: { id: string; status: string; fileUrl: string }) {
    if (rev.status === "OBSOLETO") {
      if (userRole !== "ADMIN") {
        alert("Bloqueio CDE: Esta revisão está OBSOLETA. Download bloqueado para execução em obra.");
        return;
      }
      setAuditReasonModal({ isOpen: true, revisionId: rev.id, fileUrl: rev.fileUrl });
      return;
    }
    window.open(rev.fileUrl, "_blank");
  }

  function confirmObsoleteDownload() {
    if (!auditReason.trim() || !auditReasonModal.revisionId) return;
    window.open(
      `/api/acervo/revisions/${auditReasonModal.revisionId}/download?reason=${encodeURIComponent(auditReason)}`,
      "_blank"
    );
    setAuditReasonModal({ isOpen: false });
    setAuditReason("");
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "BOM_PARA_OBRA":
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">Bom para Obra</Badge>;
      case "EM_REVISAO_TECNICA":
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200">Em Revisão</Badge>;
      case "APROVADO_COM_RESSALVAS":
        return <Badge className="bg-blue-50 text-blue-800 border-blue-200">Aprovado c/ Ressalvas</Badge>;
      case "OBSOLETO":
        return <Badge className="bg-rose-50 text-rose-800 border-rose-200">Obsoleto</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Em Elaboração</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo do Empreendimento */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/acervo`}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              ← Voltar ao Acervo
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-700">{project.name}</span>
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {project.name}
          </h2>
          <p className="text-xs text-slate-500">Cliente: {project.clientName || "Geral"}</p>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-200/50 p-1">
          <button
            onClick={() => setActiveTab("DOCS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "DOCS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pranchas & Revisões ({project.documents.length})
          </button>
          <button
            onClick={() => setActiveTab("GRD")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "GRD" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Remessas (GRD) ({project.grds.length})
          </button>
          <button
            onClick={() => setActiveTab("REGRAS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "REGRAS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Máscara CDE
          </button>
          <button
            onClick={() => setActiveTab("INTEGRACOES")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "INTEGRACOES" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Integrações CAD/BIM
          </button>
        </div>
      </div>

      {activeTab === "DOCS" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Coluna 1: Lista de Pranchas (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Documentos Técnicos
            </h3>
            <div className="space-y-2">
              {project.documents.map((doc) => {
                const currentRev = doc.revisions.find((r) => r.isCurrent) || doc.revisions[0];
                const isSelected = doc.id === selectedDocId;
                return (
                  <Card
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`cursor-pointer p-4 border-slate-200/60 bg-white transition ${
                      isSelected
                        ? "ring-2 ring-[#18181B] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
                        : "hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">{doc.code}</span>
                        <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{doc.title}</h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {currentRev?.revisionNumber || "R00"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{doc.discipline}</span>
                      {currentRev && getStatusBadge(currentRev.status)}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Detalhes da Prancha Selecionada e Histórico de Revisões (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {currentDoc ? (
              <Card className="p-6 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">{currentDoc.code}</span>
                    <span className="text-xs font-medium text-slate-500">{currentDoc.discipline} · {currentDoc.phase}</span>
                  </div>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{currentDoc.title}</h3>
                </div>

                {/* Lista de Revisões (R02, R01, R00) */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Histórico de Revisões & Trilha CDE
                  </h4>
                  <div className="space-y-3">
                    {currentDoc.revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className={`rounded-xl border p-4 transition ${
                          rev.isCurrent
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-slate-200/60 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded-md">
                              {rev.revisionNumber}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-slate-900">{rev.fileName}</p>
                              <p className="text-[10px] text-slate-400">
                                {formatDateBR(rev.createdAt)} · {rev.fileSize || "4.2 MB"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusBadge(rev.status)}
                            <button
                              onClick={() =>
                                setViewerModalState({
                                  isOpen: true,
                                  revId: rev.id,
                                })
                              }
                              className="rounded-lg bg-[#18181B] px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-[#27272A] transition"
                            >
                              Visualizador & RFI
                            </button>
                            <button
                              onClick={() => handleDownloadClick(rev)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 transition"
                            >
                              Baixar
                            </button>
                          </div>
                        </div>

                        {/* Ações de Transição de Status CDE (Apenas na Vigente) */}
                        {rev.isCurrent && (
                          <div className="mt-3 flex items-center gap-2 border-t border-slate-200/60 pt-3">
                            <span className="text-[11px] font-medium text-slate-500">Mover Esteira:</span>
                            {rev.status !== "BOM_PARA_OBRA" && (
                              <button
                                disabled={isUpdatingStatus}
                                onClick={() => handleStatusTransition(rev.id, "BOM_PARA_OBRA")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                              >
                                Aprovar Bom para Obra
                              </button>
                            )}
                            {rev.status !== "EM_REVISAO_TECNICA" && (
                              <button
                                disabled={isUpdatingStatus}
                                onClick={() => handleStatusTransition(rev.id, "EM_REVISAO_TECNICA")}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition"
                              >
                                Enviar p/ Revisão
                              </button>
                            )}
                            {rev.status !== "APROVADO_COM_RESSALVAS" && (
                              <button
                                disabled={isUpdatingStatus}
                                onClick={() => handleStatusTransition(rev.id, "APROVADO_COM_RESSALVAS")}
                                className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-900 hover:bg-blue-100 transition"
                              >
                                Ressalvas
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center text-xs text-slate-400">
                Selecione uma prancha para ver o histórico.
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "GRD" && (
        <Card className="p-6 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Guias de Remessa de Documentos (GRD) Emitidas
          </h3>
          {project.grds.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Nenhuma GRD gerada para este empreendimento ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {project.grds.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-slate-200/60 p-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900">{g.code}</span>
                    <p className="text-sm font-medium text-slate-800">Destinatário: {g.recipientName}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateBR(g.createdAt)} · {g.itemsCount} prancha(s) remetida(s)
                    </p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-700">Protocolado</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "REGRAS" && (
        <Card className="p-6 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Regra e Máscara de Nomenclatura CDE
          </h3>
          <p className="text-xs text-slate-500">
            Padrão aplicado aos uploads e conferência automática de pranchas deste empreendimento.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-xs text-slate-600 font-medium">Máscara Ativa:</p>
            <p className="font-mono text-sm font-bold text-slate-900">
              [EMPREENDIMENTO]-[DISCIPLINA]-[FASE]-[TIPO]-[SEQUENCIAL]-[REV]
            </p>
            <p className="text-[11px] text-slate-500">
              Exemplo de arquivo validado: <span className="font-mono text-slate-700">ARQ-FAC-PE-DET-001-R00.dwg</span>
            </p>
          </div>
        </Card>
      )}

      {activeTab === "INTEGRACOES" && (
        <CadBimIntegrationTab projectId={project.id} userRole={userRole} />
      )}

      {/* Modal Justificativa para Download de Obsoleto (Apenas ADMIN) */}
      {auditReasonModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="rounded-xl bg-rose-50 p-3 text-rose-900 text-xs">
              <strong>Atenção de Segurança CDE:</strong> Esta revisão está <strong>OBSOLETA</strong> e não deve ser utilizada na obra.
              Para baixar para fins periciais ou históricos, forneça a justificativa que ficará gravada no log de auditoria.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa Técnica do Administrador *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: Auditoria de compatibilização com a versão preliminar..."
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#18181B]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuditReasonModal({ isOpen: false })}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!auditReason.trim()}
                onClick={confirmObsoleteDownload}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Auditar e Baixar
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Visualizador Online Fullscreen CDE & RFIs */}
      {viewerModalState.isOpen && currentDoc && (
        <CdeOnlineViewerModal
          isOpen={viewerModalState.isOpen}
          onClose={() => setViewerModalState({ isOpen: false })}
          revision={{
            id: viewerModalState.revId || currentDoc.revisions[0]?.id || "",
            revisionNumber:
              currentDoc.revisions.find((r) => r.id === viewerModalState.revId)
                ?.revisionNumber || "R00",
            fileName:
              currentDoc.revisions.find((r) => r.id === viewerModalState.revId)
                ?.fileName || `${currentDoc.code}.pdf`,
            fileUrl:
              currentDoc.revisions.find((r) => r.id === viewerModalState.revId)
                ?.fileUrl || "#",
            fileType: "PDF",
            documentTitle: currentDoc.title,
            documentCode: currentDoc.code,
            discipline: currentDoc.discipline,
            status:
              currentDoc.revisions.find((r) => r.id === viewerModalState.revId)
                ?.status || "EM_ELABORACAO",
            allRevisions: currentDoc.revisions.map((r) => ({
              id: r.id,
              revisionNumber: r.revisionNumber,
              fileName: r.fileName,
              status: r.status,
            })),
          }}
          onSwitchRevision={(revId) =>
            setViewerModalState({ isOpen: true, revId })
          }
        />
      )}
    </div>
  );
}
