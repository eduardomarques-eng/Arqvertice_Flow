"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateBR } from "@/lib/formatters";

export interface AcervoProjectOption {
  id: string;
  name: string;
  clientName?: string;
}

export interface AcervoDeliverableItem {
  id: string;
  projectId: string;
  projectName: string;
  clientName?: string;
  sheetCode: string;
  title: string;
  discipline: string;
  phaseFolder?: string | null;
  version?: string | null;
  fileUrl: string;
  fileSize?: string | null;
  status?: string | null;
  isClientView?: boolean;
  createdAt: string | Date;
}

interface CentralAcervoViewProps {
  projects: AcervoProjectOption[];
  deliverables: AcervoDeliverableItem[];
  basePath: "/admin" | "/equipe";
  initialProjectId?: string;
}

const DISCIPLINES = [
  { key: "ALL", label: "Todas as Disciplinas" },
  { key: "ARQUITETURA", label: "Arquitetura / Interiores" },
  { key: "ESTRUTURAL", label: "Engenharia Estrutural" },
  { key: "ELETRICO", label: "Instalações Elétricas" },
  { key: "HIDROSSANITARIO", label: "Hidrossanitário" },
  { key: "COMBATE_INCENDIO", label: "Combate a Incêndio (PPCI)" },
  { key: "COMPATIBILIZACAO", label: "Compatibilização / BIM" },
  { key: "LEGAL", label: "Projeto Legal / Aprovação" },
  { key: "EXECUTIVO", label: "Detalhamento Executivo" },
];

const PHASES = [
  { key: "ALL", label: "Todas as Fases" },
  { key: "ESTUDO_PRELIMINAR", label: "Estudo Preliminar" },
  { key: "ANTEPROJETO", label: "Anteprojeto" },
  { key: "PROJETO_LEGAL", label: "Projeto Legal" },
  { key: "PROJETO_EXECUTIVO", label: "Projeto Executivo" },
  { key: "AS_BUILT", label: "As-Built" },
];

export function CentralAcervoView({
  projects,
  deliverables,
  basePath,
  initialProjectId,
}: CentralAcervoViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || "ALL");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("ALL");
  const [selectedPhase, setSelectedPhase] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((item) => {
      if (selectedProjectId !== "ALL" && item.projectId !== selectedProjectId) return false;
      if (selectedDiscipline !== "ALL" && item.discipline !== selectedDiscipline) return false;
      if (selectedPhase !== "ALL" && item.phaseFolder !== selectedPhase) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = item.sheetCode?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesProject = item.projectName?.toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesProject) return false;
      }
      return true;
    });
  }, [deliverables, selectedProjectId, selectedDiscipline, selectedPhase, searchQuery]);

  const metrics = useMemo(() => {
    const total = filteredDeliverables.length;
    const clientApproved = filteredDeliverables.filter((d) => d.isClientView).length;
    const architectural = filteredDeliverables.filter((d) => d.discipline === "ARQUITETURA").length;
    const engineering = total - architectural;
    return { total, clientApproved, architectural, engineering };
  }, [filteredDeliverables]);

  return (
    <div className="space-y-6">
      {/* Header com métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="p-4 border-slate-200/80 bg-white shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total de Pranchas</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{metrics.total}</p>
          <p className="mt-0.5 text-xs text-slate-500">Documentos catalogados</p>
        </Card>
        <Card className="p-4 border-slate-200/80 bg-white shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Arquitetura & 3D</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{metrics.architectural}</p>
          <p className="mt-0.5 text-xs text-slate-500">Desenhos de concepção</p>
        </Card>
        <Card className="p-4 border-slate-200/80 bg-white shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Engenharias & Compl.</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{metrics.engineering}</p>
          <p className="mt-0.5 text-xs text-slate-500">Estrutura, elétrico, hidro</p>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Liberadas p/ Cliente</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{metrics.clientApproved}</p>
          <p className="mt-0.5 text-xs text-emerald-700 font-medium">Visíveis no Portal</p>
        </Card>
      </div>

      {/* Barra de Filtros Multifacetada */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por código (ex: ARQ-01), título ou projeto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {selectedProjectId !== "ALL" && (
              <Link
                href={`${basePath}/projetos/${selectedProjectId}`}
                className="inline-flex min-h-[34px] items-center rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
              >
                + Fazer Upload no Projeto →
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Empreendimento / Projeto
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">Todos os Empreendimentos ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.clientName ? `(${p.clientName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Disciplina Técnica
            </label>
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {DISCIPLINES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Fase / Etapa
            </label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {PHASES.map((ph) => (
                <option key={ph.key} value={ph.key}>
                  {ph.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Pranchas e Documentos */}
      {filteredDeliverables.length === 0 ? (
        <Card className="p-12 text-center border-slate-200/80 bg-white">
          <p className="text-3xl mb-2">📁</p>
          <p className="text-sm font-bold text-slate-800">Nenhum documento encontrado no Acervo</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery || selectedProjectId !== "ALL" || selectedDiscipline !== "ALL"
              ? "Tente ajustar os filtros ou limpar a pesquisa para visualizar outros documentos técnicos."
              : "Faça upload de pranchas na Ficha Técnica de um projeto para catalogá-las no acervo central."}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 pl-4 pr-2">Código</th>
                  <th className="py-3 px-2">Empreendimento</th>
                  <th className="py-3 px-2">Título do Documento</th>
                  <th className="py-3 px-2">Disciplina</th>
                  <th className="py-3 px-2">Fase / Pasta</th>
                  <th className="py-3 px-2 text-center">Revisão</th>
                  <th className="py-3 px-2 text-center">Portal Cliente</th>
                  <th className="py-3 pr-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeliverables.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 pl-4 pr-2 font-mono font-bold text-blue-600">
                        {item.sheetCode || "DOC"}
                      </td>
                      <td className="py-3 px-2 font-bold text-slate-900">
                        <Link
                          href={`${basePath}/projetos/${item.projectId}`}
                          className="hover:underline"
                        >
                          {item.projectName}
                        </Link>
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800">
                        {item.title}
                        {item.fileSize && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {item.fileSize}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge tone="neutral" className="text-[10px] font-bold">
                          {item.discipline}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-slate-600 font-medium">
                        {item.phaseFolder ? item.phaseFolder.replace(/_/g, " ") : "Geral"}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-700">
                        {item.version || "R00"}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge tone={item.isClientView ? "green" : "neutral"}>
                          {item.isClientView ? "✓ Liberado" : "Interno"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.fileUrl && (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[30px] items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:scale-95 transition"
                            >
                              Baixar / Abrir ↗
                            </a>
                          )}
                          <Link
                            href={`${basePath}/projetos/${item.projectId}`}
                            className="inline-flex min-h-[30px] items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-200 active:scale-95 transition"
                          >
                            Ver Ficha →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
