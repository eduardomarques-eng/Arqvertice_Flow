import { prisma } from "@/server/db";
import { computeEapLine, round2 } from "@/server/eap/calculator";
import { normalizeZoneQuantities } from "@/server/eap/workbench";
import { DEFAULT_LOB_FLOORS, type LobFloorDefinition } from "@/lib/eap-lob-grid";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { DomainError } from "@/server/errors";

export const WEATHER_CONDITIONS = [
  "SOL",
  "NUBLADO",
  "CHUVA_PARCIAL",
  "CHUVA_INTENSA",
] as const;

export const BULLETIN_STATUSES = ["RASCUNHO", "APROVADO"] as const;

export const ENTRY_STATUSES = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "IMPEDIDO",
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];
export type BulletinStatus = (typeof BULLETIN_STATUSES)[number];
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export interface FieldMeasurementLineComputed {
  plannedQty: number;
  previousExecutedQty: number;
  currentExecutedQty: number;
  accumulatedQty: number;
  pendingQty: number;
  accumulatedPct: number;
  unitPrice: number;
  plannedAmount: number;
  measuredAmount: number;
  accumulatedAmount: number;
  pendingAmount: number;
  status: EntryStatus;
}

export interface FieldMeasurementServiceRow extends FieldMeasurementLineComputed {
  rowKey: string;
  floorId: string;
  floorName: string;
  floorOrder: number;
  packageNumber: number | null;
  teamCode: string | null;
  eapItemId: string | null;
  serviceLabel: string;
  unit: string;
  fieldNote: string | null;
}

export interface FieldMeasurementFloorSummary {
  floorId: string;
  floorName: string;
  floorOrder: number;
  itemsCount: number;
  completedCount: number;
  plannedAmount: number;
  accumulatedAmount: number;
  pendingAmount: number;
  progressPct: number;
}

export interface FieldMeasurementBulletinSummary {
  id: string;
  bulletinNumber: number;
  bulletinCode: string;
  referenceDate: string;
  status: string;
  inspectorName: string | null;
  weatherCondition: string | null;
  generalNotes: string | null;
  totalMeasuredValue: number;
  physicalProgressPct: number;
  entriesCount: number;
}

export interface FieldMeasurementSnapshot {
  projectId: string;
  eapProjectId: string;
  projectName: string;
  referenceDate: string;
  nextBulletinNumber: number;
  nextBulletinCode: string;
  floors: LobFloorDefinition[];
  summary: {
    totalPlannedValue: number;
    totalAccumulatedValue: number;
    totalMeasuredValue: number;
    totalPendingValue: number;
    physicalProgressPct: number;
    plannedLobPct: number;
    deviationPct: number;
    completedItemsCount: number;
    totalItemsCount: number;
  };
  floorSummaries: FieldMeasurementFloorSummary[];
  items: FieldMeasurementServiceRow[];
  bulletins: FieldMeasurementBulletinSummary[];
}

export function formatBulletinCode(num: number): string {
  return `BM-${String(Math.max(1, num)).padStart(2, "0")}`;
}

export function computeFieldMeasurementLine(input: {
  plannedQty: number;
  previousExecutedQty: number;
  currentExecutedQty: number;
  unitPrice: number;
  status?: string;
}): FieldMeasurementLineComputed {
  const plannedQty = Math.max(0, Number(input.plannedQty) || 0);
  const previousExecutedQty = Math.max(0, Number(input.previousExecutedQty) || 0);
  const currentExecutedQty = Math.max(0, Number(input.currentExecutedQty) || 0);
  const unitPrice = Math.max(0, Number(input.unitPrice) || 0);

  const accumulatedQty = round2(previousExecutedQty + currentExecutedQty);
  const pendingQty = round2(Math.max(0, plannedQty - accumulatedQty));
  const accumulatedPct =
    plannedQty > 0 ? Math.min(100, round2((accumulatedQty / plannedQty) * 100)) : 0;

  const plannedAmount = round2(plannedQty * unitPrice);
  const measuredAmount = round2(currentExecutedQty * unitPrice);
  const accumulatedAmount = round2(Math.min(plannedQty, accumulatedQty) * unitPrice);
  const pendingAmount = round2(pendingQty * unitPrice);

  let derivedStatus: EntryStatus;
  if (input.status === "IMPEDIDO") {
    derivedStatus = "IMPEDIDO";
  } else if (accumulatedPct >= 100 && plannedQty > 0) {
    derivedStatus = "CONCLUIDO";
  } else if (accumulatedQty > 0) {
    derivedStatus = "EM_ANDAMENTO";
  } else {
    derivedStatus = "PENDENTE";
  }

  return {
    plannedQty,
    previousExecutedQty,
    currentExecutedQty,
    accumulatedQty,
    pendingQty,
    accumulatedPct,
    unitPrice,
    plannedAmount,
    measuredAmount,
    accumulatedAmount,
    pendingAmount,
    status: derivedStatus,
  };
}

