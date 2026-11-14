"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/formatters";

export interface AcervoProjectOption {
  id: string;
  name: string;
  clientName?: string;
}

export interface CdeDocumentItem {
  id: string;
  projectId: string;
  projectName: string;
  clientName?: string;
  code: string;
  title: string;
  discipline: string;
  phase: string;
  category: string;
  currentRevisionNumber: string;
  status: string; // EM_ELABORACAO | EM_REVISAO_TECNICA | APROVADO_COM_RESSALVAS | BOM_PARA_OBRA | OBSOLETO
  fileName: string;
  fileUrl: string;
  fileSize?: string | null;
  revisionsCount: number;
  updatedAt: string | Date;
}

interface AcervoManagerViewProps {
  projects: AcervoProjectOption[];
  documents: CdeDocumentItem[];
  basePath: "/admin" | "/equipe";
  initialProjectId?: string;
}

const DISCIPLINES = [
  { key: "ALL", label: "Todas as Disciplinas" },
  { key: "ARQUITETURA", label: "Arquitetura / Interiores" },
  { key: "ESTRUTURAL", label: "Engenharia Estrutural" },
  { key: "ELETRICO", label: "Instalações Elétricas" },
  { key: "HIDROSSANITARIO", label: "Hidrossanitário" },
  { key: "FACHADAS", label: "Fachadas & Pele de Vidro" },
  { key: "COMPATIBILIZACAO", label: "Compatibilização / BIM" },
  { key: "LEGAL", label: "Projeto Legal" },
  { key: "EXECUTIVO", label: "Detalhamento Executivo" },
];

const STATUS_FILTERS = [
  { key: "ALL", label: "Todos os Status" },
  { key: "BOM_PARA_OBRA", label: "Bom para Obra" },
  { key: "EM_REVISAO_TECNICA", label: "Em Revisão Técnica" },
  { key: "APROVADO_COM_RESSALVAS", label: "Aprovado c/ Ressalvas" },
  { key: "EM_ELABORACAO", label: "Em Elaboração" },
  { key: "OBSOLETO", label: "Obsoletos" },
];

