"use client";

import React from "react";
import {
  BentoBarComparisonChart,
  BentoHorizontalRanking,
  BentoKpiStrip,
  type BentoKpiItem,
} from "./index";

export interface ProjectDetailBentoMiniProps {
  completionPct: number;
  daysRemaining: number | null;
  completedCount: number;
  pendingCount: number;
  phaseBreakdown: Array<{ phase: string; progressPct: number; countLabel: string }>;
  weeklyPace: Array<{ label: string; planned: number; done: number }>;
}

export function ProjectDetailBentoMini({
  completionPct,
  daysRemaining,
  completedCount,
  pendingCount,
  phaseBreakdown,
  weeklyPace,
}: ProjectDetailBentoMiniProps) {
  const kpis: BentoKpiItem[] = [
    {
      id: "pct",
      label: "Concluído",
      value: `${completionPct}%`,
      featured: true,
    },
    {
      id: "days",
      label: "Dias Restantes",
      value: daysRemaining === null ? "—" : daysRemaining >= 0 ? `${daysRemaining}d` : `${Math.abs(daysRemaining)}d atraso`,
      deltaTone: daysRemaining !== null && daysRemaining < 0 ? "negative" : "neutral",
    },
    {
      id: "done-vs-pending",
      label: "Entregues × Pendentes",
      value: `${completedCount} / ${pendingCount}`,
      subtitle: "Etapas do cronograma",
    },
  ];

  return (
    <section className="space-y-4 mb-6">
      <BentoKpiStrip items={kpis} columns={3} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BentoHorizontalRanking
          title="Avanço por Fase de Projeto"
          subtitle="Estudo Preliminar, Anteprojeto, Executivo, Compatibilização e Obra"
          maxScale={100}
          items={phaseBreakdown.map((ph, idx) => ({
            id: ph.phase,
            label: ph.phase,
            secondaryText: ph.countLabel,
            value: ph.progressPct,
            formattedValue: `${ph.progressPct}%`,
            highlight: idx === 0,
          }))}
        />

        <BentoBarComparisonChart
          title="Ritmo Semanal de Conclusão"
          subtitle="Etapas previstas × concluídas por semana"
          primaryLabel="Previstas"
          secondaryLabel="Concluídas"
          heightClass="h-44 sm:h-52"
          data={weeklyPace.map((w) => ({
            label: w.label,
            primaryValue: w.planned,
            secondaryValue: w.done,
          }))}
        />
      </div>
    </section>
  );
}
