import {
  computeEapEngineeringIndicators,
  computeEapLine,
  round2,
  type ZoneQuantities,
} from "./calculator";

export interface RawEapItemRecord {
  id: string;
  groupId: string;
  materialCatalogId: string | null;
  laborRoleId: string | null;
  code: string | null;
  description: string;
  unit: string;
  zoneQuantitiesJson: unknown;
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  markupMultiplier: number;
  teamsCount: number;
  sourceSoftware: string;
  sourceFileId: string | null;
  sourcePage: number | null;
  sanityFlag: string | null;
  revisionTag: string;
  orderIndex: number;
}

export interface ComputedEapItemDTO {
  id: string;
  groupId: string;
  stageCode: string;
  materialCatalogId: string | null;
  laborRoleId: string | null;
  code: string | null;
  description: string;
  unit: string;
  zoneQuantities: ZoneQuantities;
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  markupMultiplier: number;
  teamsCount: number;
  sourceSoftware: string;
  sourceFileId: string | null;
  sourcePage: number | null;
  sanityFlag: string | null;
  revisionTag: string;
  orderIndex: number;
  rawQuantity: number;
  totalQtyWithLoss: number;
  unitDirectCost: number;
  unitCommercialPrice: number;
  totalMaterial: number;
  totalLabor: number;
  totalThirdParty: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
  weightPercent: number;
}

export interface ComputedEapGroupDTO {
  id: string;
  code: string;
  name: string;
  orderIndex: number;
  items: ComputedEapItemDTO[];
  totalDirectCost: number;
  totalCommercialPrice: number;
}

export interface ComputedEapStageDTO {
  id: string;
  code: string;
  name: string;
  orderIndex: number;
  groups: ComputedEapGroupDTO[];
  itemsCount: number;
  totalMaterial: number;
  totalLabor: number;
  totalThirdParty: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
  weightPercent: number;
}

export interface EapTreeIndicatorsDTO {
  builtAreaM2: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalThirdPartyCost: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
  directCostPerM2: number;
  costPerM2: number;
  steelRateKgPerM3: number;
  concreteM3PerM2: number;
  masonryM2PerM2: number;
  materialSharePercent: number;
  laborSharePercent: number;
  thirdPartySharePercent: number;
}

export interface ConferenceGateResult {
  approved: boolean;
  blockers: string[];
  summary: {
    pendingConflictsCount: number;
    itemsWithoutPriceCount: number;
    sanityAlertsCount: number;
    pricedItemsCount: number;
  };
}

export function normalizeZoneQuantities(raw: unknown): ZoneQuantities {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    FUND_TERREO: Number(obj.FUND_TERREO) || 0,
    PAV_SUPERIOR: Number(obj.PAV_SUPERIOR) || 0,
    COBERTURA: Number(obj.COBERTURA) || 0,
    EXTERNO: Number(obj.EXTERNO) || 0,
  };
}

export function resolveRevisionTag(
  previous: {
    code?: string | null;
    description?: string;
    unit?: string;
    zoneQuantitiesJson: unknown;
    lossPercent: number;
    materialUnitCost: number;
    laborUnitCost: number;
    thirdPartyUnitCost: number;
    markupMultiplier: number;
    revisionTag: string;
  },
  patch: {
    code?: string | null;
    description?: string;
    unit?: string;
    zoneQuantities?: Partial<ZoneQuantities>;
    lossPercent?: number;
    materialUnitCost?: number;
    laborUnitCost?: number;
    thirdPartyUnitCost?: number;
    markupMultiplier?: number;
    clearSanityFlag?: boolean;
  }
): string {
  const prevZones = normalizeZoneQuantities(previous.zoneQuantitiesJson);
  const qtyChanged =
    (patch.zoneQuantities !== undefined &&
      ((patch.zoneQuantities.FUND_TERREO !== undefined &&
        patch.zoneQuantities.FUND_TERREO !== prevZones.FUND_TERREO) ||
        (patch.zoneQuantities.PAV_SUPERIOR !== undefined &&
          patch.zoneQuantities.PAV_SUPERIOR !== prevZones.PAV_SUPERIOR) ||
        (patch.zoneQuantities.COBERTURA !== undefined &&
          patch.zoneQuantities.COBERTURA !== prevZones.COBERTURA) ||
        (patch.zoneQuantities.EXTERNO !== undefined &&
          patch.zoneQuantities.EXTERNO !== prevZones.EXTERNO))) ||
    (patch.lossPercent !== undefined && patch.lossPercent !== previous.lossPercent);

  const costChanged =
    (patch.materialUnitCost !== undefined && patch.materialUnitCost !== previous.materialUnitCost) ||
    (patch.laborUnitCost !== undefined && patch.laborUnitCost !== previous.laborUnitCost) ||
    (patch.thirdPartyUnitCost !== undefined && patch.thirdPartyUnitCost !== previous.thirdPartyUnitCost) ||
    (patch.markupMultiplier !== undefined && patch.markupMultiplier !== previous.markupMultiplier);

  const metaChanged =
    (patch.description !== undefined &&
      previous.description !== undefined &&
      patch.description.trim() !== previous.description) ||
    (patch.unit !== undefined &&
      previous.unit !== undefined &&
      patch.unit.trim() !== previous.unit) ||
    (patch.code !== undefined &&
      (patch.code?.trim().toUpperCase() || null) !== (previous.code || null)) ||
    Boolean(patch.clearSanityFlag);

  if (previous.revisionTag === "ADICIONADO") return "ADICIONADO";
  if (qtyChanged) return "QUANTIDADE_ALTERADA";
  if (costChanged) return "CUSTO_ALTERADO";
  if (metaChanged) return "EDITADO_MANUAL";
  return previous.revisionTag || "ORIGINAL";
}