export function AcervoManagerView({
  projects,
  documents,
  basePath,
  initialProjectId,
}: AcervoManagerViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || "ALL");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isGrdModalOpen, setIsGrdModalOpen] = useState(false);
  const [grdRecipient, setGrdRecipient] = useState("");
  const [grdOrg, setGrdOrg] = useState("");
  const [grdSuccessCode, setGrdSuccessCode] = useState<string | null>(null);
  const [isSubmittingGrd, setIsSubmittingGrd] = useState(false);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedProjectId !== "ALL" && doc.projectId !== selectedProjectId) return false;
      if (selectedDiscipline !== "ALL" && doc.discipline !== selectedDiscipline) return false;
      if (selectedStatus !== "ALL" && doc.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = doc.code.toLowerCase().includes(q);
        const matchesTitle = doc.title.toLowerCase().includes(q);
        const matchesProject = doc.projectName.toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesProject) return false;
      }
      return true;
    });
  }, [documents, selectedProjectId, selectedDiscipline, selectedStatus, searchQuery]);

  const metrics = useMemo(() => {
    const total = filteredDocs.length;
    const bomParaObra = filteredDocs.filter((d) => d.status === "BOM_PARA_OBRA").length;
    const emRevisao = filteredDocs.filter((d) => d.status === "EM_REVISAO_TECNICA").length;
    const obsoletos = filteredDocs.filter((d) => d.status === "OBSOLETO").length;
    return { total, bomParaObra, emRevisao, obsoletos };
  }, [filteredDocs]);

  function toggleSelectDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (selectedDocIds.length === filteredDocs.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocs.map((d) => d.id));
    }
  }

  async function handleCreateGrd(e: React.FormEvent) {
    e.preventDefault();
    if (!grdRecipient.trim() || selectedDocIds.length === 0) return;

    setIsSubmittingGrd(true);
    try {
      const res = await fetch("/api/acervo/grd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId === "ALL" ? projects[0]?.id : selectedProjectId,
          recipientName: grdRecipient,
          recipientOrg: grdOrg,
          revisionIds: selectedDocIds,
        }),
      });
      const data = await res.json();
      if (res.ok && data.grd) {
        setGrdSuccessCode(data.grd.code);
        setSelectedDocIds([]);
      } else {
        alert(data.error || "Erro ao emitir GRD.");
      }
    } catch {
      alert("Falha de conexão ao emitir GRD.");
    } finally {
      setIsSubmittingGrd(false);
    }
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
      {/* Cards de Métricas CDE */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="p-4 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total de Pranchas</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">{metrics.total}</p>
          <p className="mt-1 text-[11px] text-slate-500">Documentos cadastrados</p>
        </Card>

        <Card className="p-4 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Bom para Obra</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-700">{metrics.bomParaObra}</p>
          <p className="mt-1 text-[11px] text-slate-500">Liberadas para execução</p>
        </Card>

        <Card className="p-4 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Em Revisão Técnica</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-amber-700">{metrics.emRevisao}</p>
          <p className="mt-1 text-[11px] text-slate-500">Em validação de engenharia</p>
        </Card>

        <Card className="p-4 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Revisões Obsoletas</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-700">{metrics.obsoletos}</p>
          <p className="mt-1 text-[11px] text-slate-500">Histórico bloqueado</p>
        </Card>
      </div>

      {/* Painel de Filtros e Ações */}
      <Card className="p-4 sm:p-5 border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="filter-project" className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Empreendimento
              </label>
              <select
                id="filter-project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:border-[#18181B] focus:outline-none"
              >
                <option value="ALL">Todos os Empreendimentos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-discipline" className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Disciplina
              </label>
              <select
                id="filter-discipline"
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:border-[#18181B] focus:outline-none"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-status" className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Status CDE
              </label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:border-[#18181B] focus:outline-none"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/acervo/master-list?format=csv${selectedProjectId !== "ALL" ? `&projectId=${selectedProjectId}` : ""}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200/60 bg-white px-4 text-xs font-medium text-slate-800 shadow-sm hover:bg-[#EDE5D8]/40 transition"
            >
              Exportar Lista Mestra (CSV)
            </a>

            {selectedDocIds.length > 0 && (
              <Button
                size="sm"
                onClick={() => setIsGrdModalOpen(true)}
                className="bg-[#18181B] text-white"
              >
                Emitir GRD ({selectedDocIds.length})
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <input
            type="text"
            placeholder="Pesquisar por código (ex: ARQ-PE-001), título ou empreendimento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3.5 text-xs text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#18181B] focus:outline-none transition"
          />
        </div>
      </Card>

      {/* Tabela CDE com Rolagem Touch */}
      <div className="max-w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/60 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.length === filteredDocs.length && filteredDocs.length > 0}
                    onChange={selectAll}
                    className="rounded border-slate-300 text-slate-900 focus:ring-0"
                  />
                </th>
                <th className="py-3 px-2">Código Prancha</th>
                <th className="py-3 px-2">Empreendimento</th>
                <th className="py-3 px-2">Título do Documento</th>
                <th className="py-3 px-2">Disciplina</th>
                <th className="py-3 px-2 text-center">Rev. Vigente</th>
                <th className="py-3 px-2 text-center">Status CDE</th>
                <th className="py-3 pr-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Nenhum documento encontrado no Acervo Manager.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? "bg-slate-50/90" : ""
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectDoc(doc.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-0"
                        />
                      </td>
                      <td className="py-3 px-2 font-mono font-semibold text-slate-900">
                        {doc.code}
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-700">
                        {doc.projectName}
                      </td>
                      <td className="py-3 px-2 text-slate-900">
                        <div className="font-medium">{doc.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{doc.fileName}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {doc.discipline}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-semibold text-slate-900">
                        {doc.currentRevisionNumber}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="py-3 pr-4 text-right space-x-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-lg border border-slate-200/60 bg-white px-2.5 text-[11px] font-medium text-slate-800 shadow-sm hover:bg-slate-50 transition"
                        >
                          Baixar
                        </a>
                        <Link
                          href={`${basePath}/acervo/${doc.projectId}`}
                          className="inline-flex h-8 items-center rounded-lg bg-[#18181B] px-2.5 text-[11px] font-medium text-white shadow-sm hover:bg-[#27272A] transition"
                        >
                          Ver Histórico
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Emissão de GRD */}
      {isGrdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              Emitir Guia de Remessa (GRD)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Gerar protocolo oficial com rastreio de {selectedDocIds.length} documento(s) selecionado(s).
            </p>

            {grdSuccessCode ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-emerald-800">Protocolo GRD Gerado!</p>
                  <p className="mt-1 font-mono text-xl font-bold text-emerald-950">{grdSuccessCode}</p>
                  <p className="mt-2 text-[11px] text-emerald-700">
                    O pacote foi registrado na trilha de auditoria do empreendimento.
                  </p>
                </div>
                <Button
                  className="w-full bg-[#18181B] text-white"
                  onClick={() => {
                    setIsGrdModalOpen(false);
                    setGrdSuccessCode(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateGrd} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Destinatário *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Eng. Mário Souza (Construtora Alpha)"
                    value={grdRecipient}
                    onChange={(e) => setGrdRecipient(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200/60 px-3 text-xs text-slate-900 shadow-sm focus:border-[#18181B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Empresa / Organização
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Construtora Alpha Ltda"
                    value={grdOrg}
                    onChange={(e) => setGrdOrg(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200/60 px-3 text-xs text-slate-900 shadow-sm focus:border-[#18181B] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsGrdModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingGrd}
                    className="bg-[#18181B] text-white"
                  >
                    {isSubmittingGrd ? "Gerando..." : "Confirmar Emissão"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
