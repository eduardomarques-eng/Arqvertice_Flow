import {
  computeEapEngineeringIndicators,
  computeEapLine,
  round2,
  round4,
  type ZoneQuantities,
} from "@/server/eap/calculator";
import type {
  ComputedEapItemDTO,
  ComputedEapStageDTO,
  ConferenceGateResult,
  EapTreeIndicatorsDTO,
} from "@/server/eap/workbench";

export interface SpreadsheetTreeShape {
  id: string;
  projectId: string;
  cityId: string;
  cityLabel: string;
  title: string;
  builtAreaM2: number;
  bdiPercent: number;
  plannedStartDate: string | null;
  status: string;
  currentRevision: number;
  premises: string[];
  exclusions: string[];
  zones: Array<{ id: string; code: string; name: string; orderIndex: number }>;
  stages: ComputedEapStageDTO[];
  indicators: EapTreeIndicatorsDTO;
  conferenceGate: ConferenceGateResult;
}

/**
 * Converte entradas pt-BR ("1.250,50", "R$ 420,00", "12,5") ou en-US ("1250.5") para número >= 0.
 * Strings vazias retornam 0 para manter células em branco seguras nos cálculos.
 */
export function parsePtBrNumber(raw: string): number {
  const cleaned = raw
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") {
    return 0;
  }

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Formata quantidades em pt-BR (vírgula decimal). Retorna "" quando o valor for 0
 * para não poluir visualmente células não preenchidas.
 */
