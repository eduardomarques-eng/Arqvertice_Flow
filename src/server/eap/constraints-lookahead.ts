import { prisma } from "@/server/db";

export const CONSTRAINT_CATEGORIES = [
  "COMPRAS_SUPRIMENTOS",
  "PROJETO_DEFINICAO",
  "MAO_DE_OBRA",
  "EQUIPAMENTOS",
  "LICENCAS_APROVACOES",
  "LOGISTICA_CANTEIRO",
] as const;

export const CONSTRAINT_STATUSES = [
  "IDENTIFICADA",
  "EM_COTACAO_ANALISE",
  "PEDIDO_EMITIDO",
  "LIBERADA",
  "BLOQUEADA",
] as const;

export const CONSTRAINT_PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;

export type ConstraintCategory = (typeof CONSTRAINT_CATEGORIES)[number];
export type ConstraintStatus = (typeof CONSTRAINT_STATUSES)[number];
export type ConstraintPriority = (typeof CONSTRAINT_PRIORITIES)[number];
export type ConstraintRiskLevel = "CRITICA" | "ATENCAO" | "NO_PRAZO" | "LIBERADA";

export interface ConstraintRecordLike {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  floorId: string | null;
  floorName: string | null;
  packageNumber: number | null;
  teamCode: string | null;
  neededByDate: Date | string;
  leadTimeDays: number;
  orderDeadlineDate: Date | string | null;
  estimatedCost: number | null;
}

export interface LobPackageBlockSummary {
  count: number;
  criticalCount: number;
  titles: string[];
}

export interface ConstraintRiskEvaluation {
  riskById: Record<string, ConstraintRiskLevel>;
  lobBlockMap: Record<string, LobPackageBlockSummary>;
  metrics: {
    total: number;
    criticalCount: number;
    attentionCount: number;
    next15DaysCount: number;
    releasedCount: number;
    blockedCount: number;
    totalEstimatedCost: number;
  };
}