export function computeWeightedFieldProgress(
  rows: Array<{
    plannedAmount: number;
    accumulatedAmount: number;
    measuredAmount: number;
    pendingAmount: number;
  }>,
  plannedLobPct: number
): {
  totalPlannedValue: number;
  totalAccumulatedValue: number;
  totalMeasuredValue: number;
  totalPendingValue: number;
  physicalProgressPct: number;
  plannedLobPct: number;
  deviationPct: number;
} {
  let totalPlannedValue = 0;
  let totalAccumulatedValue = 0;
  let totalMeasuredValue = 0;
  let totalPendingValue = 0;

  for (const r of rows) {
    totalPlannedValue += Math.max(0, r.plannedAmount);
    totalAccumulatedValue += Math.max(0, r.accumulatedAmount);
    totalMeasuredValue += Math.max(0, r.measuredAmount);
    totalPendingValue += Math.max(0, r.pendingAmount);
  }

  totalPlannedValue = round2(totalPlannedValue);
  totalAccumulatedValue = round2(totalAccumulatedValue);
  totalMeasuredValue = round2(totalMeasuredValue);
  totalPendingValue = round2(totalPendingValue);

  const physicalProgressPct =
    totalPlannedValue > 0
      ? Math.min(100, round2((totalAccumulatedValue / totalPlannedValue) * 100))
      : 0;

  const clampedPlannedLobPct = Math.max(0, Math.min(100, round2(plannedLobPct)));
  const deviationPct = round2(physicalProgressPct - clampedPlannedLobPct);

  return {
    totalPlannedValue,
    totalAccumulatedValue,
    totalMeasuredValue,
    totalPendingValue,
    physicalProgressPct,
    plannedLobPct: clampedPlannedLobPct,
    deviationPct,
  };
}

