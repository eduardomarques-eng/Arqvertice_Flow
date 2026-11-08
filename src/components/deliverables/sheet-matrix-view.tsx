"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  APPROVAL_STATUS_LABELS,
  DISCIPLINE_LABELS,
} from "@/lib/sheet-metadata-parser";
import type { DeliverableMatrix } from "@/server/services/deliverable-service";
import type { ProjectDiscipline } from "@prisma/client";

interface SheetMatrixViewProps {
  matrix: DeliverableMatrix;
  projectId: string;
  isClientView?: boolean;
}

export function SheetMatrixView({ matrix, projectId, isClientView = false }: SheetMatrixViewProps) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("ALL");

  if (!matrix || matrix.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <p className="text-xs font-semibold text-slate-600">Nenhuma prancha técnica cadastrada no momento.</p>
        <p className="mt-1 text-[11px] text-slate-400">
          As pranchas e plantas executivas aparecerão aqui assim que forem adicionadas ao projeto.
        </p>
      </div>
    );
  }

  const filteredDisciplines = selectedDiscipline === "ALL"
    ? matrix.byDiscipline
    : matrix.byDiscipline.filter((d) => d.discipline === selectedDiscipline);

  return (
    <div className="space-y-6">
      {/* KPI Cards da Matriz */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Conformidade de Pranchas</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{matrix.complianceRate}%</span>
            <span className="text-xs text-slate-400 font-medium">entregues / liberadas</span>
          </div>
          <div className="mt-3">
            <Progress value={matrix.complianceRate} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total de Pranchas</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{matrix.total}</span>
            <span className="text-xs text-slate-400 font-medium">pranchas no projeto</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {matrix.byDiscipline.length} disciplina(s) ativas
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Pranchas Entregues</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{matrix.delivered}</span>
            <span className="text-xs text-emerald-600 font-medium">homologadas / liberadas</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-700">
            Aprovadas pelo cliente ou liberadas para obra
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Em Desenvolvimento</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-700">{matrix.pending + matrix.inReview}</span>
            <span className="text-xs text-amber-600 font-medium">pendentes / revisão</span>
          </div>
          <p className="mt-2 text-[11px] text-amber-700">
            {matrix.inReview} em revisão técnica · {matrix.pending} em elaboração
          </p>
        </div>
      </div>

      {/* Filtros por Disciplina */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setSelectedDiscipline("ALL")}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            selectedDiscipline === "ALL"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Todas as Disciplinas ({matrix.total})
        </button>
        {matrix.byDiscipline.map((d) => (
          <button
            key={d.discipline}
            type="button"
            onClick={() => setSelectedDiscipline(d.discipline)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              selectedDiscipline === d.discipline
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>{d.label}</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {d.delivered}/{d.total}
            </span>
          </button>
        ))}
      </div>

      {/* Matriz por Disciplina */}
      <div className="space-y-4">
        {filteredDisciplines.map((d) => (
          <div
            key={d.discipline}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{d.label}</h4>
                  <Badge tone={d.complianceRate === 100 ? "green" : d.complianceRate > 0 ? "blue" : "neutral"}>
                    {d.complianceRate}% entregue
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {d.delivered} de {d.total} pranchas entregues · {d.pending} pendente(s)
                </p>
              </div>
              <div className="w-full sm:w-48">
                <Progress value={d.complianceRate} />
              </div>
            </div>

            {/* Lista das Pranchas da Disciplina */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-2 pl-2">Código</th>
                    <th className="py-2 px-2">Assunto da Prancha</th>
                    <th className="py-2 px-2">Versão</th>
                    <th className="py-2 px-2">Etapa do Cronograma</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pr-2 text-right">Arquivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {d.sheets.map((sheet) => {
                    const statusMeta = APPROVAL_STATUS_LABELS[sheet.status] || { label: sheet.status, tone: "neutral" };
                    return (
                      <tr key={sheet.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 pl-2 font-mono font-bold text-blue-700">
                          {sheet.sheetCode || "—"}
                        </td>
                        <td className="py-2.5 px-2">
                          <p className="font-semibold text-slate-900">{sheet.subject}</p>
                          {sheet.isRequired ? (
                            <span className="text-[10px] text-slate-400">Obrigatória para obra</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-2 font-mono font-semibold text-slate-700">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                            {sheet.version}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">
                          {sheet.stageName || "Geral"}
                        </td>
                        <td className="py-2.5 px-2">
                          <Badge tone={statusMeta.tone}>
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <a
                            href={`/api/projects/${projectId}/deliverables/${sheet.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Ver Prancha
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

