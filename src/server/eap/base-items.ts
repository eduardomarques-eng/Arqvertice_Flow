import type { Prisma, PrismaClient } from "@prisma/client";
import type { ReconciledEapItem } from "./reconciler";
import { MASTER_EAP_BASE_ITEMS } from "./templates/residential-master";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface ExistingEapItemForMerge {
  id: string;
  groupId: string;
  stageCode: string;
  code: string | null;
  description: string;
  unit: string;
  sourceSoftware: string;
  revisionTag: string;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
}

export interface PlannedMiningUpdate {
  id: string;
  groupId: string;
  materialCatalogId: string | null;
  laborRoleId: string | null;
  code: string | null;
  description: string;
  unit: string;
  zoneQuantities: ReconciledEapItem["zoneQuantities"];
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  sourceSoftware: string;
  sourceFileId: string | null;
  sourcePage: number | null;
  sanityFlag: string | null;
}

export interface PlannedMiningCreate {
  groupId: string;
  materialCatalogId: string | null;
  laborRoleId: string | null;
  code: string | null;
  description: string;
  unit: string;
  zoneQuantities: ReconciledEapItem["zoneQuantities"];
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  markupMultiplier: number;
  sourceSoftware: string;
  sourceFileId: string | null;
  sourcePage: number | null;
  sanityFlag: string | null;
  orderIndex: number;
}

export interface MiningMergePlan {
  updates: PlannedMiningUpdate[];
  creates: PlannedMiningCreate[];
  resetTemplateIds: string[];
  deleteIds: string[];
  preservedManualCount: number;
}

function normalizeUnit(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace("m3", "m³")
    .replace("m2", "m²")
    .replace("unid", "un");
}