function toIsoDate(val: Date | string): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function addCalendarDaysIso(iso: string, deltaDays: number): string {
  const dt = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function computeOrderDeadlineDate(neededByDate: Date, leadTimeDays: number): Date {
  const dt = new Date(neededByDate.getTime());
  dt.setUTCDate(dt.getUTCDate() - Math.max(0, Math.round(leadTimeDays)));
  return dt;
}

export function evaluateConstraintRisks(
  constraints: ConstraintRecordLike[],
  referenceDateIso?: string
): ConstraintRiskEvaluation {
  const todayIso = referenceDateIso ?? new Date().toISOString().slice(0, 10);
  const sevenDaysIso = addCalendarDaysIso(todayIso, 7);
  const fifteenDaysIso = addCalendarDaysIso(todayIso, 15);

  const riskById: Record<string, ConstraintRiskLevel> = {};
  const lobBlockMap: Record<string, LobPackageBlockSummary> = {};

  let criticalCount = 0;
  let attentionCount = 0;
  let next15DaysCount = 0;
  let releasedCount = 0;
  let blockedCount = 0;
  let totalEstimatedCost = 0;

  for (const c of constraints) {
    const neededIso = toIsoDate(c.neededByDate);
    const orderIso = c.orderDeadlineDate ? toIsoDate(c.orderDeadlineDate) : null;
    totalEstimatedCost += Math.max(0, Number(c.estimatedCost) || 0);

    let risk: ConstraintRiskLevel = "NO_PRAZO";

    if (c.status === "LIBERADA") {
      risk = "LIBERADA";
      releasedCount += 1;
    } else {
      if (c.status === "BLOQUEADA") blockedCount += 1;

      if (
        neededIso <= todayIso ||
        (orderIso !== null && orderIso < todayIso && c.status === "IDENTIFICADA")
      ) {
        risk = "CRITICA";
        criticalCount += 1;
      } else if (
        neededIso <= sevenDaysIso ||
        (orderIso !== null && orderIso <= sevenDaysIso)
      ) {
        risk = "ATENCAO";
        attentionCount += 1;
      }

      if (neededIso <= fifteenDaysIso) {
        next15DaysCount += 1;
      }

      if (c.floorId && c.packageNumber) {
        const key = `${c.floorId}::${c.packageNumber}`;
        const existing = lobBlockMap[key] ?? { count: 0, criticalCount: 0, titles: [] };
        existing.count += 1;
        if (risk === "CRITICA" || c.status === "BLOQUEADA") {
          existing.criticalCount += 1;
        }
        existing.titles.push(c.title);
        lobBlockMap[key] = existing;
      }
    }

    riskById[c.id] = risk;
  }

  return {
    riskById,
    lobBlockMap,
    metrics: {
      total: constraints.length,
      criticalCount,
      attentionCount,
      next15DaysCount,
      releasedCount,
      blockedCount,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
    },
  };
}

function inferLeadTimeAndCategory(stageCodes: string[], pkgName: string): {
  category: ConstraintCategory;
  leadTimeDays: number;
  suggestionPrefix: string;
} {
  const lower = pkgName.toLowerCase();
  if (stageCodes.some((c) => ["01", "02"].includes(c))) {
    return {
      category: "EQUIPAMENTOS",
      leadTimeDays: 10,
      suggestionPrefix: "Locação / Liberação de equipamentos e canteiro",
    };
  }
  if (stageCodes.some((c) => ["03", "04"].includes(c)) || lower.includes("concreto") || lower.includes("estrutura")) {
    return {
      category: "COMPRAS_SUPRIMENTOS",
      leadTimeDays: 12,
      suggestionPrefix: "Compra de Aço, Fôrma e Programação de Concreto",
    };
  }
  if (stageCodes.some((c) => ["08", "09", "10"].includes(c))) {
    return {
      category: "COMPRAS_SUPRIMENTOS",
      leadTimeDays: 15,
      suggestionPrefix: "Compra de Tubulações, Cabos e Kits de Instalação",
    };
  }
  if (stageCodes.some((c) => Number(c) >= 14)) {
    return {
      category: "PROJETO_DEFINICAO",
      leadTimeDays: 20,
      suggestionPrefix: "Definição & Compra de Acabamentos / Esquadrias",
    };
  }
  return {
    category: "COMPRAS_SUPRIMENTOS",
    leadTimeDays: 10,
    suggestionPrefix: "Suprimentos e Liberação de Frente",
  };
}

/**
 * Varre as alocações da Matriz LOB nos próximos 45 dias e gera sugestões idempotentes
 * de restrições/suprimentos cruzadas com os itens e custos da Planilha EAP.
 */
export async function generateSuggestedConstraintsFromLob(
  projectId: string,
  options?: { windowDays?: number; referenceDateIso?: string }
): Promise<{
  createdCount: number;
  skippedExistingCount: number;
  windowStartIso: string;
  windowEndIso: string;
} | null> {
  const windowDays = Math.max(7, Math.min(90, options?.windowDays ?? 45));

  return prisma.$transaction(async (tx) => {
    const eap = await tx.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) return null;

    await tx.$executeRaw`SELECT 1 FROM "EapProject" WHERE "id" = ${eap.id}::uuid FOR UPDATE`;

    const [allocations, servicePackages, stages, existingConstraints] = await Promise.all([
      tx.eapLobFloorAllocation.findMany({
        where: { eapProjectId: eap.id },
        orderBy: [{ dateIso: "asc" }, { floorOrder: "asc" }],
      }),
      tx.eapServicePackage.findMany({
        where: { eapProjectId: eap.id },
      }),
      tx.eapStage.findMany({
        where: { eapProjectId: eap.id },
        include: {
          groups: {
            include: { items: true },
          },
        },
      }),
      tx.eapConstraint.findMany({
        where: { eapProjectId: eap.id },
        select: { floorId: true, packageNumber: true },
      }),
    ]);

    const todayIso = options?.referenceDateIso ?? new Date().toISOString().slice(0, 10);
    let windowStartIso = todayIso;
    let windowEndIso = addCalendarDaysIso(todayIso, windowDays);

    // Se todas as alocações forem futuras (obra ainda não iniciada), usa os primeiros 45 dias do cronograma
    const hasInTodayWindow = allocations.some(
      (a) => a.dateIso >= windowStartIso && a.dateIso <= windowEndIso
    );
    if (!hasInTodayWindow && allocations.length > 0) {
      windowStartIso = allocations[0].dateIso;
      windowEndIso = addCalendarDaysIso(windowStartIso, windowDays);
    }

    const pkgMap = new Map(servicePackages.map((p) => [p.packageNumber, p]));
    const stageMaterialCostMap = new Map<string, number>();
    for (const st of stages) {
      let matCost = 0;
      for (const grp of st.groups) {
        for (const item of grp.items) {
          const zq = (item.zoneQuantitiesJson ?? {}) as Record<string, number>;
          const qty = Object.values(zq).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
          matCost += qty * (Number(item.materialUnitCost) || 0);
        }
      }
      stageMaterialCostMap.set(st.code, Math.round(matCost * 100) / 100);
    }

    const existingKeys = new Set(
      existingConstraints
        .filter((c) => c.floorId && c.packageNumber)
        .map((c) => `${c.floorId}::${c.packageNumber}`)
    );

    // Agrupa menor dateIso por (floorId, packageNumber) na janela Lookahead
    const earliestByFloorPkg = new Map<
      string,
      { floorId: string; floorName: string; packageNumber: number; teamCode: string; dateIso: string }
    >();

    for (const alloc of allocations) {
      if (alloc.dateIso < windowStartIso || alloc.dateIso > windowEndIso) continue;
      const key = `${alloc.floorId}::${alloc.packageNumber}`;
      const prev = earliestByFloorPkg.get(key);
      if (!prev || alloc.dateIso < prev.dateIso) {
        earliestByFloorPkg.set(key, {
          floorId: alloc.floorId,
          floorName: alloc.floorName,
          packageNumber: alloc.packageNumber,
          teamCode: alloc.teamCode,
          dateIso: alloc.dateIso,
        });
      }
    }

    const toCreate: Array<{
      eapProjectId: string;
      title: string;
      description: string;
      category: string;
      status: string;
      priority: string;
      floorId: string;
      floorName: string;
      packageNumber: number;
      teamCode: string;
      neededByDate: Date;
      leadTimeDays: number;
      orderDeadlineDate: Date;
      estimatedCost: number | null;
    }> = [];

    let skippedExistingCount = 0;

    for (const [key, entry] of earliestByFloorPkg.entries()) {
      if (existingKeys.has(key)) {
        skippedExistingCount += 1;
        continue;
      }

      const pkg = pkgMap.get(entry.packageNumber);
      const pkgName = pkg?.name ?? `Pacote #${entry.packageNumber}`;
      const stageCodes = pkg?.linkedEapStageCodes ?? [];
      const meta = inferLeadTimeAndCategory(stageCodes, pkgName);
      const neededByDate = new Date(`${entry.dateIso}T00:00:00.000Z`);
      const orderDeadlineDate = computeOrderDeadlineDate(neededByDate, meta.leadTimeDays);

      const estimatedCostRaw = stageCodes.reduce(
        (sum, sc) => sum + (stageMaterialCostMap.get(sc) ?? 0),
        0
      );
      const estimatedCost =
        estimatedCostRaw > 0 ? Math.round((estimatedCostRaw / 3) * 100) / 100 : null;

      toCreate.push({
        eapProjectId: eap.id,
        title: `${meta.suggestionPrefix} — ${pkgName}`,
        description: `Gerado automaticamente pelo Lookahead 45d para início do pacote ${entry.teamCode}${entry.packageNumber} em ${entry.floorName}.`,
        category: meta.category,
        status: "IDENTIFICADA",
        priority: entry.dateIso <= addCalendarDaysIso(todayIso, 10) ? "ALTA" : "MEDIA",
        floorId: entry.floorId,
        floorName: entry.floorName,
        packageNumber: entry.packageNumber,
        teamCode: entry.teamCode,
        neededByDate,
        leadTimeDays: meta.leadTimeDays,
        orderDeadlineDate,
        estimatedCost,
      });
    }

    if (toCreate.length > 0) {
      await tx.eapConstraint.createMany({ data: toCreate });
    }

    return {
      createdCount: toCreate.length,
      skippedExistingCount,
      windowStartIso,
      windowEndIso,
    };
  });
}
