import { prisma } from "@/server/db";
import { round2 } from "@/server/eap/calculator";
import { buildFieldMeasurementSnapshot } from "@/server/eap/field-measurement";
import { evaluateConstraintRisks } from "@/server/eap/constraints-lookahead";
import { analyzeFloorMatrixConflicts, DEFAULT_LOB_FLOORS, type LobFloorDefinition } from "@/lib/eap-lob-grid";

export type WorkHealthStatus = "SAUDAVEL" | "ATENCAO" | "CRITICO";

export interface ComparativeFinancialMetrics {
  budgetedEapTotal: number;
  plannedLobCumulative: number;
  measuredFieldCumulative: number;
  billedInstallmentsTotal: number;
  receivedInstallmentsTotal: number;
  cashBalanceBilledMinusMeasured: number;
  physicalProgressPct: number;
  plannedLobPct: number;
  physicalDeviationPct: number;
  spi: number;
  cpi: number;
  eacCostProjection: number;
}

export interface ShortTermTeamUtilization {
  teamCode: string;
  name: string;
  workingDays: number;
  headcount: number;
  dailyCost?: number;
  totalEstimatedCost?: number;
  occupancyPercent: number;
}

export interface ShortTermWindowSummary {
  windowDays: number;
  upcomingPackagesCount: number;
  criticalConstraintsCount: number;
  attentionConstraintsCount: number;
  recentBulletinsCount: number;
  teamUtilization: ShortTermTeamUtilization[];
}

export interface ExecutiveBottleneckItem {
  axis: "PRAZO" | "EQUIPES" | "SUPRIMENTOS" | "FINANCEIRO";
  severity: "ALTA" | "MEDIA" | "BAIXA";
  title: string;
  impact: string;
  targetRef: string;
  action: string;
}

export interface ExecutiveAiSummary {
  healthStatus: WorkHealthStatus;
  source: "AI" | "DETERMINISTIC";
  generatedAt: string;
  headline: string;
  executiveOverview: string;
  topBottlenecks: ExecutiveBottleneckItem[];
  actionPlan: string[];
}

export interface ComparativeProjectAnalytics {
  referenceDate: string;
  financial: ComparativeFinancialMetrics;
  shortTerm: ShortTermWindowSummary;
  monthlyComparative: Array<{
    monthKey: string;
    label: string;
    plannedCumulative: number;
    measuredCumulative: number;
    billedCumulative: number;
  }>;
  floorComparison: Array<{
    floorId: string;
    floorName: string;
    plannedAmount: number;
    measuredAmount: number;
    progressPct: number;
  }>;
  activeVersions: Array<{
    discipline: string;
    fileName: string;
    versionCode: string;
  }>;
  bulletinsSummary: Array<{
    bulletinCode: string;
    referenceDate: string;
    status: string;
    physicalProgressPct: number;
    totalMeasuredValue: number;
  }>;
  aiSummary: ExecutiveAiSummary;
}

export function computeComparativeFinancials(input: {
  budgetedEapTotal: number;
  plannedLobPct: number;
  physicalProgressPct: number;
  measuredFieldCumulative: number;
  billedInstallmentsTotal: number;
  receivedInstallmentsTotal: number;
}): ComparativeFinancialMetrics {
  const budgeted = Math.max(0, round2(input.budgetedEapTotal));
  const plannedPct = Math.max(0, Math.min(100, round2(input.plannedLobPct)));
  const physicalPct = Math.max(0, Math.min(100, round2(input.physicalProgressPct)));
  const measured = Math.max(0, round2(input.measuredFieldCumulative));
  const billed = Math.max(0, round2(input.billedInstallmentsTotal));
  const received = Math.max(0, round2(input.receivedInstallmentsTotal));

  const plannedLobCumulative = round2(budgeted * (plannedPct / 100));
  const earnedValue = round2(budgeted * (physicalPct / 100));
  const physicalDeviationPct = round2(physicalPct - plannedPct);
  const cashBalanceBilledMinusMeasured = round2(billed - measured);

  const spi =
    plannedPct > 0
      ? round2(physicalPct / plannedPct)
      : physicalPct > 0
        ? 1
        : 1;
  const cpi =
    measured > 0 && earnedValue > 0
      ? round2(earnedValue / measured)
      : 1;
  const eacCostProjection = cpi > 0 ? round2(budgeted / cpi) : budgeted;

  return {
    budgetedEapTotal: budgeted,
    plannedLobCumulative,
    measuredFieldCumulative: measured,
    billedInstallmentsTotal: billed,
    receivedInstallmentsTotal: received,
    cashBalanceBilledMinusMeasured,
    physicalProgressPct: physicalPct,
    plannedLobPct: plannedPct,
    physicalDeviationPct,
    spi,
    cpi,
    eacCostProjection,
  };
}

