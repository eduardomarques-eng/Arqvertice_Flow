"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ViewerRfiItem {
  id: string;
  code: string;
  title: string;
  description: string;
  status: "ABERTA" | "RESPONDIDA" | "ENCERRADA";
  markupType: "PIN" | "CLOUD" | "DIMENSION";
  coordX?: number | null;
  coordY?: number | null;
  pageNumber?: number | null;
  geometryJson?: string | null;
  answer?: string | null;
  createdAt: string | Date;
  createdBy?: { name: string; role: string } | null;
}

export interface ViewerRevisionData {
  id: string;
  revisionNumber: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  viewUrl?: string | null;
  documentTitle: string;
  documentCode: string;
  discipline: string;
  status: string;
  allRevisions?: Array<{
    id: string;
    revisionNumber: string;
    fileName: string;
    status: string;
  }>;
}

interface CdeOnlineViewerModalProps {
  revision: ViewerRevisionData;
  isOpen: boolean;
  onClose: () => void;
  onSwitchRevision?: (revId: string) => void;
}

export function CdeOnlineViewerModal({
  revision,
  isOpen,
  onClose,
  onSwitchRevision,
}: CdeOnlineViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rfis, setRfis] = useState<ViewerRfiItem[]>([]);
  const [selectedRfi, setSelectedRfi] = useState<ViewerRfiItem | null>(null);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [newPinCoord, setNewPinCoord] = useState<{ x: number; y: number } | null>(null);
  const [newRfiTitle, setNewRfiTitle] = useState("");
  const [newRfiDesc, setNewRfiDesc] = useState("");
  const [fieldPhoto, setFieldPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"RFIS" | "LAYERS" | "QUANTITATIVOS">("RFIS");
  const [answerInput, setAnswerInput] = useState("");
  const [isSavingRfi, setIsSavingRfi] = useState(false);

  const [takeoffs, setTakeoffs] = useState<
    Array<{ category: string; description: string; quantity: number; unit: string }>
  >([]);
  const [extractSource, setExtractSource] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  async function handleExtractQuantities() {
    setIsExtracting(true);
    try {
      const res = await fetch("/api/acervo/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revisionId: revision.id,
          sheetTitle: revision.documentTitle,
          fileName: revision.fileName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.takeoffs) {
        setTakeoffs(data.takeoffs);
        setExtractSource(data.source || "DETERMINISTIC_PARSER");
      }
    } catch {
      // Silencioso em caso de erro de rede
    } finally {
      setIsExtracting(false);
    }
  }

  function handleExportCsv() {
    if (takeoffs.length === 0) return;
    const header = "Categoria;Descricao;Quantidade;Unidade\n";
    const rows = takeoffs
      .map((item) => `"${item.category}";"${item.description.replace(/"/g, '""')}";${item.quantity};"${item.unit}"`)
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantitativos-${revision.documentCode}-${revision.revisionNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("A foto excede o limite recomendado de 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (typeof result === "string") {
        setFieldPhoto(result);
      }
    };
    reader.readAsDataURL(file);
  }

  // Carrega RFIs da revisão
  useEffect(() => {
    if (!isOpen || !revision.id) return;
    fetch(`/api/acervo/revisions/${revision.id}/rfi`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rfis) setRfis(data.rfis);
      })
      .catch((err) => console.error("Erro ao carregar RFIs:", err));
  }, [isOpen, revision.id]);

  if (!isOpen) return null;

  const displayUrl = revision.viewUrl || revision.fileUrl;
  const isImageOrPdf =
    displayUrl.endsWith(".pdf") ||
    displayUrl.endsWith(".png") ||
    displayUrl.endsWith(".jpg") ||
    displayUrl.endsWith(".webp") ||
    displayUrl.endsWith(".svg") ||
    revision.fileType === "PDF" ||
    revision.fileType === "IMG";

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isPlacingPin || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setNewPinCoord({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    setIsPlacingPin(false);
  }

  async function handleCreateRfi(e: React.FormEvent) {
    e.preventDefault();
    if (!newRfiTitle.trim() || !newPinCoord) return;

    setIsSavingRfi(true);
    try {
      const geometryPayload = fieldPhoto
        ? JSON.stringify({ pin: newPinCoord, photoUrl: fieldPhoto })
        : JSON.stringify({ pin: newPinCoord });

      const res = await fetch(`/api/acervo/revisions/${revision.id}/rfi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newRfiTitle,
          description: newRfiDesc,
          markupType: "PIN",
          coordX: newPinCoord.x,
          coordY: newPinCoord.y,
          geometryJson: geometryPayload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.rfi) {
        setRfis((prev) => [...prev, data.rfi]);
        setNewPinCoord(null);
        setNewRfiTitle("");
        setNewRfiDesc("");
        setFieldPhoto(null);
      } else {
        alert(data.error || "Erro ao registrar RFI.");
      }
    } catch {
      alert("Falha de conexão com o servidor.");
    } finally {
      setIsSavingRfi(false);
    }
  }

  async function handleAnswerRfi(rfiId: string) {
    if (!answerInput.trim()) return;
    try {
      const res = await fetch(`/api/acervo/revisions/${revision.id}/rfi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfiId,
          answer: answerInput,
          status: "RESPONDIDA",
        }),
      });
      const data = await res.json();
      if (res.ok && data.rfi) {
        setRfis((prev) => prev.map((item) => (item.id === rfiId ? data.rfi : item)));
        setSelectedRfi(data.rfi);
        setAnswerInput("");
      }
    } catch {
      alert("Erro ao responder RFI.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white animate-in fade-in duration-200">
      {/* Header do Visualizador CDE */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
            {revision.documentCode}
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-white line-clamp-1 max-w-sm sm:max-w-md">
            {revision.documentTitle}
          </h2>
          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800">
            {revision.revisionNumber}
          </Badge>
          <span className="hidden sm:inline text-xs text-slate-400">· {revision.discipline}</span>
        </div>

        {/* Controles de Zoom e Ferramentas */}
        <div className="flex items-center gap-2">
          {/* Seletor de Revisões Rápidas */}
          {revision.allRevisions && revision.allRevisions.length > 1 && (
            <select
              value={revision.id}
              onChange={(e) => onSwitchRevision && onSwitchRevision(e.target.value)}
              className="h-8 rounded-lg border border-slate-700 bg-slate-800 px-2 text-xs font-mono text-white focus:outline-none"
            >
              {revision.allRevisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.revisionNumber} ({r.status})
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="px-2 py-1 hover:bg-slate-700 rounded transition"
              title="Diminuir Zoom"
            >
              -
            </button>
            <span className="px-2 text-[11px] font-mono">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="px-2 py-1 hover:bg-slate-700 rounded transition"
              title="Aumentar Zoom"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 hover:bg-slate-700 rounded text-[10px] text-slate-400 transition"
              title="Ajustar à Tela"
            >
              100%
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => setIsPlacingPin(!isPlacingPin)}
            className={`${
              isPlacingPin ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
            } text-white`}
          >
            {isPlacingPin ? "Clique na Prancha" : "+ Nova RFI (Pino)"}
          </Button>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Fechar visualizador"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Área Central: Canvas de Visualização + Painel Lateral de RFIs */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas de Visualização */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-auto bg-slate-900/60 p-4"
          style={{ cursor: isPlacingPin ? "crosshair" : "default" }}
        >
          <div
            ref={containerRef}
            onClick={handleCanvasClick}
            className="relative transition-transform duration-100 ease-out origin-center"
            style={{
              transform: `scale(${zoom})`,
              minWidth: "600px",
              minHeight: "420px",
            }}
          >
            {/* Visualizador Inteligente Híbrido */}
            {isImageOrPdf ? (
              <div className="relative rounded-lg shadow-2xl bg-white overflow-hidden border border-slate-800">
                <iframe
                  src={`${displayUrl}#toolbar=0`}
                  title={revision.fileName}
                  className="w-[850px] h-[600px] border-0 select-none pointer-events-none"
                />

                {/* Camada de Sobreposição de Pinos de RFI */}
                <div className="absolute inset-0 pointer-events-auto">
                  {rfis.map((rfi) => {
                    if (rfi.coordX == null || rfi.coordY == null) return null;
                    const isSelected = selectedRfi?.id === rfi.id;
                    return (
                      <button
                        key={rfi.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRfi(rfi);
                        }}
                        style={{
                          left: `${rfi.coordX}%`,
                          top: `${rfi.coordY}%`,
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono font-bold shadow-lg transition-transform ${
                          isSelected
                            ? "bg-rose-500 text-white scale-125 ring-4 ring-rose-300/40 z-20"
                            : rfi.status === "ENCERRADA"
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-600 text-white hover:scale-110"
                        }`}
                        title={`${rfi.code}: ${rfi.title}`}
                      >
                        {rfi.code.replace("RFI-", "")}
                      </button>
                    );
                  })}

                  {/* Prévia do Novo Pino antes de salvar */}
                  {newPinCoord && (
                    <div
                      style={{
                        left: `${newPinCoord.x}%`,
                        top: `${newPinCoord.y}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-xs animate-bounce ring-4 ring-rose-400/50 shadow-xl"
                    >
                      ?
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Caso de Modelo BIM IFC ou CAD nativo sem conversão */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 p-12 text-center text-slate-300">
                <span className="text-4xl mb-3">📐</span>
                <p className="text-base font-semibold text-white">Visualizador CAD / BIM 3D Ativo</p>
                <p className="mt-1 text-xs text-slate-400 max-w-sm">
                  Arquivo: <span className="font-mono text-slate-200">{revision.fileName}</span> ({revision.fileType}).
                </p>
                <div className="mt-4 flex gap-2">
                  <a
                    href={revision.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-xs font-semibold text-slate-950 shadow hover:bg-slate-100 transition"
                  >
                    Baixar Arquivo Fonte Técnico
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel Lateral Apple-Minimalista de RFIs & Markups */}
        <aside className="w-80 sm:w-96 flex flex-col border-l border-slate-800 bg-slate-900 text-slate-200">
          <div className="flex border-b border-slate-800 bg-slate-900/90 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("RFIS")}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                activeTab === "RFIS" ? "border-white text-white" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              RFIs ({rfis.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("QUANTITATIVOS");
                if (takeoffs.length === 0 && !isExtracting) {
                  handleExtractQuantities();
                }
              }}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                activeTab === "QUANTITATIVOS"
                  ? "border-white text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Quantitativos (BIM/IA)
            </button>
            <button
              onClick={() => setActiveTab("LAYERS")}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                activeTab === "LAYERS" ? "border-white text-white" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Info
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Modal Embutido para Cadastro de Nova RFI */}
            {newPinCoord && (
              <form onSubmit={handleCreateRfi} className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400">Novo Pino RFI demarcado</span>
                  <button
                    type="button"
                    onClick={() => setNewPinCoord(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Título da RFI *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Verificar cota do pé-direito..."
                    value={newRfiTitle}
                    onChange={(e) => setNewRfiTitle(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Descrição / Justificativa</label>
                  <textarea
                    rows={2}
                    placeholder="Detalhes para o projetista..."
                    value={newRfiDesc}
                    onChange={(e) => setNewRfiDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Foto de Canteiro / Não Conformidade (Opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer transition">
                      <span>📷 Tirar Foto / Anexar</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    {fieldPhoto && (
                      <div className="relative group">
                        <img
                          src={fieldPhoto}
                          alt="Foto do canteiro"
                          className="h-9 w-9 rounded-lg object-cover border border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => setFieldPhoto(null)}
                          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white"
                          title="Remover foto"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewPinCoord(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSavingRfi}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {isSavingRfi ? "Salvando..." : "Salvar RFI"}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === "RFIS" && (
              <div className="space-y-3">
                {rfis.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-400">
                    Nenhuma RFI ou dúvida marcada nesta revisão. Clique em "+ Nova RFI (Pino)" para apontar um item na prancha.
                  </p>
                ) : (
                  rfis.map((rfi) => {
                    const isSelected = selectedRfi?.id === rfi.id;
                    return (
                      <div
                        key={rfi.id}
                        onClick={() => setSelectedRfi(rfi)}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-950/40 ring-1 ring-blue-500"
                            : "border-slate-800 bg-slate-800/40 hover:bg-slate-800/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-blue-400">{rfi.code}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {rfi.status}
                          </span>
                        </div>
                        <h4 className="mt-1 text-xs font-semibold text-white">{rfi.title}</h4>
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{rfi.description}</p>

                        {/* Detalhes expandidos ao selecionar */}
                        {isSelected && (
                          <div className="mt-3 border-t border-slate-700/80 pt-2 space-y-2">
                            {rfi.geometryJson && (() => {
                              try {
                                const parsed = JSON.parse(rfi.geometryJson);
                                if (parsed.photoUrl) {
                                  return (
                                    <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900/80">
                                      <p className="text-[10px] uppercase font-semibold text-slate-400 px-2 py-1">
                                        Foto do Canteiro
                                      </p>
                                      <img
                                        src={parsed.photoUrl}
                                        alt="Evidência de canteiro"
                                        className="w-full max-h-44 object-cover cursor-pointer hover:opacity-95"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(parsed.photoUrl, "_blank");
                                        }}
                                      />
                                    </div>
                                  );
                                }
                              } catch {}
                              return null;
                            })()}

                            {rfi.answer ? (
                              <div className="rounded-lg bg-emerald-950/50 border border-emerald-800/60 p-2 text-xs">
                                <span className="font-semibold text-emerald-300">Resposta:</span>
                                <p className="mt-0.5 text-emerald-100">{rfi.answer}</p>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  placeholder="Digitar resposta técnica..."
                                  value={answerInput}
                                  onChange={(e) => setAnswerInput(e.target.value)}
                                  className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAnswerRfi(rfi.id)}
                                  className="w-full rounded-lg bg-emerald-600 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                                >
                                  Responder RFI
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "QUANTITATIVOS" && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">Quantitativos Extraídos</p>
                    <p className="text-[10px] text-slate-400">
                      Motor: {extractSource || "Aguardando leitura"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExtractQuantities}
                      disabled={isExtracting}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition"
                    >
                      {isExtracting ? "Lendo..." : "Reanalisar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      disabled={takeoffs.length === 0}
                      className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-40 transition"
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                {isExtracting ? (
                  <div className="space-y-2.5 pt-2">
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/80" />
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/80" />
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/80" />
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/80" />
                  </div>
                ) : takeoffs.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-6 text-center text-slate-400">
                    Clique em &quot;Reanalisar&quot; para extrair áreas, esquadrias e pontos desta revisão.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="px-2.5 py-2">Item</th>
                          <th className="px-2.5 py-2 text-right">Qtd</th>
                          <th className="px-2.5 py-2 text-right">Un</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {takeoffs.map((item, idx) => (
                          <tr key={`${item.category}-${idx}`} className="hover:bg-slate-800/40">
                            <td className="px-2.5 py-2">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                {item.category}
                              </span>
                              <span className="text-slate-200">{item.description}</span>
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono font-semibold text-white">
                              {item.quantity}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono text-slate-400">
                              {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "LAYERS" && (
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3 space-y-2">
                  <p className="font-semibold text-slate-200">Ficha Técnica do Documento</p>
                  <p className="text-slate-400">Código: <span className="font-mono text-white">{revision.documentCode}</span></p>
                  <p className="text-slate-400">Revisão Vigente: <span className="font-mono text-emerald-400">{revision.revisionNumber}</span></p>
                  <p className="text-slate-400">Disciplina: <span className="text-white">{revision.discipline}</span></p>
                  <p className="text-slate-400">Status: <span className="text-white">{revision.status}</span></p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
