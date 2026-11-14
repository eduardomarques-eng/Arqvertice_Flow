"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/formatters";
import type { WorkspaceRfiItem } from "@/components/acervo/cde-workspace-viewer";
import type { ExtractedIfcTakeoff } from "@/components/acervo/ifc-3d-viewer";
import { AcervoQrCodeModal } from "@/components/acervo/acervo-qrcode-modal";
import { AcervoUploadRevisionModal } from "@/components/acervo/acervo-upload-revision-modal";
import {
  generateAutoLispScript,
  generatePyRevitScript,
  downloadTextFile,
} from "@/components/acervo/acervo-script-generators";

const CdeWorkspaceViewer = dynamic(
  () =>
    import("@/components/acervo/cde-workspace-viewer").then(
      (mod) => mod.CdeWorkspaceViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[580px] w-full animate-pulse rounded-2xl border border-slate-200/60 bg-slate-200/50" />
    ),
  }
);

export interface ProjectDetailData {
  id: string;
  name: string;
  clientName?: string;
  activeTokensCount?: number;
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
      fileType: string;
      viewUrl?: string | null;
      viewFileName?: string | null;
      viewFileType?: string | null;
      digitalStampHash?: string | null;
      qrVerificationToken?: string | null;
      extractedMetadata?: unknown;
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
      rfis: WorkspaceRfiItem[];
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
  const [selectedDocId, setSelectedDocId] = useState<string>(project.documents[0]?.id || "");
  const currentDoc = useMemo(
    () => project.documents.find((d) => d.id === selectedDocId) || project.documents[0],
    [project.documents, selectedDocId]
  );

  const [selectedRevId, setSelectedRevId] = useState<string>(
    currentDoc?.revisions.find((r) => r.isCurrent)?.id || currentDoc?.revisions[0]?.id || ""
  );

  useEffect(() => {
    if (!currentDoc) return;
    const stillExists = currentDoc.revisions.some((r) => r.id === selectedRevId);
    if (!stillExists) {
      const defRev = currentDoc.revisions.find((r) => r.isCurrent) || currentDoc.revisions[0];
      setSelectedRevId(defRev?.id || "");
    }
  }, [currentDoc, selectedRevId]);

  const activeRevision = useMemo(
    () =>
      currentDoc?.revisions.find((r) => r.id === selectedRevId) ||
      currentDoc?.revisions.find((r) => r.isCurrent) ||
      currentDoc?.revisions[0],
    [currentDoc, selectedRevId]
  );

  const currentValidRevision = useMemo(
    () => currentDoc?.revisions.find((r) => r.isCurrent && r.status !== "OBSOLETO") || currentDoc?.revisions[0],
    [currentDoc]
  );

  const previousRevision = useMemo(() => {
    if (!currentDoc || !activeRevision || currentDoc.revisions.length < 2) return null;
    const idx = currentDoc.revisions.findIndex((r) => r.id === activeRevision.id);
    if (idx >= 0 && idx + 1 < currentDoc.revisions.length) {
      return currentDoc.revisions[idx + 1];
    }
    return currentDoc.revisions.find((r) => r.id !== activeRevision.id) || null;
  }, [currentDoc, activeRevision]);

  // Zona C Tabs & State
  const [zonaCTab, setZonaCTab] = useState<"FICHA" | "BIM_IA" | "RFIS" | "INTEGRACAO">("FICHA");
  const [activeTool, setActiveTool] = useState<"PAN" | "PIN" | "CLOUD" | "DIMENSION">("PAN");
  const [rfis, setRfis] = useState<WorkspaceRfiItem[]>(activeRevision?.rfis || []);
  const [rfiFilter, setRfiFilter] = useState<"ALL" | "ABERTA" | "RESPONDIDA" | "ENCERRADA">("ALL");
  const [selectedRfi, setSelectedRfi] = useState<WorkspaceRfiItem | null>(null);
  const [answerInput, setAnswerInput] = useState("");

