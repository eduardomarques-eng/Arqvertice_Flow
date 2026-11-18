"use client";

import React from "react";
import {
  BentoDonutDistribution,
  BentoHorizontalRanking,
  BentoKpiStrip,
  BentoTrendLineChart,
  type BentoKpiItem,
} from "./index";

export interface ProjectsBentoProps {
  projectsOnTime: number;
  completedStages: number;
  criticalMilestones7d: number;
  avgDelayDays: number;
  sCurvePoints: Array<{ label: string; planned: number; executed: number }>;
  progressRanking: Array<{ id: string; name: string; clientName: string; progressPct: number }>;
  stageStatusSlices: Array<{ id: string; label: string; value: number }>;
}

export function ProjectsBentoDashboard({
  projectsOnTime,
  completedStages,
  criticalMilestones7d,
  avgDelayDays,
  sCurvePoints,
  progressRanking,
  stageStatusSlices,
}: ProjectsBentoProps) {
  const kpis: BentoKpiItem[] = [
    {
      id: "on-time",
      label: "Obras no Prazo",
      value: String(projectsOnTime),
      featured: true,
      deltaTone: "positive",
      delta: "Ativos",
    },
    {
      id: "done-stages",
      label: "Etapas Concluídas",
      value: String(completedStages),
      subtitle: "Marcos encerrados",
    },
    {
      id: "milestones",
      label: "Marcos Próximos 7d",
      value: String(criticalMilestones7d),
      delta: criticalMilestones7d > 0 ? "Atenção" : "Livre",
      deltaTone: criticalMilestones7d > 0 ? "negative" : "positive",
    },
    {
      id: "delay",
      label: "Atraso Médio",
      value: `${avgDelayDays}d`,
      subtitle: "Média nas etapas pendentes",
    },
  ];

  return (
    <section className="space-y-4 mb-6">
      <BentoKpiStrip items={kpis} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BentoTrendLineChart
          title="Curva S — Planejado × Executado"
          subtitle="Evolução acumulada do cronograma (%)"
          primaryLabel="Executado (%)"
          secondaryLabel="Planejado (%)"
          points={sCurvePoints.map((pt) => ({
            label: pt.label,
            primary: pt.executed,
            secondary: pt.planned,
            primaryFormatted: `${pt.executed}%`,
          }))}
        />

        <BentoHorizontalRanking
          title="Avanço Físico por Projeto"
          subtitle="Top empreendimentos ordenados"
          maxScale={100}
          items={progressRanking.slice(0, 5).map((p, i) => ({
            id: p.id,
            label: p.name,
            secondaryText: p.clientName,
            value: p.progressPct,
            formattedValue: `${p.progressPct}%`,
            highlight: i === 0,
          }))}
        />

        <BentoDonutDistribution
          title="Status das Etapas"
          subtitle="Distribuição operacional"
          centerLabel="Etapas"
          centerValue={String(
            stageStatusSlices.reduce((s, x) => s + x.value, 0)
          )}
          slices={stageStatusSlices.map((s) => ({
            id: s.id,
            label: s.label,
            value: s.value,
            formattedValue: String(s.value),
          }))}
        />
      </div>
    </section>
  );
}