export async function buildFieldMeasurementSnapshot(
  projectId: string,
  referenceDateIso?: string
): Promise<FieldMeasurementSnapshot | null> {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      project: { select: { name: true } },
      servicePackages: { orderBy: { packageNumber: "asc" } },
      lobFloorAllocations: { orderBy: [{ floorOrder: "asc" }, { dateIso: "asc" }] },
      stages: {
        orderBy: { orderIndex: "asc" },
        include: {
          groups: {
            orderBy: { orderIndex: "asc" },
            include: { items: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      fieldMeasurementBulletins: {
        orderBy: { bulletinNumber: "desc" },
        include: { entries: true },
      },
    },
  });

  if (!eap) return null;

  const refIso = (referenceDateIso ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const floors: LobFloorDefinition[] =
    Array.isArray(eap.lobFloorsJson) && eap.lobFloorsJson.length > 0
      ? (eap.lobFloorsJson as unknown as LobFloorDefinition[])
      : DEFAULT_LOB_FLOORS;
  const floorById = new Map(floors.map((f) => [f.floorId, f]));

  // Mapeia stageCode -> pacote/equipe padrão a partir dos ServicePackages e alocações LOB
  const stageToPkg = new Map<string, number>();
  for (const pkg of eap.servicePackages) {
    for (const sc of pkg.linkedEapStageCodes) {
      if (!stageToPkg.has(sc)) stageToPkg.set(sc, pkg.packageNumber);
    }
  }
  const floorPkgToTeam = new Map<string, string>();
  for (const alloc of eap.lobFloorAllocations) {
    const k = `${alloc.floorId}::${alloc.packageNumber}`;
    if (!floorPkgToTeam.has(k)) floorPkgToTeam.set(k, alloc.teamCode);
  }

  // Soma quantidades já aprovadas por (floorId, eapItemId) ou (floorId, serviceLabel)
  const approvedPrevByKey = new Map<string, number>();
  for (const b of eap.fieldMeasurementBulletins) {
    if (b.status !== "APROVADO") continue;
    for (const entry of b.entries) {
      const k = entry.eapItemId
        ? `${entry.floorId}::${entry.eapItemId}`
        : `${entry.floorId}::${entry.serviceLabel}`;
      approvedPrevByKey.set(k, round2((approvedPrevByKey.get(k) ?? 0) + entry.currentExecutedQty));
    }
  }

  // Pré-carrega apontamentos do rascunho mais recente (se existir)
  const latestDraft = eap.fieldMeasurementBulletins.find((b) => b.status === "RASCUNHO");
  const draftCurrentByKey = new Map<string, { qty: number; status: string; note: string | null }>();
  if (latestDraft) {
    for (const entry of latestDraft.entries) {
      const k = entry.eapItemId
        ? `${entry.floorId}::${entry.eapItemId}`
        : `${entry.floorId}::${entry.serviceLabel}`;
      draftCurrentByKey.set(k, {
        qty: entry.currentExecutedQty,
        status: entry.status,
        note: entry.fieldNote,
      });
    }
  }

  const items: FieldMeasurementServiceRow[] = [];

  for (const st of eap.stages) {
    const isInfraStage = ["01", "02", "03"].includes(st.code);
    const defaultPkgNum = stageToPkg.get(st.code) ?? null;

    for (const grp of st.groups) {
      for (const item of grp.items) {
        const zq = normalizeZoneQuantities(item.zoneQuantitiesJson);
        const calc = computeEapLine({
          description: item.description,
          unit: item.unit,
          zoneQuantities: zq,
          lossPercent: item.lossPercent,
          materialUnitCost: item.materialUnitCost,
          laborUnitCost: item.laborUnitCost,
          thirdPartyUnitCost: item.thirdPartyUnitCost,
          markupMultiplier: item.markupMultiplier,
        });

        const unitPrice =
          calc.commercialUnitPrice > 0 ? calc.commercialUnitPrice : calc.directUnitCost;

        const floorSlice: Array<{ floorId: string; qty: number }> = [
          {
            floorId: isInfraStage ? "FUNDACAO" : "TERREO",
            qty: zq.FUND_TERREO || 0,
          },
          { floorId: "PAV_SUPERIOR", qty: zq.PAV_SUPERIOR || 0 },
          { floorId: "COBERTA", qty: zq.COBERTURA || 0 },
          { floorId: "AREA_EXTERNA", qty: zq.EXTERNO || 0 },
        ];

        for (const slice of floorSlice) {
          if (slice.qty <= 0) continue;
          const floorDef = floorById.get(slice.floorId) ?? {
            floorId: slice.floorId,
            floorName: slice.floorId,
            floorOrder: 99,
          };

          const k = `${slice.floorId}::${item.id}`;
          const prevQty = approvedPrevByKey.get(k) ?? 0;
          const draft = draftCurrentByKey.get(k);
          const line = computeFieldMeasurementLine({
            plannedQty: slice.qty,
            previousExecutedQty: prevQty,
            currentExecutedQty: draft?.qty ?? 0,
            unitPrice,
            status: draft?.status,
          });

          const teamCode =
            defaultPkgNum !== null
              ? floorPkgToTeam.get(`${slice.floorId}::${defaultPkgNum}`) ?? null
              : null;

          items.push({
            rowKey: k,
            floorId: floorDef.floorId,
            floorName: floorDef.floorName,
            floorOrder: floorDef.floorOrder,
            packageNumber: defaultPkgNum,
            teamCode,
            eapItemId: item.id,
            serviceLabel: `${st.code} · ${item.description}`,
            unit: item.unit,
            fieldNote: draft?.note ?? null,
            ...line,
          });
        }
      }
    }
  }

  items.sort((a, b) => a.floorOrder - b.floorOrder || a.serviceLabel.localeCompare(b.serviceLabel));

  // Previsto LOB até refIso
  const totalLobAllocs = eap.lobFloorAllocations.length;
  const dueLobAllocs = eap.lobFloorAllocations.filter((a) => a.dateIso <= refIso).length;
  const plannedLobPct =
    totalLobAllocs > 0 ? Math.min(100, round2((dueLobAllocs / totalLobAllocs) * 100)) : 0;

  const weighted = computeWeightedFieldProgress(items, plannedLobPct);

  const floorAgg = new Map<string, FieldMeasurementFloorSummary>();
  for (const f of floors) {
    floorAgg.set(f.floorId, {
      floorId: f.floorId,
      floorName: f.floorName,
      floorOrder: f.floorOrder,
      itemsCount: 0,
      completedCount: 0,
      plannedAmount: 0,
      accumulatedAmount: 0,
      pendingAmount: 0,
      progressPct: 0,
    });
  }

  for (const row of items) {
    const agg = floorAgg.get(row.floorId) ?? {
      floorId: row.floorId,
      floorName: row.floorName,
      floorOrder: row.floorOrder,
      itemsCount: 0,
      completedCount: 0,
      plannedAmount: 0,
      accumulatedAmount: 0,
      pendingAmount: 0,
      progressPct: 0,
    };
    agg.itemsCount += 1;
    if (row.status === "CONCLUIDO") agg.completedCount += 1;
    agg.plannedAmount = round2(agg.plannedAmount + row.plannedAmount);
    agg.accumulatedAmount = round2(agg.accumulatedAmount + row.accumulatedAmount);
    agg.pendingAmount = round2(agg.pendingAmount + row.pendingAmount);
    floorAgg.set(row.floorId, agg);
  }

  const floorSummaries = Array.from(floorAgg.values())
    .sort((a, b) => a.floorOrder - b.floorOrder)
    .map((fs) => ({
      ...fs,
      progressPct:
        fs.plannedAmount > 0
          ? Math.min(100, round2((fs.accumulatedAmount / fs.plannedAmount) * 100))
          : 0,
    }));

  const maxBulletinNumber = eap.fieldMeasurementBulletins.reduce(
    (max, b) => Math.max(max, b.bulletinNumber),
    0
  );
  const nextBulletinNumber = latestDraft ? latestDraft.bulletinNumber : maxBulletinNumber + 1;

  return {
    projectId: eap.projectId,
    eapProjectId: eap.id,
    projectName: eap.project.name || eap.title,
    referenceDate: refIso,
    nextBulletinNumber,
    nextBulletinCode: formatBulletinCode(nextBulletinNumber),
    floors,
    summary: {
      ...weighted,
      completedItemsCount: items.filter((i) => i.status === "CONCLUIDO").length,
      totalItemsCount: items.length,
    },
    floorSummaries,
    items,
    bulletins: eap.fieldMeasurementBulletins.map((b) => ({
      id: b.id,
      bulletinNumber: b.bulletinNumber,
      bulletinCode: formatBulletinCode(b.bulletinNumber),
      referenceDate: b.referenceDate.toISOString().slice(0, 10),
      status: b.status,
      inspectorName: b.inspectorName,
      weatherCondition: b.weatherCondition,
      generalNotes: b.generalNotes,
      totalMeasuredValue: b.totalMeasuredValue,
      physicalProgressPct: b.physicalProgressPct,
      entriesCount: b.entries.length,
    })),
  };
}

export interface SaveBulletinEntryInput {
  floorId: string;
  floorName: string;
  packageNumber?: number | null;
  teamCode?: string | null;
  eapItemId?: string | null;
  serviceLabel: string;
  unit: string;
  plannedQty: number;
  previousExecutedQty: number;
  currentExecutedQty: number;
  unitPrice: number;
  status?: EntryStatus;
  fieldNote?: string | null;
}

export async function saveFieldMeasurementBulletin(input: {
  projectId: string;
  bulletinId?: string;
  referenceDate: string;
  status: BulletinStatus;
  inspectorName?: string | null;
  weatherCondition?: WeatherCondition | null;
  generalNotes?: string | null;
  entries: SaveBulletinEntryInput[];
}): Promise<{
  id: string;
  bulletinNumber: number;
  bulletinCode: string;
  status: string;
  totalMeasuredValue: number;
  physicalProgressPct: number;
  entriesCount: number;
} | null> {
  for (const e of input.entries) {
    if (
      e.plannedQty < 0 ||
      e.previousExecutedQty < 0 ||
      e.currentExecutedQty < 0 ||
      e.unitPrice < 0
    ) {
      throw new DomainError(
        "Quantidades medidas e valores unitários não podem ser negativos.",
        "VALIDATION"
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const eap = await tx.eapProject.findUnique({
      where: { projectId: input.projectId },
      select: { id: true },
    });
    if (!eap) return null;

    await tx.$executeRaw`SELECT 1 FROM "EapProject" WHERE "id" = ${eap.id}::uuid FOR UPDATE`;

    const itemIds = Array.from(
      new Set(input.entries.map((e) => e.eapItemId).filter((v): v is string => Boolean(v)))
    );
    if (itemIds.length > 0) {
      const ownedCount = await tx.eapItem.count({
        where: {
          id: { in: itemIds },
          group: { stage: { eapProjectId: eap.id } },
        },
      });
      if (ownedCount !== itemIds.length) {
        return null;
      }
    }

    const computedEntries = input.entries.map((raw) => {
      const calc = computeFieldMeasurementLine({
        plannedQty: raw.plannedQty,
        previousExecutedQty: raw.previousExecutedQty,
        currentExecutedQty: raw.currentExecutedQty,
        unitPrice: raw.unitPrice,
        status: raw.status,
      });
      return {
        raw,
        calc,
      };
    });

    const totals = computeWeightedFieldProgress(
      computedEntries.map((c) => c.calc),
      0
    );

    const refDate = new Date(`${input.referenceDate.slice(0, 10)}T00:00:00.000Z`);

    let targetBulletinId = input.bulletinId;
    let bulletinNumber = 1;

    if (targetBulletinId) {
      const existing = await tx.eapFieldMeasurementBulletin.findFirst({
        where: { id: targetBulletinId, eapProjectId: eap.id },
        select: { id: true, bulletinNumber: true },
      });
      if (!existing) return null;
      bulletinNumber = existing.bulletinNumber;

      await tx.eapFieldMeasurementBulletin.update({
        where: { id: existing.id },
        data: {
          referenceDate: refDate,
          status: input.status,
          inspectorName: input.inspectorName ?? null,
          weatherCondition: input.weatherCondition ?? null,
          generalNotes: input.generalNotes ?? null,
          totalMeasuredValue: totals.totalMeasuredValue,
          physicalProgressPct: totals.physicalProgressPct,
        },
      });
    } else {
      const agg = await tx.eapFieldMeasurementBulletin.aggregate({
        where: { eapProjectId: eap.id },
        _max: { bulletinNumber: true },
      });
      bulletinNumber = (agg._max.bulletinNumber ?? 0) + 1;

      const created = await tx.eapFieldMeasurementBulletin.create({
        data: {
          eapProjectId: eap.id,
          bulletinNumber,
          referenceDate: refDate,
          status: input.status,
          inspectorName: input.inspectorName ?? null,
          weatherCondition: input.weatherCondition ?? null,
          generalNotes: input.generalNotes ?? null,
          totalMeasuredValue: totals.totalMeasuredValue,
          physicalProgressPct: totals.physicalProgressPct,
        },
        select: { id: true },
      });
      targetBulletinId = created.id;
    }

    await tx.eapFieldMeasurementEntry.deleteMany({
      where: { bulletinId: targetBulletinId },
    });

    if (computedEntries.length > 0) {
      await tx.eapFieldMeasurementEntry.createMany({
        data: computedEntries.map(({ raw, calc }) => ({
          bulletinId: targetBulletinId!,
          eapProjectId: eap.id,
          floorId: raw.floorId,
          floorName: raw.floorName,
          packageNumber: raw.packageNumber ?? null,
          teamCode: raw.teamCode ? raw.teamCode.toUpperCase() : null,
          eapItemId: raw.eapItemId ?? null,
          serviceLabel: raw.serviceLabel,
          unit: raw.unit,
          plannedQty: calc.plannedQty,
          previousExecutedQty: calc.previousExecutedQty,
          currentExecutedQty: calc.currentExecutedQty,
          accumulatedPct: calc.accumulatedPct,
          unitPrice: calc.unitPrice,
          measuredAmount: calc.measuredAmount,
          status: calc.status,
          fieldNote: raw.fieldNote ?? null,
        })),
      });
    }

    return {
      id: targetBulletinId,
      bulletinNumber,
      bulletinCode: formatBulletinCode(bulletinNumber),
      status: input.status,
      totalMeasuredValue: totals.totalMeasuredValue,
      physicalProgressPct: totals.physicalProgressPct,
      entriesCount: computedEntries.length,
    };
  });
}

function fmtBRLPdf(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderFieldMeasurementBulletinPdf(input: {
  projectName: string;
  bulletinCode: string;
  referenceDate: string;
  status: string;
  inspectorName?: string | null;
  weatherCondition?: string | null;
  generalNotes?: string | null;
  summary: FieldMeasurementSnapshot["summary"];
  floorSummaries: FieldMeasurementFloorSummary[];
  items: FieldMeasurementServiceRow[];
}): Uint8Array {
  const pdf = new PdfWriter({
    title: `Boletim de Medicao ${input.bulletinCode} - ${input.projectName}`,
    author: "ArqVertice OS",
    subject: `Medicao de Obra ${input.bulletinCode}`,
  });

  pdf.rect(0, 0, pdf.width, 114, { fill: "0.09 0.09 0.11" });
  pdf.drawText("ARQVERTICE OS — MEDICAO NO CANTEIRO", pdf.margin, 38, {
    size: 9.5,
    bold: true,
    color: "0.93 0.90 0.85",
  });
  pdf.drawText(`BOLETIM DE MEDICAO ${input.bulletinCode}`, pdf.margin, 64, {
    size: 16,
    bold: true,
    color: "1 1 1",
  });
  pdf.drawText(
    `${input.projectName} · Data: ${input.referenceDate} · Status: ${input.status}`,
    pdf.margin,
    88,
    { size: 10, color: "0.85 0.87 0.90" }
  );

  pdf.y = 128;

  pdf.heading("1. Dados da Medicao & Indicadores Gerais");
  pdf.keyValueGrid(
    [
      { label: "Boletim", value: input.bulletinCode },
      { label: "Inspetor / Resp.", value: input.inspectorName || "Equipe Tecnica" },
      { label: "Condicao Climatica", value: input.weatherCondition || "SOL" },
      { label: "Avanco Realizado", value: `${input.summary.physicalProgressPct.toFixed(1)}%` },
      { label: "Previsto LOB", value: `${input.summary.plannedLobPct.toFixed(1)}%` },
      {
        label: "Desvio Fisico",
        value: `${input.summary.deviationPct >= 0 ? "+" : ""}${input.summary.deviationPct.toFixed(1)} p.p.`,
      },
      { label: "Medido no Periodo", value: fmtBRLPdf(input.summary.totalMeasuredValue) },
      { label: "Saldo Pendente", value: fmtBRLPdf(input.summary.totalPendingValue) },
    ],
    { columns: 2 }
  );

  if (input.generalNotes) {
    pdf.paragraph(`Observacoes de Canteiro: ${input.generalNotes}`);
  }

  pdf.y += 6;
  pdf.heading("2. Resumo por Pavimento (Feito x Pendente)");
  pdf.table({
    columns: [
      { title: "Pavimento", weight: 2.2 },
      { title: "Itens", weight: 0.9 },
      { title: "Avanco", weight: 1.5 },
      { title: "Acumulado R$", weight: 1.4 },
      { title: "Saldo Pend. R$", weight: 1.4 },
    ],
    rows: input.floorSummaries.map((f) => [
      f.floorName,
      `${f.completedCount}/${f.itemsCount}`,
      `${f.progressPct.toFixed(1)}%`,
      fmtBRLPdf(f.accumulatedAmount),
      fmtBRLPdf(f.pendingAmount),
    ]),
    progressColumn: 2,
    progressValues: input.floorSummaries.map((f) => Math.round(f.progressPct)),
  });

  pdf.y += 10;
  pdf.heading("3. Detalhamento de Servicos (Feito x Pendente)");
  pdf.table({
    size: 7.5,
    padding: 3.5,
    columns: [
      { title: "Pavimento", weight: 1.3 },
      { title: "Servico", weight: 2.8 },
      { title: "Prev.", weight: 0.9 },
      { title: "Feito", weight: 0.9 },
      { title: "Pend.", weight: 0.9 },
      { title: "Medido R$", weight: 1.2 },
    ],
    rows: input.items.slice(0, 80).map((it) => [
      `${it.floorName}${it.packageNumber ? ` (${it.teamCode || ""}${it.packageNumber})` : ""}`,
      it.serviceLabel,
      `${it.plannedQty.toFixed(2)} ${it.unit}`,
      `${it.accumulatedQty.toFixed(2)}`,
      `${it.pendingQty.toFixed(2)}`,
      fmtBRLPdf(it.measuredAmount),
    ]),
  });

  pdf.stampFooters(`ArqVertice OS · Boletim ${input.bulletinCode}`);
  return pdf.build();
}

export async function generateAutomaticMeasurementBulletinPdf(
  projectId: string,
  bulletinId?: string
): Promise<{
  pdfBytes: Uint8Array;
  bulletinCode: string;
  projectName: string;
} | null> {
  const snapshot = await buildFieldMeasurementSnapshot(projectId);
  if (!snapshot) return null;

  if (bulletinId) {
    const bulletin = await prisma.eapFieldMeasurementBulletin.findFirst({
      where: { id: bulletinId, eapProjectId: snapshot.eapProjectId },
      include: { entries: true },
    });
    if (!bulletin) return null;

    const code = formatBulletinCode(bulletin.bulletinNumber);
    const entryRows: FieldMeasurementServiceRow[] =
      bulletin.entries.length > 0
        ? bulletin.entries.map((e, idx) => {
            const calc = computeFieldMeasurementLine({
              plannedQty: e.plannedQty,
              previousExecutedQty: e.previousExecutedQty,
              currentExecutedQty: e.currentExecutedQty,
              unitPrice: e.unitPrice,
              status: e.status,
            });
            return {
              rowKey: `${e.floorId}::${e.id}`,
              floorId: e.floorId,
              floorName: e.floorName,
              floorOrder: idx,
              packageNumber: e.packageNumber,
              teamCode: e.teamCode,
              eapItemId: e.eapItemId,
              serviceLabel: e.serviceLabel,
              unit: e.unit,
              fieldNote: e.fieldNote,
              ...calc,
            };
          })
        : snapshot.items;

    const summaryWeighted = computeWeightedFieldProgress(
      entryRows,
      snapshot.summary.plannedLobPct
    );

    const pdfBytes = renderFieldMeasurementBulletinPdf({
      projectName: snapshot.projectName,
      bulletinCode: code,
      referenceDate: bulletin.referenceDate.toISOString().slice(0, 10),
      status: bulletin.status,
      inspectorName: bulletin.inspectorName,
      weatherCondition: bulletin.weatherCondition,
      generalNotes: bulletin.generalNotes,
      summary: {
        ...summaryWeighted,
        completedItemsCount: entryRows.filter((r) => r.status === "CONCLUIDO").length,
        totalItemsCount: entryRows.length,
      },
      floorSummaries: snapshot.floorSummaries,
      items: entryRows,
    });

    return { pdfBytes, bulletinCode: code, projectName: snapshot.projectName };
  }

  const latest = snapshot.bulletins[0];
  const code = latest ? latest.bulletinCode : snapshot.nextBulletinCode;
  const pdfBytes = renderFieldMeasurementBulletinPdf({
    projectName: snapshot.projectName,
    bulletinCode: code,
    referenceDate: latest?.referenceDate ?? snapshot.referenceDate,
    status: latest?.status ?? "RASCUNHO",
    inspectorName: latest?.inspectorName,
    weatherCondition: latest?.weatherCondition,
    generalNotes: latest?.generalNotes,
    summary: snapshot.summary,
    floorSummaries: snapshot.floorSummaries,
    items: snapshot.items,
  });

  return { pdfBytes, bulletinCode: code, projectName: snapshot.projectName };
}
