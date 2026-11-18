"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import {
  BentoBarComparisonChart,
  BentoDonutDistribution,
  BentoHorizontalRanking,
  BentoKpiStrip,
} from "@/components/analytics";
import { formatDateBR } from "@/lib/formatters";
import type { DisciplineChartPoint } from "@/components/acervo/acervo-discipline-chart";

const AcervoDisciplineChart = dynamic(
  () =>
    import("@/components/acervo/acervo-discipline-chart").then(
      (mod) => mod.AcervoDisciplineChart
    ),
  {
    ssr: false,
    loading: () => <div className="h-56 w-full animate-pulse rounded-xl bg-slate-200/50" />,
  }
);

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
  kpis?: {
    openRfis: number;
    overdueRfis: number;
    slaFormatted: string;
  };
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
  kpis,
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
    const emRevisao = filteredDocs.filter(
      (d) => d.status === "EM_REVISAO_TECNICA" || d.status === "EM_ANALISE"
    ).length;
    const taxaBomParaObra = total > 0 ? Math.round((bomParaObra / total) * 100) : 0;
    return {
      total,
      bomParaObra,
      taxaBomParaObra,
      emRevisao,
      openRfis: kpis?.openRfis ?? 0,
      overdueRfis: kpis?.overdueRfis ?? 0,
      slaFormatted: kpis?.slaFormatted ?? "12 horas",
    };
  }, [filteredDocs, kpis]);

  const chartData = useMemo<DisciplineChartPoint[]>(() => {
    const buckets: Record<string, { discipline: string; bomParaObra: number; emAndamento: number }> = {
      ARQUITETURA: { discipline: "Arquitetura", bomParaObra: 0, emAndamento: 0 },
      ESTRUTURAL: { discipline: "Estrutura", bomParaObra: 0, emAndamento: 0 },
      INSTALACOES: { discipline: "Instalações", bomParaObra: 0, emAndamento: 0 },
      FACHADAS: { discipline: "Fachadas", bomParaObra: 0, emAndamento: 0 },
    };

    for (const d of filteredDocs) {
      let key = "ARQUITETURA";
      if (d.discipline === "ESTRUTURAL") key = "ESTRUTURAL";
      else if (d.discipline === "ELETRICO" || d.discipline === "HIDROSSANITARIO") key = "INSTALACOES";
      else if (d.discipline === "FACHADAS" || d.discipline === "COMPATIBILIZACAO") key = "FACHADAS";

      if (d.status === "BOM_PARA_OBRA") {
        buckets[key].bomParaObra += 1;
      } else if (d.status !== "OBSOLETO") {
        buckets[key].emAndamento += 1;
      }
    }

    return Object.values(buckets);
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
      {/* Barra de Ação Rápida de Plugins & Configurações CAD/BIM (3D segregado no módulo 3D Viewer) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white dark:border-white/10 dark:bg-[#18181B] p-3.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-lg bg-[#EDE5D8]/70 dark:bg-white/10 px-3 text-xs font-semibold text-[#18181B] dark:text-[#EDE5D8]">
            📁 Controle Documental CDE · Revisões R00/R01 & GRD
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${basePath}/acervo/plugins`}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#09090B] px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition"
          >
            <span>🧩</span>
            <span>Central de Plugins (Revit · AutoCAD · TQS · 3ds Max)</span>
          </Link>
          {basePath === "/admin" && (
            <Link
              href="/admin/acervo/configuracoes"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#09090B] px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition"
            >
              <span>🔌</span>
              <span>Integrações CAD/BIM (Tokens API)</span>
            </Link>
          )}
        </div>
      </div>

      {/* 5 KPIs Executivos CDE em Bento Grid */}
      <BentoKpiStrip
        columns={5}
        items={[
          {
            id: "total-sheets",
            label: "Pranchas Vigentes",
            value: String(metrics.total),
            featured: true,
            subtitle: `${filteredDocs.reduce((s, d) => s + d.revisionsCount, 0)} revisões`,
          },
          {
            id: "bom-obra",
            label: 'Taxa "Bom para Obra"',
            value: `${metrics.taxaBomParaObra}%`,
            delta: `${metrics.bomParaObra}/${metrics.total}`,
            deltaTone: metrics.taxaBomParaObra >= 60 ? "positive" : "neutral",
          },
          {
            id: "rfis",
            label: "RFIs Abertas",
            value: String(metrics.openRfis),
            delta: `${metrics.overdueRfis} atraso`,
            deltaTone: metrics.overdueRfis > 0 ? "negative" : "positive",
          },
          {
            id: "revisions",
            label: "Pranchas em Análise",
            value: String(metrics.emRevisao),
            subtitle: "Aguardando parecer técnico",
          },
          {
            id: "sla",
            label: "SLA Médio Aprovação",
            value: metrics.slaFormatted,
            subtitle: "Tempo médio até liberação",
          },
        ]}
      />

      {/* Bento Grid CDE: Volume por Disciplina + Status de Aprovação + Ritmo de Revisões */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BentoHorizontalRanking
          title="Volume de Pranchas por Disciplina"
          subtitle="Distribuição técnica do acervo"
          items={chartData.map((d, i) => ({
            id: `${d.discipline}-${i}`,
            label: d.discipline,
            secondaryText: `${d.bomParaObra} liberada(s)`,
            value: d.bomParaObra + d.emAnalise,
            formattedValue: String(d.bomParaObra + d.emAnalise),
            highlight: i === 0,
          }))}
        />

        <BentoDonutDistribution
          title="Status de Aprovação CDE"
          subtitle="Ciclo de vida das pranchas"
          centerLabel="Pranchas"
          centerValue={String(metrics.total)}
          slices={[
            { id: "bom", label: "Bom para Obra", value: metrics.bomParaObra, formattedValue: String(metrics.bomParaObra) },
            { id: "rev", label: "Em Revisão", value: metrics.emRevisao, formattedValue: String(metrics.emRevisao) },
            {
              id: "elab",
              label: "Em Elaboração",
              value: Math.max(0, metrics.total - metrics.bomParaObra - metrics.emRevisao),
              formattedValue: String(Math.max(0, metrics.total - metrics.bomParaObra - metrics.emRevisao)),
            },
          ]}
        />

        <BentoBarComparisonChart
          title="Ritmo de Emissão & Liberações"
          subtitle="Pranchas liberadas × em análise por disciplina"
          primaryLabel="Bom para Obra"
          secondaryLabel="Em Análise"
          heightClass="h-48 sm:h-56"
          data={chartData.slice(0, 5).map((d) => ({
            label: d.discipline.slice(0, 6),
            primaryValue: d.bomParaObra,
            secondaryValue: d.emAnalise,
          }))}
        />
      </div>

      {/* Gráfico Detalhado por Disciplina (Recharts) */}
      <Card className="p-5 border-slate-200/60 dark:border-white/10 dark:bg-[#18181B] bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Comparativo Executivo por Disciplina
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Comparativo entre pranchas liberadas (Bom para Obra) e em revisão/elaboração.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#18181B] dark:bg-[#EDE5D8]" />
              Bom para Obra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#EDE5D8] dark:bg-amber-500" />
              Em Análise / Elaboração
            </span>
          </div>
        </div>
        <div className="w-full min-w-0 overflow-hidden">
          <AcervoDisciplineChart data={chartData} />
        </div>
      </Card>

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

      {/* Dual-View CDE: Tabela Desktop (>= 1024px) + Cards Empilhados Mobile (< 1024px) */}
      <ResponsiveDataView
        items={filteredDocs}
        emptyState={
          <div className="rounded-2xl border border-slate-200/60 bg-white dark:border-white/10 dark:bg-zinc-900 py-12 text-center text-xs text-slate-400">
            Nenhum documento encontrado no Acervo Manager.
          </div>
        }
        renderDesktopTable={() => (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/60 dark:border-white/10 bg-slate-50/80 dark:bg-zinc-950/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredDocs.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <tr
                    key={doc.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors ${isSelected ? "bg-slate-50/90 dark:bg-white/10" : ""
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
                    <td className="py-3 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {doc.code}
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-700 dark:text-slate-300">
                      {doc.projectName}
                    </td>
                    <td className="py-3 px-2 text-slate-900 dark:text-slate-100">
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{doc.fileName}</div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="inline-block rounded-lg bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                        {doc.discipline}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {doc.currentRevisionNumber}
                    </td>
                    <td className="py-3 px-2 text-center">{getStatusBadge(doc.status)}</td>
                    <td className="py-3 pr-4 text-right space-x-2 whitespace-nowrap">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-800 px-2.5 text-[11px] font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50 transition"
                      >
                        Baixar
                      </a>
                      <Link
                        href={`${basePath}/acervo/${doc.projectId}`}
                        className="inline-flex min-h-[36px] items-center rounded-lg bg-[#18181B] dark:bg-[#EDE5D8] dark:text-[#18181B] px-2.5 text-[11px] font-medium text-white shadow-sm hover:opacity-90 transition"
                      >
                        Ver Histórico
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        renderMobileCard={(doc) => {
          const isSelected = selectedDocIds.includes(doc.id);
          return (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectDoc(doc.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {doc.code}
                    </span>
                    <span className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                      {doc.currentRevisionNumber}
                    </span>
                    {getStatusBadge(doc.status)}
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {doc.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {doc.projectName} · {doc.discipline}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-white/10 pt-3">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  Baixar Arquivo
                </a>
                <Link
                  href={`${basePath}/acervo/${doc.projectId}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] dark:text-[#18181B] px-3 text-xs font-semibold text-white"
                >
                  Ver Histórico
                </Link>
              </div>
            </div>
          );
        }}
      />

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