export function buildEapTreePayload(input: {
  id: string;
  projectId: string;
  cityId: string;
  cityLabel: string;
  title: string;
  builtAreaM2: number;
  bdiPercent: number;
  plannedStartDate: Date | string | null;
  status: string;
  currentRevision: number;
  premisesJson: unknown;
  exclusionsJson: unknown;
  zones: Array<{ id: string; code: string; name: string; orderIndex: number }>;
  stages: Array<{
    id: string;
    code: string;
    name: string;
    orderIndex: number;
    groups: Array<{
      id: string;
      code: string;
      name: string;
      orderIndex: number;
      items: RawEapItemRecord[];
    }>;
  }>;
  conflicts: Array<{ id: string; status: string }>;
}) {
  const flatCalcInputs: Array<{
    stageCode: string;
    description: string;
    unit: string;
    zoneQuantities: ZoneQuantities;
    lossPercent: number;
    materialUnitCost: number;
    laborUnitCost: number;
    thirdPartyUnitCost: number;
    markupMultiplier: number;
  }> = [];

  let grandMaterial = 0;
  let grandLabor = 0;
  let grandThirdParty = 0;
  let grandDirect = 0;
  let grandCommercial = 0;

  const preliminaryStages = input.stages.map((stage) => {
    let stageMat = 0;
    let stageLab = 0;
    let stageThird = 0;
    let stageDirect = 0;
    let stageComm = 0;
    let stageItemsCount = 0;

    const groups = stage.groups.map((group) => {
      let groupDirect = 0;
      let groupComm = 0;

      const items = group.items.map((item) => {
        const zq = normalizeZoneQuantities(item.zoneQuantitiesJson);
        const calc = computeEapLine({
          code: item.code,
          stageCode: stage.code,
          description: item.description,
          unit: item.unit,
          zoneQuantities: zq,
          lossPercent: item.lossPercent,
          materialUnitCost: item.materialUnitCost,
          laborUnitCost: item.laborUnitCost,
          thirdPartyUnitCost: item.thirdPartyUnitCost,
          markupMultiplier: item.markupMultiplier,
        });

        flatCalcInputs.push({
          stageCode: stage.code,
          description: item.description,
          unit: item.unit,
          zoneQuantities: zq,
          lossPercent: item.lossPercent,
          materialUnitCost: item.materialUnitCost,
          laborUnitCost: item.laborUnitCost,
          thirdPartyUnitCost: item.thirdPartyUnitCost,
          markupMultiplier: item.markupMultiplier,
        });

        stageMat += calc.totalMaterialCost;
        stageLab += calc.totalLaborCost;
        stageThird += calc.totalThirdPartyCost;
        stageDirect += calc.totalDirectCost;
        stageComm += calc.totalCommercialPrice;
        stageItemsCount += 1;
        groupDirect += calc.totalDirectCost;
        groupComm += calc.totalCommercialPrice;

        return {
          ...item,
          stageCode: stage.code,
          zoneQuantities: zq,
          rawQuantity: calc.rawQuantity,
          totalQtyWithLoss: calc.quantityWithLoss,
          unitDirectCost: calc.directUnitCost,
          unitCommercialPrice: calc.commercialUnitPrice,
          totalMaterial: calc.totalMaterialCost,
          totalLabor: calc.totalLaborCost,
          totalThirdParty: calc.totalThirdPartyCost,
          totalDirectCost: calc.totalDirectCost,
          totalCommercialPrice: calc.totalCommercialPrice,
          weightPercent: 0,
        };
      });

      return {
        id: group.id,
        code: group.code,
        name: group.name,
        orderIndex: group.orderIndex,
        items,
        totalDirectCost: round2(groupDirect),
        totalCommercialPrice: round2(groupComm),
      };
    });

    grandMaterial += stageMat;
    grandLabor += stageLab;
    grandThirdParty += stageThird;
    grandDirect += stageDirect;
    grandCommercial += stageComm;

    return {
      id: stage.id,
      code: stage.code,
      name: stage.name,
      orderIndex: stage.orderIndex,
      groups,
      itemsCount: stageItemsCount,
      totalMaterial: round2(stageMat),
      totalLabor: round2(stageLab),
      totalThirdParty: round2(stageThird),
      totalDirectCost: round2(stageDirect),
      totalCommercialPrice: round2(stageComm),
      weightPercent: 0,
    };
  });

  const safeGrandComm = round2(grandCommercial);
  const safeGrandDirect = round2(grandDirect);

  const stages: ComputedEapStageDTO[] = preliminaryStages.map((st) => ({
    ...st,
    weightPercent: safeGrandComm > 0 ? round2((st.totalCommercialPrice / safeGrandComm) * 100) : 0,
    groups: st.groups.map((g) => ({
      ...g,
      items: g.items.map((it) => ({
        ...it,
        weightPercent: safeGrandComm > 0 ? round2((it.totalCommercialPrice / safeGrandComm) * 100) : 0,
      })),
    })),
  }));

  const eng = computeEapEngineeringIndicators(flatCalcInputs, input.builtAreaM2);
  const indicators: EapTreeIndicatorsDTO = {
    builtAreaM2: eng.builtAreaM2,
    totalMaterialCost: round2(grandMaterial),
    totalLaborCost: round2(grandLabor),
    totalThirdPartyCost: round2(grandThirdParty),
    totalDirectCost: safeGrandDirect,
    totalCommercialPrice: safeGrandComm,
    directCostPerM2: eng.directCostPerM2,
    costPerM2: eng.commercialCostPerM2,
    steelRateKgPerM3: eng.steelRateKgPerM3,
    concreteM3PerM2: eng.concreteM3PerM2,
    masonryM2PerM2: eng.masonryM2PerM2,
    materialSharePercent: safeGrandDirect > 0 ? round2((grandMaterial / safeGrandDirect) * 100) : 0,
    laborSharePercent: safeGrandDirect > 0 ? round2((grandLabor / safeGrandDirect) * 100) : 0,
    thirdPartySharePercent: safeGrandDirect > 0 ? round2((grandThirdParty / safeGrandDirect) * 100) : 0,
  };

  const allItems = stages.flatMap((s) => s.groups.flatMap((g) => g.items));
  const conferenceGate = evaluateConferenceGate({
    items: allItems,
    conflicts: input.conflicts,
  });

  const premises = Array.isArray(input.premisesJson)
    ? input.premisesJson.map(String)
    : [];
  const exclusions = Array.isArray(input.exclusionsJson)
    ? input.exclusionsJson.map(String)
    : [];

  return {
    id: input.id,
    projectId: input.projectId,
    cityId: input.cityId,
    cityLabel: input.cityLabel,
    title: input.title,
    builtAreaM2: input.builtAreaM2,
    bdiPercent: input.bdiPercent,
    plannedStartDate:
      input.plannedStartDate instanceof Date
        ? input.plannedStartDate.toISOString().slice(0, 10)
        : input.plannedStartDate
          ? String(input.plannedStartDate).slice(0, 10)
          : null,
    status: input.status,
    currentRevision: input.currentRevision,
    premises,
    exclusions,
    zones: input.zones,
    stages,
    indicators,
    conferenceGate,
  };
}