export function buildDeterministicDeviationsSummary(input: {
  financial: ComparativeFinancialMetrics;
  shortTerm: ShortTermWindowSummary;
  floorComparison: Array<{ floorName: string; progressPct: number; plannedAmount: number }>;
  criticalConstraintTitles: string[];
  teamOverloadMessages: string[];
}): ExecutiveAiSummary {
  const { financial, shortTerm } = input;
  const bottlenecks: ExecutiveBottleneckItem[] = [];
  const actionPlan: string[] = [];

  if (financial.physicalDeviationPct <= -5 || financial.spi < 0.9) {
    bottlenecks.push({
      axis: "PRAZO",
      severity: financial.physicalDeviationPct <= -10 ? "ALTA" : "MEDIA",
      title: `Desvio fisico de ${financial.physicalDeviationPct.toFixed(1)} p.p. em relacao ao previsto LOB`,
      impact: `SPI atual em ${financial.spi.toFixed(2)} (${financial.physicalProgressPct.toFixed(1)}% realizado x ${financial.plannedLobPct.toFixed(1)}% previsto).`,
      targetRef: "Matriz LOB & Medicao no Canteiro",
      action: "Reforcar frentes criticas e nivelar sequencia de pacotes atrasados na Matriz LOB.",
    });
    actionPlan.push(
      `Recuperar ${Math.abs(financial.physicalDeviationPct).toFixed(1)} p.p. priorizando pacotes criticos na Matriz LOB.`
    );
  }

  if (shortTerm.criticalConstraintsCount > 0) {
    bottlenecks.push({
      axis: "SUPRIMENTOS",
      severity: "ALTA",
      title: `${shortTerm.criticalConstraintsCount} restricao(oes) critica(s)/vencida(s) no Lookahead`,
      impact:
        input.criticalConstraintTitles.slice(0, 2).join(" · ") ||
        "Risco iminente de parada de equipe por falta de suprimento ou liberacao.",
      targetRef: "Kanban de Restricoes & Suprimentos",
      action: "Emitir pedido imediato ou liberar frente bloqueada antes do inicio do pacote.",
    });
    actionPlan.push(
      `Desbloquear imediatamente ${shortTerm.criticalConstraintsCount} restricao(oes) vencida(s) no Kanban.`
    );
  }

  if (input.teamOverloadMessages.length > 0) {
    bottlenecks.push({
      axis: "EQUIPES",
      severity: "ALTA",
      title: `Conflito de capacidade / frentes simultaneas (${input.teamOverloadMessages.length})`,
      impact: input.teamOverloadMessages[0],
      targetRef: "Equipes A/B/C & Nivelamento LOB",
      action: "Executar Nivelamento Automatico na Matriz LOB ou ampliar limite de frentes da equipe.",
    });
    actionPlan.push("Executar nivelamento de equipes A/B/C para eliminar sobreposicao de frentes.");
  }

  if (financial.cashBalanceBilledMinusMeasured < 0) {
    bottlenecks.push({
      axis: "FINANCEIRO",
      severity: "MEDIA",
      title: "Descasamento de caixa: medido em campo acima do faturado",
      impact: `Saldo de caixa negativo em R$ ${Math.abs(financial.cashBalanceBilledMinusMeasured).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      targetRef: "Boletins de Medicao x Parcelas",
      action: "Emitir faturamento de medicao para recompor capital de giro da obra.",
    });
    actionPlan.push("Faturar boletim de medicao aprovado para equilibrar fluxo de caixa.");
  }

  const laggingFloor = [...input.floorComparison]
    .filter((f) => f.plannedAmount > 0 && f.progressPct < 50)
    .sort((a, b) => a.progressPct - b.progressPct)[0];
  if (laggingFloor && bottlenecks.length < 4) {
    bottlenecks.push({
      axis: "PRAZO",
      severity: "BAIXA",
      title: `Pavimento "${laggingFloor.floorName}" com avanco em ${laggingFloor.progressPct.toFixed(1)}%`,
      impact: "Concentracao de saldo pendente pode pressionar equipes de acabamento na reta final.",
      targetRef: laggingFloor.floorName,
      action: `Acompanhar checklist de servicos pendentes em ${laggingFloor.floorName}.`,
    });
  }

  if (actionPlan.length === 0) {
    actionPlan.push(
      "Manter ritmo semanal de apontamento no canteiro e atualizar Lookahead 45d a cada sexta-feira."
    );
  }

  let healthStatus: WorkHealthStatus = "SAUDAVEL";
  if (
    shortTerm.criticalConstraintsCount > 0 ||
    financial.physicalDeviationPct <= -10 ||
    financial.spi < 0.85 ||
    input.teamOverloadMessages.length > 0
  ) {
    healthStatus = "CRITICO";
  } else if (
    shortTerm.attentionConstraintsCount > 0 ||
    financial.physicalDeviationPct < -2 ||
    financial.cashBalanceBilledMinusMeasured < 0
  ) {
    healthStatus = "ATENCAO";
  }

  const headline =
    healthStatus === "SAUDAVEL"
      ? "Obra em ritmo saudavel e aderente ao previsto na Matriz LOB."
      : healthStatus === "ATENCAO"
        ? "Pontos de atencao no curto prazo exigem acompanhamento preventivo."
        : "Alerta critico de desvios ou restricoes impactando o cronograma.";

  const executiveOverview =
    `Avanco fisico global em ${financial.physicalProgressPct.toFixed(1)}% contra ${financial.plannedLobPct.toFixed(1)}% previstos (SPI ${financial.spi.toFixed(2)} | CPI ${financial.cpi.toFixed(2)}). ` +
    `Janela de curto prazo (${shortTerm.windowDays} dias) contabiliza ${shortTerm.upcomingPackagesCount} alocacao(oes) na Matriz LOB, ` +
    `${shortTerm.criticalConstraintsCount} restricao(oes) critica(s) e ${shortTerm.attentionConstraintsCount} em atencao.`;

  return {
    healthStatus,
    source: "DETERMINISTIC",
    generatedAt: new Date().toISOString(),
    headline,
    executiveOverview,
    topBottlenecks: bottlenecks,
    actionPlan,
  };
}

export async function generateDeviationsAndBottlenecksSummary(
  input: Parameters<typeof buildDeterministicDeviationsSummary>[0],
  options?: { allowExternalLlm?: boolean }
): Promise<ExecutiveAiSummary> {
  const baseline = buildDeterministicDeviationsSummary(input);
  if (!options?.allowExternalLlm) return baseline;

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiKey) return baseline;

  try {
    // Somente metricas tecnicas agregadas — nunca enviar nome de cliente, CPF, RG ou endereco
    const anonymizedContext = {
      healthStatus: baseline.healthStatus,
      spi: input.financial.spi,
      cpi: input.financial.cpi,
      physicalProgressPct: input.financial.physicalProgressPct,
      plannedLobPct: input.financial.plannedLobPct,
      physicalDeviationPct: input.financial.physicalDeviationPct,
      cashBalance: input.financial.cashBalanceBilledMinusMeasured,
      criticalConstraintsCount: input.shortTerm.criticalConstraintsCount,
      attentionConstraintsCount: input.shortTerm.attentionConstraintsCount,
      upcomingPackagesCount: input.shortTerm.upcomingPackagesCount,
      bottlenecks: baseline.topBottlenecks.map((b) => ({
        axis: b.axis,
        severity: b.severity,
        title: b.title,
      })),
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Voce e um engenheiro de planejamento do ArqVertice OS. Responda em JSON com { "headline": string, "executiveOverview": string, "actionPlan": string[] } em portugues objetivo.',
          },
          {
            role: "user",
            content: `Analise estas metricas tecnicas anonimizadas da obra: ${JSON.stringify(anonymizedContext)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return baseline;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return baseline;

    const parsed = JSON.parse(rawContent) as {
      headline?: unknown;
      executiveOverview?: unknown;
      actionPlan?: unknown;
    };

    return {
      ...baseline,
      source: "AI",
      generatedAt: new Date().toISOString(),
      headline:
        typeof parsed.headline === "string" && parsed.headline.trim()
          ? parsed.headline.trim()
          : baseline.headline,
      executiveOverview:
        typeof parsed.executiveOverview === "string" && parsed.executiveOverview.trim()
          ? parsed.executiveOverview.trim()
          : baseline.executiveOverview,
      actionPlan:
        Array.isArray(parsed.actionPlan) &&
        parsed.actionPlan.every((x) => typeof x === "string") &&
        parsed.actionPlan.length > 0
          ? (parsed.actionPlan as string[]).slice(0, 5)
          : baseline.actionPlan,
    };
  } catch {
    return baseline;
  }
}

export async function buildComparativeProjectAnalytics(
  projectId: string,
  options?: { allowExternalLlm?: boolean }
): Promise<ComparativeProjectAnalytics | null> {
  const [eap, fieldSnapshot, installments] = await Promise.all([
    prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: { include: { holidays: true } },
        sourceFiles: {
          where: { isActive: true },
          orderBy: { discipline: "asc" },
          select: { discipline: true, fileName: true, versionCode: true },
        },
        constraints: { orderBy: { neededByDate: "asc" } },
        servicePackages: { orderBy: { packageNumber: "asc" } },
        workTeams: {
          orderBy: { teamCode: "asc" },
          include: { workers: true },
        },
        lobFloorAllocations: { orderBy: [{ dateIso: "asc" }, { floorOrder: "asc" }] },
      },
    }),
    buildFieldMeasurementSnapshot(projectId),
    prisma.projectInstallment.findMany({
      where: { projectId },
      orderBy: { dueDate: "asc" },
      select: { amount: true, status: true, dueDate: true, paidDate: true },
    }),
  ]);

  if (!eap || !fieldSnapshot) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const windowEndDt = new Date(`${todayIso}T00:00:00.000Z`);
  windowEndDt.setUTCDate(windowEndDt.getUTCDate() + 30);
  const windowEndIso = windowEndDt.toISOString().slice(0, 10);

  const floors: LobFloorDefinition[] =
    Array.isArray(eap.lobFloorsJson) && eap.lobFloorsJson.length > 0
      ? (eap.lobFloorsJson as unknown as LobFloorDefinition[])
      : DEFAULT_LOB_FLOORS;
  const holidaySet = new Set(eap.city.holidays.map((h) => h.date.toISOString().slice(0, 10)));

  const matrixEval = analyzeFloorMatrixConflicts({
    allocations: eap.lobFloorAllocations,
    floors,
    servicePackages: eap.servicePackages,
    workTeams: eap.workTeams,
    stageLoads: [],
    holidaySet,
  });

  const constraintEval = evaluateConstraintRisks(eap.constraints, todayIso);
  const criticalConstraintTitles = eap.constraints
    .filter((c) => constraintEval.riskById[c.id] === "CRITICA")
    .map((c) => c.title);

  const billedInstallmentsTotal = round2(
    installments.reduce((s, inst) => s + Math.max(0, inst.amount || 0), 0)
  );
  const receivedInstallmentsTotal = round2(
    installments
      .filter((i) => i.status === "PAID")
      .reduce((s, inst) => s + Math.max(0, inst.amount || 0), 0)
  );

  const financial = computeComparativeFinancials({
    budgetedEapTotal: fieldSnapshot.summary.totalPlannedValue,
    plannedLobPct: fieldSnapshot.summary.plannedLobPct,
    physicalProgressPct: fieldSnapshot.summary.physicalProgressPct,
    measuredFieldCumulative: fieldSnapshot.summary.totalAccumulatedValue,
    billedInstallmentsTotal,
    receivedInstallmentsTotal,
  });

  const upcomingPackagesCount = eap.lobFloorAllocations.filter(
    (a) => a.dateIso >= todayIso && a.dateIso <= windowEndIso
  ).length;

  const shortTerm: ShortTermWindowSummary = {
    windowDays: 30,
    upcomingPackagesCount,
    criticalConstraintsCount: constraintEval.metrics.criticalCount,
    attentionConstraintsCount: constraintEval.metrics.attentionCount,
    recentBulletinsCount: fieldSnapshot.bulletins.length,
    teamUtilization: matrixEval.teamSummaries,
  };

  // Serie mensal comparativa: Previsto LOB x Medido Canteiro x Faturado
  const monthKeys = new Set<string>();
  for (const a of eap.lobFloorAllocations) monthKeys.add(a.dateIso.slice(0, 7));
  for (const b of fieldSnapshot.bulletins) monthKeys.add(b.referenceDate.slice(0, 7));
  for (const inst of installments) monthKeys.add(inst.dueDate.toISOString().slice(0, 7));
  if (monthKeys.size === 0) monthKeys.add(todayIso.slice(0, 7));

  const sortedMonths = Array.from(monthKeys).sort();
  const totalLobAllocs = Math.max(1, eap.lobFloorAllocations.length);

  const monthlyComparative = sortedMonths.map((ym) => {
    const allocsUpToMonth = eap.lobFloorAllocations.filter(
      (a) => a.dateIso.slice(0, 7) <= ym
    ).length;
    const plannedCumulative =
      eap.lobFloorAllocations.length > 0
        ? round2(financial.budgetedEapTotal * (allocsUpToMonth / totalLobAllocs))
        : financial.plannedLobCumulative;

    const measuredCumulative = round2(
      fieldSnapshot.bulletins
        .filter((b) => b.referenceDate.slice(0, 7) <= ym)
        .reduce((s, b) => s + b.totalMeasuredValue, 0)
    );

    const billedCumulative = round2(
      installments
        .filter((i) => i.dueDate.toISOString().slice(0, 7) <= ym)
        .reduce((s, i) => s + Math.max(0, i.amount || 0), 0)
    );

    const [y, m] = ym.split("-");
    return {
      monthKey: ym,
      label: `${m}/${y.slice(-2)}`,
      plannedCumulative,
      measuredCumulative,
      billedCumulative,
    };
  });

  const floorComparison = fieldSnapshot.floorSummaries.map((f) => ({
    floorId: f.floorId,
    floorName: f.floorName,
    plannedAmount: f.plannedAmount,
    measuredAmount: f.accumulatedAmount,
    progressPct: f.progressPct,
  }));

  const teamOverloadMessages = matrixEval.conflicts
    .filter((c) => c.type === "TEAM_OVERLOAD")
    .map((c) => c.message);

  const aiSummary = await generateDeviationsAndBottlenecksSummary(
    {
      financial,
      shortTerm,
      floorComparison,
      criticalConstraintTitles,
      teamOverloadMessages,
    },
    options
  );

  return {
    referenceDate: todayIso,
    financial,
    shortTerm,
    monthlyComparative,
    floorComparison,
    activeVersions: eap.sourceFiles.map((sf) => ({
      discipline: sf.discipline,
      fileName: sf.fileName,
      versionCode: sf.versionCode,
    })),
    bulletinsSummary: fieldSnapshot.bulletins.map((b) => ({
      bulletinCode: b.bulletinCode,
      referenceDate: b.referenceDate,
      status: b.status,
      physicalProgressPct: b.physicalProgressPct,
      totalMeasuredValue: b.totalMeasuredValue,
    })),
    aiSummary,
  };
}