  // Modal de nova RFI (2D / 3D)
  const [pendingMarkup, setPendingMarkup] = useState<{
    markupType: "PIN" | "CLOUD" | "DIMENSION";
    coordX?: number;
    coordY?: number;
    pageNumber?: number;
    geometryJson?: string;
    cameraState?: {
      position: [number, number, number];
      target: [number, number, number];
      pinPosition: [number, number, number];
    };
  } | null>(null);
  const [newRfiTitle, setNewRfiTitle] = useState("");
  const [newRfiDesc, setNewRfiDesc] = useState("");
  const [fieldPhoto, setFieldPhoto] = useState<string | null>(null);
  const [isSavingRfi, setIsSavingRfi] = useState(false);

  // Quantitativos BIM/IA
  const [takeoffs, setTakeoffs] = useState<ExtractedIfcTakeoff[]>([]);
  const [extractSource, setExtractSource] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSendingProposal, setIsSendingProposal] = useState(false);
  const [proposalFeedback, setProposalFeedback] = useState<{ url: string; code: string } | null>(null);

  // Modais & Workflow
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [auditReasonModal, setAuditReasonModal] = useState<{ isOpen: boolean; revisionId?: string }>({
    isOpen: false,
  });
  const [auditReason, setAuditReason] = useState("");

  useEffect(() => {
    setRfis(activeRevision?.rfis || []);
    setSelectedRfi(null);
    setProposalFeedback(null);
    if (activeRevision?.extractedMetadata) {
      try {
        const parsed =
          typeof activeRevision.extractedMetadata === "string"
            ? JSON.parse(activeRevision.extractedMetadata)
            : (activeRevision.extractedMetadata as Record<string, unknown>);
        if (Array.isArray(parsed?.takeoffs)) {
          setTakeoffs(parsed.takeoffs as ExtractedIfcTakeoff[]);
          setExtractSource((parsed.source as string) || "CACHE_BIM");
          return;
        }
      } catch {
        // Ignora parse inválido
      }
    }
    setTakeoffs([]);
    setExtractSource(null);
  }, [activeRevision]);

  const latestGrd = project.grds[0];

  function getStatusBadge(status: string) {
    switch (status) {
      case "BOM_PARA_OBRA":
      case "APROVADO_OBRA":
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">Liberada p/ Obra</Badge>;
      case "EM_REVISAO_TECNICA":
      case "EM_ANALISE":
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200">Em Análise</Badge>;
      case "APROVADO_COM_RESSALVAS":
      case "APROVADO_RESSALVAS":
        return <Badge className="bg-blue-50 text-blue-800 border-blue-200">Aprovado c/ Ressalvas</Badge>;
      case "REPROVADO":
        return <Badge className="bg-rose-50 text-rose-800 border-rose-200">Reprovado</Badge>;
      case "OBSOLETO":
        return <Badge className="bg-rose-100 text-rose-900 border-rose-300">Obsoleto</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Em Elaboração</Badge>;
    }
  }

  async function handleStatusTransition(revisionId: string, toStatus: string) {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/acervo/revisions/${revisionId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus,
          action: `PARECER_${toStatus}`,
          notes: `Parecer técnico registrado por ${userRole} no Workspace CDE`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(data.error || "Erro ao registrar parecer técnico.");
      }
    } catch {
      alert("Falha de conexão com o servidor.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function handleDownloadClick(revId: string, status: string, fileUrl: string) {
    if (status === "OBSOLETO") {
      if (userRole !== "ADMIN") {
        alert("Bloqueio CDE: Revisão OBSOLETA. Download bloqueado para evitar uso indevido na obra.");
        return;
      }
      setAuditReasonModal({ isOpen: true, revisionId: revId });
      return;
    }
    window.open(fileUrl, "_blank");
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

  function handleFieldPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setFieldPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveNewRfi(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRevision || !pendingMarkup || !newRfiTitle.trim()) return;
    setIsSavingRfi(true);
    try {
      const baseGeom = pendingMarkup.geometryJson ? JSON.parse(pendingMarkup.geometryJson) : {};
      const finalGeometry = JSON.stringify({
        ...baseGeom,
        ...(fieldPhoto ? { photoUrl: fieldPhoto } : {}),
      });

      const res = await fetch(`/api/acervo/revisions/${activeRevision.id}/rfi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newRfiTitle,
          description: newRfiDesc || newRfiTitle,
          markupType: pendingMarkup.markupType,
          coordX: pendingMarkup.coordX,
          coordY: pendingMarkup.coordY,
          pageNumber: pendingMarkup.pageNumber || 1,
          cameraState: pendingMarkup.cameraState,
          geometryJson: finalGeometry,
        }),
      });
      const data = await res.json();
      if (res.ok && data.rfi) {
        setRfis((prev) => [...prev, data.rfi]);
        setPendingMarkup(null);
        setNewRfiTitle("");
        setNewRfiDesc("");
        setFieldPhoto(null);
        setActiveTool("PAN");
        setZonaCTab("RFIS");
      } else {
        alert(data.error || "Erro ao salvar RFI.");
      }
    } catch {
      alert("Falha de conexão ao salvar RFI.");
    } finally {
      setIsSavingRfi(false);
    }
  }

  async function handleAnswerRfi(rfiId: string) {
    if (!activeRevision || !answerInput.trim()) return;
    try {
      const res = await fetch(`/api/acervo/revisions/${activeRevision.id}/rfi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfiId, answer: answerInput, status: "RESPONDIDA" }),
      });
      const data = await res.json();
      if (res.ok && data.rfi) {
        setRfis((prev) => prev.map((r) => (r.id === rfiId ? data.rfi : r)));
        setSelectedRfi(data.rfi);
        setAnswerInput("");
      }
    } catch {
      alert("Erro ao responder RFI.");
    }
  }

  async function handleExtractPdfTakeoffs() {
    if (!activeRevision || !currentDoc) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/acervo/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revisionId: activeRevision.id,
          sheetTitle: currentDoc.title,
          fileName: activeRevision.fileName,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.takeoffs)) {
        setTakeoffs(data.takeoffs);
        setExtractSource(data.source || "DETERMINISTIC_PARSER");
      }
    } finally {
      setIsExtracting(false);
    }
  }

  function handleExportCsv() {
    if (takeoffs.length === 0 || !currentDoc || !activeRevision) return;
    const header = "Categoria;Descricao;Quantidade;Unidade\n";
    const rows = takeoffs
      .map((item) => `"${item.category}";"${item.description.replace(/"/g, '""')}";${item.quantity};"${item.unit}"`)
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantitativos-${currentDoc.code}-${activeRevision.revisionNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSendToProposal() {
    if (takeoffs.length === 0 || !currentDoc || !activeRevision) return;
    setIsSendingProposal(true);
    try {
      const res = await fetch("/api/acervo/send-to-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          documentCode: currentDoc.code,
          revisionNumber: activeRevision.revisionNumber,
          items: takeoffs,
        }),
      });
      const data = await res.json();
      if (res.ok && data.proposalUrl) {
        setProposalFeedback({ url: data.proposalUrl, code: data.proposalCode || "Proposta" });
      } else {
        alert(data.error || "Erro ao enviar quantitativos para proposta.");
      }
    } catch {
      alert("Falha de comunicação ao enviar para proposta.");
    } finally {
      setIsSendingProposal(false);
    }
  }

  const filteredRfis = useMemo(() => {
    if (rfiFilter === "ALL") return rfis;
    return rfis.filter((r) => r.status === rfiFilter);
  }, [rfis, rfiFilter]);

  const isObsoleteSelected = activeRevision?.status === "OBSOLETO";
  const canApprove =
    activeRevision &&
    ["EM_ANALISE", "EM_REVISAO_TECNICA", "EM_ELABORACAO"].includes(activeRevision.status);

  // Checklist operacional 4 passos
  const step1Grd = project.grds.length > 0;
  const step2Compat = rfis.length === 0 || rfis.every((r) => r.status !== "ABERTA");
  const step3Quant = takeoffs.length > 0;
  const step4Liberada =
    activeRevision?.status === "BOM_PARA_OBRA" || activeRevision?.status === "APROVADO_OBRA";

  return (
    <div className="space-y-5">
      {/* Navegação Superior & Seletor Rápido de Pranchas do Empreendimento */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Link href={`${basePath}/acervo`} className="font-medium text-slate-500 hover:text-slate-900">
            ← Acervo Manager
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{project.name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentDoc?.id || ""}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="h-9 max-w-xs rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:border-[#18181B] focus:outline-none"
          >
            {project.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.title}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="h-9 rounded-xl bg-[#18181B] text-white hover:bg-zinc-800"
          >
            + Subir Nova Revisão
          </Button>
        </div>
      </div>

      {!currentDoc || !activeRevision ? (
        <Card className="rounded-2xl border-slate-200/60 bg-white p-12 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-sm font-semibold text-slate-900">Nenhuma prancha cadastrada neste empreendimento</p>
          <p className="mt-1 text-xs text-slate-500">
            Clique em &quot;+ Subir Nova Revisão&quot; para publicar a primeira prancha ou modelo BIM.
          </p>
        </Card>
      ) : (
        <>
          {/* ZONA A — Cabeçalho Técnico Inteligente & Ciclo de Vida da Revisão */}
          <Card className="rounded-2xl border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#EDE5D8] px-2.5 py-0.5 font-mono text-xs font-bold text-[#18181B]">
                    {currentDoc.code}
                  </span>
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                    {currentDoc.discipline}
                  </Badge>
                  <Badge className="bg-slate-50 text-slate-600 border-slate-200">
                    {currentDoc.phase}
                  </Badge>
                  {getStatusBadge(activeRevision.status)}
                  {latestGrd && (
                    <span className="font-mono text-[11px] text-slate-500">
                      Última GRD: <strong className="text-slate-800">{latestGrd.code}</strong>
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                  {currentDoc.title}
                </h1>
              </div>

              {/* Barra de Ações Contextuais */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsQrOpen(true)}
                  className="h-9 rounded-xl border-slate-200 text-xs font-semibold"
                >
                  QR Code da Prancha
                </Button>

                {!isObsoleteSelected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleDownloadClick(activeRevision.id, activeRevision.status, activeRevision.fileUrl)
                    }
                    className="h-9 rounded-xl border-slate-200 text-xs font-semibold"
                  >
                    Baixar ({activeRevision.fileType})
                  </Button>
                ) : (
                  userRole === "ADMIN" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDownloadClick(activeRevision.id, activeRevision.status, activeRevision.fileUrl)
                      }
                      className="h-9 rounded-xl border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Download Auditado (Admin)
                    </Button>
                  )
                )}

                {canApprove && (
                  <>
                    <Button
                      size="sm"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusTransition(activeRevision.id, "BOM_PARA_OBRA")}
                      className="h-9 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Liberar para Obra
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdatingStatus}
                      onClick={() =>
                        handleStatusTransition(activeRevision.id, "APROVADO_COM_RESSALVAS")
                      }
                      className="h-9 rounded-xl border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Aprovar c/ Ressalvas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusTransition(activeRevision.id, "REPROVADO")}
                      className="h-9 rounded-xl border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Reprovar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Seletor de Histórico de Revisões (R00, R01, R02...) */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                Histórico de Revisões:
              </span>
              {currentDoc.revisions.map((rev) => {
                const isSel = rev.id === activeRevision.id;
                return (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => setSelectedRevId(rev.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono font-semibold transition ${isSel
                      ? "border-[#18181B] bg-[#18181B] text-white shadow-sm"
                      : rev.status === "OBSOLETO"
                        ? "border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-50"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <span>{rev.revisionNumber}</span>
                    {rev.isCurrent && rev.status !== "OBSOLETO" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Faixa de Alerta Vermelha Inequívoca quando OBSOLETO */}
            {isObsoleteSelected && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  <span>
                    <strong>Arquivo Obsoleto — Apenas consulta auditada.</strong> A revisão vigente liberada é{" "}
                    <strong className="font-mono">
                      {currentValidRevision?.revisionNumber || "R00"}
                    </strong>
                    . Download padrão bloqueado para evitar execução defasada em obra.
                  </span>
                </div>
                {currentValidRevision && currentValidRevision.id !== activeRevision.id && (
                  <button
                    type="button"
                    onClick={() => setSelectedRevId(currentValidRevision.id)}
                    className="shrink-0 rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-800 transition"
                  >
                    Ir para {currentValidRevision.revisionNumber}
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* ZONAS B + C — Grid Principal (8 Colunas Visualizador + 4 Colunas Detalhamento) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
            {/* ZONA B — Visualizador Interativo 2D/3D + Visual Diff */}
            <div className="lg:col-span-8">
              <CdeWorkspaceViewer
                revision={activeRevision}
                previousRevision={previousRevision}
                rfis={rfis}
                selectedRfiId={selectedRfi?.id}
                onSelectRfi={(rfi) => {
                  setSelectedRfi(rfi);
                  setZonaCTab("RFIS");
                }}
                activeTool={activeTool}
                onChangeTool={setActiveTool}
                onCreate2dMarkup={(payload) => setPendingMarkup(payload)}
                onCreate3dRfi={(cam) =>
                  setPendingMarkup({
                    markupType: "PIN",
                    cameraState: cam,
                  })
                }
                onExtractedIfcQuantities={(items) => {
                  setTakeoffs(items);
                  setExtractSource("WEB_IFC_NATIVE");
                  setZonaCTab("BIM_IA");
                }}
              />
            </div>

            {/* ZONA C — Painel Lateral de Detalhamento (4 Abas Coerentes) */}
            <aside className="lg:col-span-4 rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="grid grid-cols-4 border-b border-slate-200/70 bg-[#F5F5F7] text-[10px] font-semibold uppercase tracking-wide">
                {(
                  [
                    { key: "FICHA", label: "Ficha" },
                    { key: "BIM_IA", label: "BIM/IA" },
                    { key: "RFIS", label: `RFIs (${rfis.length})` },
                    { key: "INTEGRACAO", label: "CAD/BIM" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setZonaCTab(tab.key)}
                    className={`py-3 px-1 text-center border-b-2 transition ${zonaCTab === tab.key
                      ? "border-[#18181B] bg-white text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4 max-h-[580px] overflow-y-auto">
                {/* Formulário Rápido ao clicar para criar Pino/Nuvem/Cota */}
                {pendingMarkup && (
                  <form
                    onSubmit={handleSaveNewRfi}
                    className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-rose-800">
                        Novo Apontamento ({pendingMarkup.markupType})
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingMarkup(null)}
                        className="text-xs text-rose-600 hover:text-rose-900"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Título da RFI / Interferência..."
                      value={newRfiTitle}
                      onChange={(e) => setNewRfiTitle(e.target.value)}
                      className="h-8 w-full rounded-lg border border-rose-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      placeholder="Descrição técnica..."
                      value={newRfiDesc}
                      onChange={(e) => setNewRfiDesc(e.target.value)}
                      className="w-full rounded-lg border border-rose-200 bg-white p-2 text-xs text-slate-900 focus:outline-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                        📷 Anexar Foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleFieldPhotoPick}
                        />
                      </label>
                      {fieldPhoto && (
                        <span className="text-[10px] font-semibold text-emerald-700">✓ Foto anexada</span>
                      )}
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSavingRfi}
                        className="h-8 bg-[#18181B] text-white text-xs"
                      >
                        {isSavingRfi ? "Salvando..." : "Salvar RFI"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* ABA 1 — Ficha Técnica, Arquivos & Auditoria */}
                {zonaCTab === "FICHA" && (
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl border border-slate-200/70 bg-[#F5F5F7]/70 p-3.5 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Metadados do Carimbo
                      </p>
                      <p className="text-slate-600">
                        Código: <strong className="font-mono text-slate-900">{currentDoc.code}</strong>
                      </p>
                      <p className="text-slate-600">
                        Revisão: <strong className="font-mono text-slate-900">{activeRevision.revisionNumber}</strong>
                      </p>
                      <p className="text-slate-600">
                        Emissão: <strong className="text-slate-900">{formatDateBR(activeRevision.createdAt)}</strong>
                      </p>
                      <p className="text-slate-600 break-all">
                        Selo SHA-256:{" "}
                        <span className="font-mono text-[10px] text-slate-500">
                          {activeRevision.digitalStampHash || "Aguardando liberação p/ obra"}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Arquivos da Revisão
                      </p>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px] font-semibold text-slate-900">
                            {activeRevision.fileName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Primário · {activeRevision.fileType} · {activeRevision.fileSize || "Nativo"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadClick(activeRevision.id, activeRevision.status, activeRevision.fileUrl)
                          }
                          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Baixar
                        </button>
                      </div>

                      {activeRevision.viewUrl && (
                        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] font-semibold text-slate-900">
                              {activeRevision.viewFileName || "Par de Visualização Web"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Pareado Web · {activeRevision.viewFileType || "PDF"}
                            </p>
                          </div>
                          <a
                            href={activeRevision.viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Abrir
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Histórico Auditável (WorkflowLog)
                      </p>
                      <div className="space-y-2">
                        {(activeRevision.workflowLogs || []).map((log) => (
                          <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800">{log.action}</span>
                              <span className="text-[10px] text-slate-400">{formatDateBR(log.createdAt)}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Por {log.performedByName} ({log.performedByRole}) · Status: {log.toStatus}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 2 — BIM & Quantitativos */}
                {zonaCTab === "BIM_IA" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={handleExtractPdfTakeoffs}
                        disabled={isExtracting}
                        className="w-full h-9 rounded-xl bg-[#18181B] text-white hover:bg-zinc-800"
                      >
                        {isExtracting ? "Extraindo..." : "Ler Carimbo e Quadros da Prancha (IA/PDF)"}
                      </Button>
                      <p className="text-[10px] text-slate-500 text-center">
                        Para modelos 3D, use também &quot;Extrair Quantitativos IFC&quot; na barra do visualizador 3D.
                      </p>
                    </div>

                    {extractSource && (
                      <div className="flex items-center justify-between rounded-lg bg-[#EDE5D8]/50 px-2.5 py-1.5 text-[10px] font-semibold text-[#18181B]">
                        <span>Motor: {extractSource}</span>
                        <span>{takeoffs.length} itens</span>
                      </div>
                    )}

                    {isExtracting ? (
                      <div className="space-y-2">
                        {[0, 1, 2, 3].map((k) => (
                          <div key={k} className="h-10 w-full animate-pulse rounded-xl bg-slate-200/50" />
                        ))}
                      </div>
                    ) : takeoffs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
                        Nenhum quantitativo extraído ainda para esta revisão.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-hidden rounded-xl border border-slate-200/80">
                          <table className="w-full text-left text-[11px]">
                            <thead className="border-b border-slate-200 bg-[#F5F5F7] text-[10px] uppercase text-slate-500">
                              <tr>
                                <th className="px-2.5 py-2">Item</th>
                                <th className="px-2 py-2 text-right">Qtd</th>
                                <th className="px-2 py-2 text-right">Un</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {takeoffs.map((item, idx) => (
                                <tr key={`${item.category}-${idx}`}>
                                  <td className="px-2.5 py-1.5">
                                    <span className="block text-[9px] font-bold uppercase text-slate-400">
                                      {item.category}
                                    </span>
                                    <span className="text-slate-800">{item.description}</span>
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setTakeoffs((prev) =>
                                          prev.map((row, rIdx) => (rIdx === idx ? { ...row, quantity: val } : row))
                                        );
                                      }}
                                      className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-right font-mono text-[11px]"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <input
                                      type="text"
                                      value={item.unit}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTakeoffs((prev) =>
                                          prev.map((row, rIdx) => (rIdx === idx ? { ...row, unit: val } : row))
                                        );
                                      }}
                                      className="w-10 rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-[11px]"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportCsv}
                            className="w-full h-9 rounded-xl border-slate-200 font-semibold"
                          >
                            Exportar CSV (Orçamentistas)
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSendToProposal}
                            disabled={isSendingProposal}
                            className="w-full h-9 rounded-xl bg-[#18181B] text-white hover:bg-zinc-800 font-semibold"
                          >
                            {isSendingProposal
                              ? "Enviando..."
                              : "Enviar para Proposta do Empreendimento"}
                          </Button>
                        </div>

                        {proposalFeedback && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                            <p className="font-semibold">
                              ✓ Itens adicionados à proposta {proposalFeedback.code}
                            </p>
                            <Link
                              href={proposalFeedback.url}
                              className="mt-1 inline-block text-[11px] font-semibold underline"
                            >
                              Abrir Proposta Comercial →
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ABA 3 — RFIs, Markups & Apontamentos de Campo */}
                {zonaCTab === "RFIS" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-1 rounded-xl bg-[#F5F5F7] p-1 text-[10px] font-semibold">
                      {(["ALL", "ABERTA", "RESPONDIDA", "ENCERRADA"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setRfiFilter(st)}
                          className={`flex-1 rounded-lg py-1 transition ${rfiFilter === st ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                            }`}
                        >
                          {st === "ALL" ? "Todas" : st}
                        </button>
                      ))}
                    </div>

                    {filteredRfis.length === 0 ? (
                      <p className="py-8 text-center text-slate-400">
                        Nenhuma RFI encontrada. Selecione &quot;📍 Pino RFI&quot;, &quot;☁️ Nuvem&quot; ou &quot;📏 Cota&quot; na barra acima e clique no desenho.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredRfis.map((rfi) => {
                          const isSel = selectedRfi?.id === rfi.id;
                          let parsedGeom: { photoUrl?: string; distance?: string } = {};
                          try {
                            if (rfi.geometryJson) parsedGeom = JSON.parse(rfi.geometryJson);
                          } catch { }

                          return (
                            <div
                              key={rfi.id}
                              onClick={() => setSelectedRfi(rfi)}
                              className={`cursor-pointer rounded-xl border p-3 transition ${isSel
                                ? "border-[#18181B] bg-[#F5F5F7] ring-1 ring-[#18181B]"
                                : "border-slate-200/80 bg-white hover:border-slate-300"
                                }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {rfi.code} · {rfi.markupType}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                  {rfi.status}
                                </span>
                              </div>
                              <p className="mt-1 font-semibold text-slate-900">{rfi.title}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{rfi.description}</p>
                              {parsedGeom.distance && (
                                <p className="mt-1 font-mono text-[10px] text-blue-700">
                                  Medição: {parsedGeom.distance}
                                </p>
                              )}

                              {parsedGeom.photoUrl && (
                                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                                  <img
                                    src={parsedGeom.photoUrl}
                                    alt="Foto de campo"
                                    className="h-28 w-full object-cover"
                                  />
                                </div>
                              )}

                              {isSel && (
                                <div className="mt-2.5 border-t border-slate-200 pt-2 space-y-2">
                                  {rfi.answer ? (
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-900">
                                      <strong>Resposta:</strong> {rfi.answer}
                                    </div>
                                  ) : (
                                    <div className="flex gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="Responder RFI..."
                                        value={answerInput}
                                        onChange={(e) => setAnswerInput(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAnswerRfi(rfi.id);
                                        }}
                                        className="h-8 bg-emerald-600 text-white text-xs"
                                      >
                                        Enviar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ABA 4 — Integração AutoCAD / Revit & Fluxo do Estúdio */}
                {zonaCTab === "INTEGRACAO" && (
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl border border-slate-200/80 bg-[#F5F5F7] p-3.5 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Sync API Ativa
                      </p>
                      <p className="font-mono text-[10px] break-all rounded-lg bg-white border border-slate-200 p-2 text-slate-800">
                        POST https://arqvertice-flow.vercel.app/api/acervo/sync-plugin
                      </p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">Tokens ativos no projeto:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {project.activeTokensCount ?? 0}
                        </span>
                      </div>
                      {basePath === "/admin" && (
                        <Link
                          href="/admin/acervo/configuracoes"
                          className="inline-block text-[11px] font-semibold text-slate-900 underline"
                        >
                          Gerenciar Tokens API →
                        </Link>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Scripts Prontos para Download
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadTextFile(
                            "ArqVerticeSync.lsp",
                            generateAutoLispScript(project.id, project.name)
                          )
                        }
                        className="w-full h-9 justify-between rounded-xl border-slate-200 text-xs"
                      >
                        <span>📐 ArqVerticeSync.lsp (AutoCAD)</span>
                        <span>⬇</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadTextFile(
                            "ArqVerticeSync_script.py",
                            generatePyRevitScript(project.id, project.name)
                          )
                        }
                        className="w-full h-9 justify-between rounded-xl border-slate-200 text-xs"
                      >
                        <span>🏗️ ArqVerticeSync_script.py (pyRevit)</span>
                        <span>⬇</span>
                      </Button>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Checklist Operacional do Estúdio
                      </p>
                      {[
                        { label: "1. Postada com GRD", done: step1Grd },
                        { label: "2. Compatibilizada 2D/3D (0 RFIs abertas)", done: step2Compat },
                        { label: "3. Quantificada BIM/IA", done: step3Quant },
                        { label: "4. Liberada com Carimbo & QR Code", done: step4Liberada },
                      ].map((step) => (
                        <div key={step.label} className="flex items-center gap-2 text-[11px]">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${step.done
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-500"
                              }`}
                          >
                            {step.done ? "✓" : "•"}
                          </span>
                          <span className={step.done ? "font-medium text-slate-900" : "text-slate-500"}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Modais */}
      {activeRevision && currentDoc && (
        <AcervoQrCodeModal
          revisionId={activeRevision.id}
          documentCode={currentDoc.code}
          revisionNumber={activeRevision.revisionNumber}
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
        />
      )}

      <AcervoUploadRevisionModal
        projectId={project.id}
        initialCode={currentDoc?.code}
        initialTitle={currentDoc?.title}
        initialDiscipline={currentDoc?.discipline}
        initialPhase={currentDoc?.phase}
        namingMaskExample={project.namingRules[0]?.example}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setIsUploadOpen(false);
          window.location.reload();
        }}
      />

      {auditReasonModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Auditoria de Download (Arquivo Obsoleto)
            </h3>
            <p className="text-xs text-slate-600">
              Esta revisão está bloqueada por obsolescência. Informe a justificativa técnica para registrar no histórico auditável:
            </p>
            <textarea
              rows={3}
              placeholder="Ex: Conferência histórica de compatibilização..."
              value={auditReason}
              onChange={(e) => setAuditReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-[#18181B] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAuditReasonModal({ isOpen: false })}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={confirmObsoleteDownload}
                disabled={!auditReason.trim()}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Registrar & Baixar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