export function evaluateConferenceGate(input: {
  items: Array<{
    totalQtyWithLoss: number;
    unitDirectCost: number;
    sanityFlag: string | null;
  }>;
  conflicts: Array<{ status: string }>;
}): ConferenceGateResult {
  const pendingConflictsCount = input.conflicts.filter(
    (c) => c.status !== "RESOLVIDO" && c.status !== "SOBRESCRITO_HUMANO"
  ).length;
  const itemsWithoutPriceCount = input.items.filter(
    (i) => i.totalQtyWithLoss > 0 && i.unitDirectCost <= 0
  ).length;
  const sanityAlertsCount = input.items.filter((i) => Boolean(i.sanityFlag)).length;
  const pricedItemsCount = input.items.filter(
    (i) => i.totalQtyWithLoss > 0 && i.unitDirectCost > 0
  ).length;

  const blockers: string[] = [];
  if (pendingConflictsCount > 0) {
    blockers.push(`${pendingConflictsCount} conflito(s) TQS × Revit pendente(s) de revisão.`);
  }
  if (itemsWithoutPriceCount > 0) {
    blockers.push(`${itemsWithoutPriceCount} item(ns) com quantidade > 0 sem preço unitário definido.`);
  }
  if (sanityAlertsCount > 0) {
    blockers.push(`${sanityAlertsCount} alerta(s) de sanidade dimensional pendente(s) de confirmação.`);
  }
  if (pricedItemsCount === 0) {
    blockers.push("É necessário pelo menos 1 item ativo precificado na EAP.");
  }

  return {
    approved: blockers.length === 0,
    blockers,
    summary: {
      pendingConflictsCount,
      itemsWithoutPriceCount,
      sanityAlertsCount,
      pricedItemsCount,
    },
  };
}
