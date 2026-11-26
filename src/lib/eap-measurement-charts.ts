/**
 * Cálculos puros (client + server) dos gráficos executivos da Medição em Obra.
 */

export interface MeasurementFloorChartPoint {
  floorId: string;
  floorName: string;
  plannedPct: number;
  realizedPct: number;
}

export interface MeasurementFinancialSlice {
  key: "PREVIOUS" | "CURRENT" | "PENDING";
  label: string;
  value: number;
  percent: number;
  colorHex: string;
}

export interface MeasurementStatusPoint {
  key: "CONCLUIDO" | "EM_ANDAMENTO" | "PENDENTE" | "IMPEDIDO";
  label: string;
  count: number;
  colorHex: string;
}

export interface FieldMeasurementChartData {
  floorComparison: MeasurementFloorChartPoint[];
  financialComposition: {
    previousAccumulated: number;
    currentPeriod: number;
    pendingRemaining: number;
    totalPlanned: number;
    slices: MeasurementFinancialSlice[];
  };
  serviceStatusDistribution: MeasurementStatusPoint[];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function buildFieldMeasurementChartData(input: {
  summary: {
    totalPlannedValue: number;
    totalAccumulatedValue: number;
    totalMeasuredValue: number;
    totalPendingValue: number;
    plannedLobPct: number;
  };
  floorSummaries: Array<{
    floorId: string;
    floorName: string;
    progressPct: number;
  }>;
  items: Array<{ status: string }>;
  plannedLobPctByFloor?: Record<string, number>;
}): FieldMeasurementChartData {
  const floorComparison = input.floorSummaries.map((f) => ({
    floorId: f.floorId,
    floorName: f.floorName,
    plannedPct: round2(
      input.plannedLobPctByFloor?.[f.floorId] ?? input.summary.plannedLobPct
    ),
    realizedPct: round2(f.progressPct),
  }));

  const currentPeriod = Math.max(0, round2(input.summary.totalMeasuredValue));
  const totalAccumulated = Math.max(0, round2(input.summary.totalAccumulatedValue));
  const previousAccumulated = Math.max(0, round2(totalAccumulated - currentPeriod));
  const pendingRemaining = Math.max(0, round2(input.summary.totalPendingValue));
  const totalPlanned = Math.max(
    round2(previousAccumulated + currentPeriod + pendingRemaining),
    round2(input.summary.totalPlannedValue)
  );
  const denom = Math.max(1, totalPlanned);

  const slices: MeasurementFinancialSlice[] = [
    {
      key: "PREVIOUS",
      label: "Acumulado Anterior",
      value: previousAccumulated,
      percent: round2((previousAccumulated / denom) * 100),
      colorHex: "#2563EB",
    },
    {
      key: "CURRENT",
      label: "Medido neste Boletim",
      value: currentPeriod,
      percent: round2((currentPeriod / denom) * 100),
      colorHex: "#059669",
    },
    {
      key: "PENDING",
      label: "Saldo a Executar",
      value: pendingRemaining,
      percent: round2((pendingRemaining / denom) * 100),
      colorHex: "#D97706",
    },
  ];

  const counts = {
    CONCLUIDO: 0,
    EM_ANDAMENTO: 0,
    PENDENTE: 0,
    IMPEDIDO: 0,
  };
  for (const it of input.items) {
    if (it.status === "CONCLUIDO") counts.CONCLUIDO += 1;
    else if (it.status === "EM_ANDAMENTO") counts.EM_ANDAMENTO += 1;
    else if (it.status === "IMPEDIDO") counts.IMPEDIDO += 1;
    else counts.PENDENTE += 1;
  }

  return {
    floorComparison,
    financialComposition: {
      previousAccumulated,
      currentPeriod,
      pendingRemaining,
      totalPlanned,
      slices,
    },
    serviceStatusDistribution: [
      { key: "CONCLUIDO", label: "Concluidos 100%", count: counts.CONCLUIDO, colorHex: "#059669" },
      { key: "EM_ANDAMENTO", label: "Em Andamento", count: counts.EM_ANDAMENTO, colorHex: "#2563EB" },
      { key: "PENDENTE", label: "Pendentes", count: counts.PENDENTE, colorHex: "#94A3B8" },
      { key: "IMPEDIDO", label: "Impedidos", count: counts.IMPEDIDO, colorHex: "#DC2626" },
    ],
  };
}