function tokenizeDescription(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function scoreMatch(existing: ExistingEapItemForMerge, cand: ReconciledEapItem): number {
  if (existing.stageCode !== cand.eapStageCode) return 0;

  if (existing.code && cand.code && existing.code.toUpperCase() === cand.code.toUpperCase()) {
    return 100;
  }

  if (normalizeUnit(existing.unit) !== normalizeUnit(cand.unit)) {
    return 0;
  }

  const existingTokens = new Set(tokenizeDescription(existing.description));
  const candTokens = tokenizeDescription(cand.description);
  if (candTokens.length === 0 || existingTokens.size === 0) return 0;

  let overlap = 0;
  for (const tok of candTokens) {
    if (existingTokens.has(tok)) overlap += 1;
  }
  if (overlap === 0) return 0;

  // Coeficiente simples com bônus de sobreposição semântica
  return overlap / Math.max(existingTokens.size, candTokens.length);
}

/**
 * Planeja o merge não-destrutivo entre os itens já existentes na planilha (base + edições manuais)
 * e os quantitativos minerados da Etapa 1:
 * - Itens editados manualmente (`revisionTag !== "ORIGINAL"`) são SEMPRE preservados.
 * - Linhas-base com `revisionTag === "ORIGINAL"` recebem atualização direta das quantidades e custos.
 * - Candidatos sem linha-base compatível são inseridos ao final da etapa correspondente.
 * - Linhas-base sem correspondência nos arquivos têm quantidades zeradas para edição livre.
 */
export function planMiningMerge(input: {
  existingItems: ExistingEapItemForMerge[];
  acceptedItems: ReconciledEapItem[];
  groupByStageCode: Map<string, string>;
  fallbackGroupId: string;
  templateCodes?: Set<string>;
  defaultMarkup: number;
}): MiningMergePlan {
  const {
    existingItems,
    acceptedItems,
    groupByStageCode,
    fallbackGroupId,
    templateCodes = new Set(MASTER_EAP_BASE_ITEMS.map((b) => b.code.toUpperCase())),
    defaultMarkup,
  } = input;

  const matchedExistingIds = new Set<string>();
  const updates: PlannedMiningUpdate[] = [];
  const creates: PlannedMiningCreate[] = [];
  let preservedManualCount = 0;

  // Rastreia quantidade de itens por grupo para orderIndex dos novos itens
  const groupMaxOrder = new Map<string, number>();
  for (const item of existingItems) {
    groupMaxOrder.set(item.groupId, (groupMaxOrder.get(item.groupId) ?? 0) + 1);
  }

  // Mapa para agregar múltiplos candidatos minerados que caem na mesma linha-base
  const aggregatedUpdateByExistingId = new Map<string, PlannedMiningUpdate>();

  for (const cand of acceptedItems) {
    let bestItem: ExistingEapItemForMerge | null = null;
    let bestScore = 0;

    for (const existing of existingItems) {
      const score = scoreMatch(existing, cand);
      if (score > bestScore && (score >= 100 || score >= 0.28)) {
        bestScore = score;
        bestItem = existing;
      }
    }

    if (bestItem) {
      matchedExistingIds.add(bestItem.id);
      if (bestItem.revisionTag !== "ORIGINAL") {
        preservedManualCount += 1;
        continue;
      }

      const prevAgg = aggregatedUpdateByExistingId.get(bestItem.id);
      if (prevAgg) {
        prevAgg.zoneQuantities = {
          FUND_TERREO: prevAgg.zoneQuantities.FUND_TERREO + (cand.zoneQuantities.FUND_TERREO || 0),
          PAV_SUPERIOR: prevAgg.zoneQuantities.PAV_SUPERIOR + (cand.zoneQuantities.PAV_SUPERIOR || 0),
          COBERTURA: prevAgg.zoneQuantities.COBERTURA + (cand.zoneQuantities.COBERTURA || 0),
          EXTERNO: prevAgg.zoneQuantities.EXTERNO + (cand.zoneQuantities.EXTERNO || 0),
        };
        if (cand.sanityFlag && !prevAgg.sanityFlag?.includes(cand.sanityFlag)) {
          prevAgg.sanityFlag = prevAgg.sanityFlag
            ? `${prevAgg.sanityFlag} | ${cand.sanityFlag}`
            : cand.sanityFlag;
        }
        continue;
      }

      const hasExistingPrice =
        bestItem.materialUnitCost > 0 || bestItem.laborUnitCost > 0 || bestItem.thirdPartyUnitCost > 0;

      const planned: PlannedMiningUpdate = {
        id: bestItem.id,
        groupId: bestItem.groupId,
        materialCatalogId: cand.materialCatalogId,
        laborRoleId: cand.laborRoleId,
        code: bestItem.code || cand.code,
        description:
          bestItem.sourceSoftware === "TEMPLATE" ? bestItem.description : cand.description,
        unit: bestItem.sourceSoftware === "TEMPLATE" ? bestItem.unit : cand.unit,
        zoneQuantities: { ...cand.zoneQuantities },
        lossPercent: cand.lossPercent,
        materialUnitCost: hasExistingPrice ? bestItem.materialUnitCost : cand.materialUnitCost,
        laborUnitCost: hasExistingPrice ? bestItem.laborUnitCost : cand.laborUnitCost,
        thirdPartyUnitCost: hasExistingPrice
          ? bestItem.thirdPartyUnitCost
          : cand.thirdPartyUnitCost,
        sourceSoftware: cand.sourceSoftware,
        sourceFileId: cand.sourceFileId,
        sourcePage: cand.sourcePage,
        sanityFlag: cand.sanityFlag,
      };
      aggregatedUpdateByExistingId.set(bestItem.id, planned);
      continue;
    }

    const targetGroupId = groupByStageCode.get(cand.eapStageCode) ?? fallbackGroupId;
    const nextOrder = (groupMaxOrder.get(targetGroupId) ?? 0) + 1;
    groupMaxOrder.set(targetGroupId, nextOrder);

    creates.push({
      groupId: targetGroupId,
      materialCatalogId: cand.materialCatalogId,
      laborRoleId: cand.laborRoleId,
      code: cand.code,
      description: cand.description,
      unit: cand.unit,
      zoneQuantities: { ...cand.zoneQuantities },
      lossPercent: cand.lossPercent,
      materialUnitCost: cand.materialUnitCost,
      laborUnitCost: cand.laborUnitCost,
      thirdPartyUnitCost: cand.thirdPartyUnitCost,
      markupMultiplier: defaultMarkup,
      sourceSoftware: cand.sourceSoftware,
      sourceFileId: cand.sourceFileId,
      sourcePage: cand.sourcePage,
      sanityFlag: cand.sanityFlag,
      orderIndex: nextOrder,
    });
  }

  for (const planned of aggregatedUpdateByExistingId.values()) {
    updates.push(planned);
  }

  const resetTemplateIds: string[] = [];
  const deleteIds: string[] = [];

  for (const existing of existingItems) {
    if (matchedExistingIds.has(existing.id)) continue;
    if (existing.revisionTag !== "ORIGINAL") continue;

    const codeUpper = existing.code?.toUpperCase() ?? "";
    if (codeUpper && templateCodes.has(codeUpper)) {
      if (existing.sourceSoftware !== "TEMPLATE") {
        resetTemplateIds.push(existing.id);
      }
    } else if (existing.sourceSoftware === "TQS" || existing.sourceSoftware === "REVIT") {
      deleteIds.push(existing.id);
    }
  }

  return {
    updates,
    creates,
    resetTemplateIds,
    deleteIds,
    preservedManualCount,
  };
}

/**
 * Garante que uma EAP possua os itens-base estruturados cobrindo todas as disciplinas
 * (Arquitetura, Estrutura, Elétrica, Hidrossanitário, Luminotécnico e Paisagismo)
 * caso ainda não tenha itens cadastrados.
 */
export async function ensureBaseEapItems(
  db: PrismaLike,
  eapProjectId: string,
  cityId: string
): Promise<{ inserted: number }> {
  const existingCount = await db.eapItem.count({
    where: { group: { stage: { eapProjectId } } },
  });
  if (existingCount > 0) {
    return { inserted: 0 };
  }

  const [eap, materials] = await Promise.all([
    db.eapProject.findUnique({
      where: { id: eapProjectId },
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
          include: { groups: { orderBy: { orderIndex: "asc" } } },
        },
      },
    }),
    db.materialCatalogItem.findMany({
      where: { active: true },
      include: { cityPrices: { where: { cityId }, take: 1 } },
    }),
  ]);

  if (!eap || eap.stages.length === 0) {
    return { inserted: 0 };
  }

  const groupByCode = new Map<string, string>();
  const firstGroupByStage = new Map<string, string>();
  for (const st of eap.stages) {
    if (st.groups[0]) {
      firstGroupByStage.set(st.code, st.groups[0].id);
    }
    for (const grp of st.groups) {
      groupByCode.set(grp.code, grp.id);
    }
  }

  const fallbackGroupId = eap.stages[0]?.groups[0]?.id;
  if (!fallbackGroupId) {
    return { inserted: 0 };
  }

  const matByCode = new Map(materials.map((m) => [m.code.toUpperCase(), m]));
  const markupMultiplier = Math.round((1 + (eap.bdiPercent || 0) / 100) * 10000) / 10000;
  const orderPerGroup = new Map<string, number>();

  const rows = MASTER_EAP_BASE_ITEMS.map((tpl) => {
    const targetGroupId =
      groupByCode.get(tpl.groupCode) ??
      firstGroupByStage.get(tpl.stageCode) ??
      fallbackGroupId;
    const nextOrder = (orderPerGroup.get(targetGroupId) ?? 0) + 1;
    orderPerGroup.set(targetGroupId, nextOrder);

    const mat =
      matByCode.get(tpl.code.toUpperCase()) ??
      materials.find(
        (m) =>
          m.category.toUpperCase() === tpl.category.toUpperCase() &&
          normalizeUnit(m.unit) === normalizeUnit(tpl.unit)
      ) ??
      null;

    return {
      groupId: targetGroupId,
      materialCatalogId: mat?.id ?? null,
      laborRoleId: null,
      code: tpl.code,
      description: tpl.description,
      unit: tpl.unit,
      zoneQuantitiesJson: {
        FUND_TERREO: 0,
        PAV_SUPERIOR: 0,
        COBERTURA: 0,
        EXTERNO: 0,
      },
      lossPercent: tpl.defaultLossPercent ?? mat?.defaultLossPercent ?? 0,
      materialUnitCost: mat?.cityPrices[0]?.materialUnitCost ?? 0,
      laborUnitCost: 0,
      thirdPartyUnitCost: mat?.cityPrices[0]?.thirdPartyUnitCost ?? 0,
      markupMultiplier,
      teamsCount: 1,
      sourceSoftware: "TEMPLATE",
      revisionTag: "ORIGINAL",
      orderIndex: nextOrder,
    };
  });

  if (rows.length > 0) {
    await db.eapItem.createMany({ data: rows });
  }

  return { inserted: rows.length };
}
