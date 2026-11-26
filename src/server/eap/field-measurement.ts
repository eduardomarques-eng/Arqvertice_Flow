import { prisma } from "@/server/db";
import { computeEapLine, round2 } from "@/server/eap/calculator";
import { normalizeZoneQuantities } from "@/server/eap/workbench";
import { DEFAULT_LOB_FLOORS, type LobFloorDefinition } from "@/lib/eap-lob-grid";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { decodeImageBufferToPdfImage } from "@/lib/pdf/pdf-image";
import {
  drawPdfBrandedHeader,
  drawPdfDonutChart,
  drawPdfGroupedBarChart,
  drawPdfHorizontalBarChart,
  drawPdfKpiCardsRow,
  drawPdfStackedDistributionBar,
} from "@/lib/pdf/pdf-charts";
import { getStoredObject } from "@/server/storage";
import {
  buildFieldMeasurementChartData,
  type FieldMeasurementChartData,
} from "@/lib/eap-measurement-charts";
import { DomainError } from "@/server/errors";

export { buildFieldMeasurementChartData, type FieldMeasurementChartData };

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

export interface MeasurementEvidenceDTO {
  id: string;
  eapProjectId: string;
  bulletinId: string | null;
  rowKey: string;
  floorId: string;
  floorName: string;
  eapItemId: string | null;
  serviceLabel: string;
  mediaType: "IMAGE" | "VIDEO";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  durationSec: number | null;
  capturedAt: string;
  url: string;
}

export interface FieldMeasurementSnapshot {
  projectId: string;
  eapProjectId: string;
  projectName: string;
  referenceDate: string;
  nextBulletinNumber: number;
  nextBulletinCode: string;
  isParametricFallback?: boolean;
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
  evidences: MeasurementEvidenceDTO[];
  chartData: FieldMeasurementChartData;
}