export function formatPtBrQty(value: number, blankIfZero = true): string {
  const num = Number.isFinite(value) ? value : 0;
  if (blankIfZero && num <= 0) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata moeda brasileira (R$ 1.234,56). Quando `blankIfZero` é true e valor <= 0, retorna "".
 */
export function formatPtBrCurrency(value: number, blankIfZero = false): string {
  const num = Number.isFinite(value) ? value : 0;
  if (blankIfZero && num <= 0) return "";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Formata número decimal em pt-BR sem prefixo R$ para edição inline na célula.
 */
export function formatPtBrDecimalInput(value: number, blankIfZero = true): string {
  const num = Number.isFinite(value) ? value : 0;
  if (blankIfZero && num <= 0) return "";
  return num.toLocaleString("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Ao editar diretamente a coluna PR. UNITÁRIO (valor comercial unitário),
 * redistribui o custo direto mantendo o `markupMultiplier` da linha.
 */
export function applyCommercialUnitPrice(
  item: Pick<
    ComputedEapItemDTO,
    "materialUnitCost" | "laborUnitCost" | "thirdPartyUnitCost" | "markupMultiplier"
  >,
  newCommercialUnitPrice: number
): {
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
} {
  const price = Math.max(0, Number.isFinite(newCommercialUnitPrice) ? newCommercialUnitPrice : 0);
  const markup = item.markupMultiplier > 0 ? item.markupMultiplier : 1;
  const targetDirect = round4(price / markup);

  const currentDirect =
    (item.materialUnitCost || 0) +
    (item.laborUnitCost || 0) +
    (item.thirdPartyUnitCost || 0);

  if (targetDirect <= 0) {
    return {
      materialUnitCost: 0,
      laborUnitCost: 0,
      thirdPartyUnitCost: 0,
    };
  }

  if (currentDirect > 0) {
    const ratio = targetDirect / currentDirect;
    const mat = round4((item.materialUnitCost || 0) * ratio);
    const lab = round4((item.laborUnitCost || 0) * ratio);
    const third = round4(Math.max(0, targetDirect - mat - lab));
    return {
      materialUnitCost: mat,
      laborUnitCost: lab,
      thirdPartyUnitCost: third,
    };
  }

  return {
    materialUnitCost: targetDirect,
    laborUnitCost: 0,
    thirdPartyUnitCost: 0,
  };
}

/**
 * Recalcula em tempo real todas as linhas, subgrupos, macro-etapas, pesos %
 * e indicadores globais de uma árvore EAP no cliente.
 */
export function recomputeTreeTotals<T extends SpreadsheetTreeShape>(tree: T): T {
  const flatInputs: Array<{
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

  const preliminaryStages: ComputedEapStageDTO[] = tree.stages.map((stage) => {
    let stageMat = 0;
    let stageLab = 0;
    let stageThird = 0;
    let stageDirect = 0;
    let stageComm = 0;
    let stageItemsCount = 0;

    const groups = stage.groups.map((group) => {
      let groupDirect = 0;
      let groupComm = 0;

      const items: ComputedEapItemDTO[] = group.items.map((item) => {
        const zq: ZoneQuantities = {
          FUND_TERREO: Number(item.zoneQuantities.FUND_TERREO) || 0,
          PAV_SUPERIOR: Number(item.zoneQuantities.PAV_SUPERIOR) || 0,
          COBERTURA: Number(item.zoneQuantities.COBERTURA) || 0,
          EXTERNO: Number(item.zoneQuantities.EXTERNO) || 0,
        };

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

        flatInputs.push({
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
        };
      });

      return {
        ...group,
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
      ...stage,
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

  const safeGrandDirect = round2(grandDirect);
  const safeGrandComm = round2(grandCommercial);

  const stages = preliminaryStages.map((st) => ({
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

  const eng = computeEapEngineeringIndicators(flatInputs, tree.builtAreaM2);
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
  const itemsWithoutPriceCount = allItems.filter(
    (i) => i.totalQtyWithLoss > 0 && i.unitDirectCost <= 0
  ).length;
  const sanityAlertsCount = allItems.filter((i) => Boolean(i.sanityFlag)).length;
  const pricedItemsCount = allItems.filter(
    (i) => i.totalQtyWithLoss > 0 && i.unitDirectCost > 0
  ).length;

  return {
    ...tree,
    stages,
    indicators,
    conferenceGate: {
      ...tree.conferenceGate,
      summary: {
        ...tree.conferenceGate.summary,
        itemsWithoutPriceCount,
        sanityAlertsCount,
        pricedItemsCount,
      },
    },
  };
}

/**
 * Converte texto copiado do Excel / Google Sheets (\t e \n) em matriz de células.
 */
export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.map((line) => line.split("\t"));
}

/**
 * Reordena um item dentro de um grupo (para cima ou para baixo) e renumera orderIndex 1..N.
 */
export function reorderItemsInList<T extends { id: string; orderIndex: number }>(
  items: T[],
  itemId: string,
  direction: "up" | "down"
): T[] {
  const idx = items.findIndex((it) => it.id === itemId);
  if (idx < 0) return items;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= items.length) return items;

  const copy = [...items];
  const [moved] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, moved);
  return copy.map((it, i) => ({ ...it, orderIndex: i + 1 }));
}

/**
 * Gera payload de duplicação preservando unidade, composição e preço unitário,
 * mas com quantidades zeradas para agilizar o lançamento de serviços semelhantes.
 */
export function createDuplicateItemPayload(
  item: Pick<
    ComputedEapItemDTO,
    | "groupId"
    | "stageCode"
    | "materialCatalogId"
    | "laborRoleId"
    | "code"
    | "description"
    | "unit"
    | "lossPercent"
    | "materialUnitCost"
    | "laborUnitCost"
    | "thirdPartyUnitCost"
    | "markupMultiplier"
    | "teamsCount"
  >
) {
  return {
    stageCode: item.stageCode,
    groupId: item.groupId,
    materialCatalogId: item.materialCatalogId,
    laborRoleId: item.laborRoleId,
    code: item.code,
    description: `${item.description} (Cópia)`,
    unit: item.unit,
    zoneQuantities: {
      FUND_TERREO: 0,
      PAV_SUPERIOR: 0,
      COBERTURA: 0,
      EXTERNO: 0,
    },
    lossPercent: item.lossPercent,
    materialUnitCost: item.materialUnitCost,
    laborUnitCost: item.laborUnitCost,
    thirdPartyUnitCost: item.thirdPartyUnitCost,
    markupMultiplier: item.markupMultiplier,
    teamsCount: item.teamsCount,
  };
}