export function toEvidenceDto(
  projectId: string,
  row: {
    id: string;
    eapProjectId: string;
    bulletinId: string | null;
    rowKey: string;
    floorId: string;
    floorName: string;
    eapItemId: string | null;
    serviceLabel: string;
    mediaType: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    durationSec: number | null;
    capturedAt: Date | string;
  }
): MeasurementEvidenceDTO {
  return {
    id: row.id,
    eapProjectId: row.eapProjectId,
    bulletinId: row.bulletinId,
    rowKey: row.rowKey,
    floorId: row.floorId,
    floorName: row.floorName,
    eapItemId: row.eapItemId,
    serviceLabel: row.serviceLabel,
    mediaType: row.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    durationSec: row.durationSec,
    capturedAt:
      row.capturedAt instanceof Date
        ? row.capturedAt.toISOString()
        : String(row.capturedAt),
    url: `/api/eap/projects/${projectId}/measurements/evidence/${row.id}`,
  };
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

export function buildParametricFieldMeasurementRows(input: {
  builtAreaM2: number;
  bdiPercent: number;
  floors: LobFloorDefinition[];
  approvedPrevByKey: Map<string, number>;
  draftCurrentByKey: Map<string, { qty: number; status: string; note: string | null }>;
}): FieldMeasurementServiceRow[] {
  const area = input.builtAreaM2 > 0 ? input.builtAreaM2 : 180;
  const markup = 1 + Math.max(0, input.bdiPercent || 0) / 100;

  const templates: Array<{
    floorId: string;
    packageNumber: number;
    teamCode: string;
    serviceLabel: string;
    unit: string;
    qtyPerM2: number;
    unitDirectCost: number;
  }> = [
    {
      floorId: "FUNDACAO",
      packageNumber: 1,
      teamCode: "A",
      serviceLabel: "03 · Infraestrutura, Escavação e Fundação",
      unit: "m²",
      qtyPerM2: 0.45,
      unitDirectCost: 620,
    },
    {
      floorId: "TERREO",
      packageNumber: 2,
      teamCode: "A",
      serviceLabel: "04 · Supraestrutura Térreo (Pilares, Vigas e Lajes)",
      unit: "m²",
      qtyPerM2: 0.55,
      unitDirectCost: 780,
    },
    {
      floorId: "TERREO",
      packageNumber: 4,
      teamCode: "B",
      serviceLabel: "05 · Alvenaria e Vedações Térreo",
      unit: "m²",
      qtyPerM2: 0.9,
      unitDirectCost: 195,
    },
    {
      floorId: "PAV_SUPERIOR",
      packageNumber: 3,
      teamCode: "A",
      serviceLabel: "04 · Supraestrutura Pav. Superior",
      unit: "m²",
      qtyPerM2: 0.45,
      unitDirectCost: 790,
    },
    {
      floorId: "PAV_SUPERIOR",
      packageNumber: 5,
      teamCode: "B",
      serviceLabel: "08/09 · Instalações Elétricas e Hidrossanitárias",
      unit: "pt",
      qtyPerM2: 0.35,
      unitDirectCost: 340,
    },
    {
      floorId: "COBERTA",
      packageNumber: 6,
      teamCode: "C",
      serviceLabel: "11 · Coberta, Estrutura e Impermeabilização",
      unit: "m²",
      qtyPerM2: 0.55,
      unitDirectCost: 260,
    },
    {
      floorId: "AREA_EXTERNA",
      packageNumber: 7,
      teamCode: "C",
      serviceLabel: "13/17 · Revestimentos, Pintura e Área Externa",
      unit: "m²",
      qtyPerM2: 1.1,
      unitDirectCost: 185,
    },
  ];

  const floorById = new Map(input.floors.map((f) => [f.floorId, f]));

  return templates.map((tpl, idx) => {
    const floorDef = floorById.get(tpl.floorId) ??
      input.floors[Math.min(idx, input.floors.length - 1)] ?? {
        floorId: tpl.floorId,
        floorName: tpl.floorId,
        floorOrder: idx + 1,
      };
    const plannedQty = round2(Math.max(1, area * tpl.qtyPerM2));
    const unitPrice = round2(tpl.unitDirectCost * markup);
    const k = `${floorDef.floorId}::${tpl.serviceLabel}`;
    const prevQty = input.approvedPrevByKey.get(k) ?? 0;
    const draft = input.draftCurrentByKey.get(k);
    const line = computeFieldMeasurementLine({
      plannedQty,
      previousExecutedQty: prevQty,
      currentExecutedQty: draft?.qty ?? 0,
      unitPrice,
      status: draft?.status,
    });

    return {
      rowKey: `PARAM::${floorDef.floorId}::${idx + 1}`,
      floorId: floorDef.floorId,
      floorName: floorDef.floorName,
      floorOrder: floorDef.floorOrder,
      packageNumber: tpl.packageNumber,
      teamCode: tpl.teamCode,
      eapItemId: null,
      serviceLabel: tpl.serviceLabel,
      unit: tpl.unit,
      fieldNote: draft?.note ?? null,
      ...line,
    };
  });
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

  let isParametricFallback = false;
  if (items.length === 0) {
    isParametricFallback = true;
    items.push(
      ...buildParametricFieldMeasurementRows({
        builtAreaM2: eap.builtAreaM2,
        bdiPercent: eap.bdiPercent,
        floors,
        approvedPrevByKey,
        draftCurrentByKey,
      })
    );
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

  // Previsto LOB por pavimento até refIso
  const plannedLobPctByFloor: Record<string, number> = {};
  for (const f of floors) {
    const fTotal = eap.lobFloorAllocations.filter((a) => a.floorId === f.floorId).length;
    const fDue = eap.lobFloorAllocations.filter(
      (a) => a.floorId === f.floorId && a.dateIso <= refIso
    ).length;
    if (fTotal > 0) {
      plannedLobPctByFloor[f.floorId] = Math.min(100, round2((fDue / fTotal) * 100));
    }
  }

  const evidenceRows = prisma.eapMeasurementEvidence?.findMany
    ? await prisma.eapMeasurementEvidence
        .findMany({
          where: { eapProjectId: eap.id },
          orderBy: { capturedAt: "desc" },
        })
        .catch(() => [])
    : [];
  const evidences = evidenceRows.map((ev) => toEvidenceDto(eap.projectId, ev));

  const maxBulletinNumber = eap.fieldMeasurementBulletins.reduce(
    (max, b) => Math.max(max, b.bulletinNumber),
    0
  );
  const nextBulletinNumber = latestDraft ? latestDraft.bulletinNumber : maxBulletinNumber + 1;

  const summary = {
    ...weighted,
    completedItemsCount: items.filter((i) => i.status === "CONCLUIDO").length,
    totalItemsCount: items.length,
  };

  const chartData = buildFieldMeasurementChartData({
    summary,
    floorSummaries,
    items,
    plannedLobPctByFloor,
  });

  return {
    projectId: eap.projectId,
    eapProjectId: eap.id,
    projectName: eap.project.name || eap.title,
    referenceDate: refIso,
    nextBulletinNumber,
    nextBulletinCode: formatBulletinCode(nextBulletinNumber),
    isParametricFallback,
    floors,
    summary,
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
    evidences,
    chartData,
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

export interface PdfBulletinEvidenceInput extends MeasurementEvidenceDTO {
  imageBytes?: Buffer | null;
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
  evidences?: PdfBulletinEvidenceInput[];
  plannedLobPctByFloor?: Record<string, number>;
}): Uint8Array {
  const pdf = new PdfWriter(
    {
      title: `Boletim de Medicao ${input.bulletinCode} - ${input.projectName}`,
      author: "ArqVertice OS",
      subject: `Medicao de Obra ${input.bulletinCode}`,
    },
    { margin: 28 }
  );

  drawPdfBrandedHeader(pdf, {
    eyebrow: "ArqVertice OS · Medicao no Canteiro",
    title: `BOLETIM DE MEDICAO ${input.bulletinCode}`,
    subtitle: `${input.projectName} · Data: ${input.referenceDate} · Status: ${input.status}`,
    metaLine: `Inspetor: ${input.inspectorName || "Equipe Tecnica"} · Clima: ${input.weatherCondition || "SOL"} · Desvio Fisico: ${input.summary.deviationPct >= 0 ? "+" : ""}${input.summary.deviationPct.toFixed(1)} pontos percentuais`,
    accentHex: "#059669",
  });

  drawPdfKpiCardsRow(pdf, [
    {
      label: "Avanco Realizado",
      value: `${input.summary.physicalProgressPct.toFixed(1)}%`,
      sub: `Previsto Linha de Balanco: ${input.summary.plannedLobPct.toFixed(1)}%`,
      accentHex: "#059669",
      bgHex: "#ECFDF5",
    },
    {
      label: "Desvio Fisico",
      value: `${input.summary.deviationPct >= 0 ? "+" : ""}${input.summary.deviationPct.toFixed(1)} p.p.`,
      sub: input.summary.deviationPct >= 0 ? "Adiantado / No prazo" : "Atencao / Recuperar",
      accentHex: input.summary.deviationPct >= 0 ? "#2563EB" : "#D97706",
      bgHex: input.summary.deviationPct >= 0 ? "#EFF6FF" : "#FFFBEB",
    },
    {
      label: "Medido no Periodo",
      value: fmtBRLPdf(input.summary.totalMeasuredValue),
      sub: `Boletim ${input.bulletinCode}`,
      accentHex: "#4F46E5",
      bgHex: "#EEF2FF",
    },
    {
      label: "Saldo Pendente",
      value: fmtBRLPdf(input.summary.totalPendingValue),
      sub: "A executar na obra",
      accentHex: "#D97706",
      bgHex: "#FFFBEB",
    },
  ]);

  if (input.generalNotes) {
    pdf.paragraph(`Observacoes de Canteiro: ${input.generalNotes}`);
  }

  const chartData = buildFieldMeasurementChartData({
    summary: input.summary,
    floorSummaries: input.floorSummaries,
    items: input.items,
    plannedLobPctByFloor: input.plannedLobPctByFloor,
  });

  pdf.ensure(90);
  pdf.heading("1. Painel Grafico de Evolucao e Composicao Financeira");

  if (chartData.floorComparison.length > 0) {
    drawPdfGroupedBarChart(pdf, {
      title: "Avanco Fisico por Pavimento (Previsto Linha de Balanco % x Realizado no Canteiro %)",
      seriesA: { label: "Previsto Linha de Balanco", colorHex: "#64748B" },
      seriesB: { label: "Realizado no Canteiro", colorHex: "#059669" },
      items: chartData.floorComparison.map((fc) => ({
        label: fc.floorName,
        valueA: fc.plannedPct,
        valueB: fc.realizedPct,
        formattedA: `${fc.plannedPct.toFixed(1)}%`,
        formattedB: `${fc.realizedPct.toFixed(1)}%`,
      })),
    });
  }

  drawPdfStackedDistributionBar(pdf, {
    title: "Composicao Financeira Acumulada da Obra",
    segments: chartData.financialComposition.slices.map((s) => ({
      label: s.label,
      value: s.value,
      colorHex: s.colorHex,
    })),
  });

  drawPdfDonutChart(pdf, {
    title: "Distribuicao Financeira (Anterior x Boletim Atual x Saldo a Executar)",
    centerLabel: fmtBRLPdf(chartData.financialComposition.totalPlanned),
    centerSubLabel: "Total Previsto",
    segments: chartData.financialComposition.slices.map((s) => ({
      label: s.label,
      value: s.value,
      formattedValue: fmtBRLPdf(s.value),
      colorHex: s.colorHex,
    })),
  });

  drawPdfHorizontalBarChart(pdf, {
    title: "Status dos Servicos em Campo",
    items: chartData.serviceStatusDistribution.map((st) => ({
      label: st.label,
      value: st.count,
      formattedValue: `${st.count} servico(s)`,
      colorHex: st.colorHex,
    })),
  });

  pdf.ensure(75);
  pdf.heading("2. Resumo por Pavimento");
  pdf.table({
    columns: [
      { title: "Pavimento", weight: 2.2 },
      { title: "Servicos", weight: 0.9 },
      { title: "Avanco Realizado", weight: 1.5 },
      { title: "Acumulado R$", weight: 1.4 },
      { title: "Saldo Pendente R$", weight: 1.4 },
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
  pdf.ensure(75);
  pdf.heading("3. Detalhamento de Servicos Medidos");
  pdf.table({
    size: 7.5,
    padding: 3.5,
    columns: [
      { title: "Pavimento", weight: 1.3 },
      { title: "Servico", weight: 2.5 },
      { title: "Previsto", weight: 0.95 },
      { title: "Anterior", weight: 0.85 },
      { title: "Atual", weight: 0.85 },
      { title: "Saldo Pendente", weight: 0.95 },
      { title: "Valor Medido R$", weight: 1.2 },
    ],
    rows: input.items.slice(0, 80).map((it) => [
      `${it.floorName}${it.packageNumber ? ` (Pacote ${it.packageNumber})` : ""}`,
      it.serviceLabel,
      `${it.plannedQty.toFixed(2)} ${it.unit}`,
      `${it.previousExecutedQty.toFixed(2)}`,
      `${it.currentExecutedQty.toFixed(2)}`,
      `${it.pendingQty.toFixed(2)} ${it.unit}`,
      fmtBRLPdf(it.measuredAmount),
    ]),
  });

  const evidences = input.evidences ?? [];
  if (evidences.length > 0) {
    pdf.y += 10;
    pdf.ensure(90);
    pdf.heading("4. Registro Fotografico e Evidencias de Campo");

    const photoEvidences = evidences.filter(
      (ev) => ev.mediaType === "IMAGE" && ev.imageBytes && ev.imageBytes.length > 0
    );
    const videoEvidences = evidences.filter((ev) => ev.mediaType === "VIDEO");

    if (photoEvidences.length > 0) {
      const colGap = 12;
      const cardW = (pdf.contentWidth - colGap) / 2;
      const imgH = 118;
      const cardH = imgH + 34;

      const maxPhotos = photoEvidences.slice(0, 12);
      for (let i = 0; i < maxPhotos.length; i += 2) {
        pdf.ensure(cardH + 8);
        const rowY = pdf.y;

        for (let col = 0; col < 2; col++) {
          const ev = maxPhotos[i + col];
          if (!ev || !ev.imageBytes) continue;
          const x = pdf.margin + col * (cardW + colGap);
          const embedded = decodeImageBufferToPdfImage(ev.imageBytes, ev.mimeType);

          pdf.rect(x, rowY, cardW, cardH, {
            fill: "#F8FAFC",
            stroke: "#CBD5E1",
            lineWidth: 0.6,
          });
          if (embedded) {
            pdf.drawEmbeddedImage(embedded, x + 6, rowY + 6, cardW - 12, imgH);
          } else {
            pdf.drawText("Imagem anexada no portal", x + cardW / 2, rowY + imgH / 2, {
              size: 8,
              align: "center",
              color: "#64748B",
            });
          }

          pdf.drawText(ev.serviceLabel, x + 8, rowY + imgH + 17, {
            size: 7.5,
            bold: true,
            color: "#0F172A",
          });
          pdf.drawText(
            `${ev.floorName} · ${ev.capturedAt.slice(0, 10)}`,
            x + 8,
            rowY + imgH + 28,
            { size: 6.8, color: "#475569" }
          );
        }

        pdf.y = rowY + cardH + 8;
      }
    }

    if (videoEvidences.length > 0) {
      pdf.ensure(40);
      pdf.paragraph(
        `Videos anexados no portal da obra (${videoEvidences.length}): ${videoEvidences
          .map(
            (v) =>
              `${v.serviceLabel} — ${v.fileName}${v.durationSec ? ` (${v.durationSec.toFixed(0)}s)` : ""}`
          )
          .join("; ")}`
      );
    }
  }

  pdf.stampFooters(`ArqVertice OS · Boletim ${input.bulletinCode}`);
  return pdf.build();
}

async function resolveProjectEvidencesForPdf(
  projectId: string,
  eapProjectId: string
): Promise<PdfBulletinEvidenceInput[]> {
  if (!prisma.eapMeasurementEvidence?.findMany) return [];
  const rows = await prisma.eapMeasurementEvidence
    .findMany({
      where: { eapProjectId },
      orderBy: { capturedAt: "desc" },
      take: 24,
    })
    .catch(() => []);

  const result: PdfBulletinEvidenceInput[] = [];
  for (const row of rows) {
    const dto = toEvidenceDto(projectId, row);
    let imageBytes: Buffer | null = null;
    if (dto.mediaType === "IMAGE") {
      if (row.dataBase64) {
        imageBytes = Buffer.from(row.dataBase64, "base64");
      } else if (!row.storageKey.startsWith("db://")) {
        imageBytes = await getStoredObject(row.storageKey).catch(() => null);
      }
    }
    result.push({ ...dto, imageBytes });
  }
  return result;
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

  const pdfEvidences = await resolveProjectEvidencesForPdf(
    projectId,
    snapshot.eapProjectId
  );

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
      evidences: pdfEvidences,
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
    evidences: pdfEvidences,
  });

  return { pdfBytes, bulletinCode: code, projectName: snapshot.projectName };
}
