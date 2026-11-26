import { prisma } from "@/server/db";
import { computeEapLine, round2 } from "./calculator";
import { generateProcurementPlanForProject } from "./procurement-plan";
import { normalizeZoneQuantities } from "./workbench";

export interface CanonicalEapTotalsInput {
  items: Array<{
    totalMaterial: number;
    totalLabor: number;
    totalThirdParty: number;
    totalDirectCost?: number;
  }>;
  bdiPercent: number;
  builtAreaM2: number;
}

export interface CanonicalEapTotalsResult {
  totalMaterialCost: number;
  totalLaborCost: number;
  totalThirdPartyCost: number;
  totalDirectCost: number;
  bdiPercent: number;
  bdiValue: number;
  totalCommercialPrice: number;
  directCostPerM2: number;
  costPerM2: number;
}

/**
 * Função canônica única de fechamento financeiro da EAP:
 * garante Σ(Material + Mão de Obra + Terceiros) === Total Direto
 * e Total Geral === Total Direto × (1 + BDI / 100).
 */
export function computeCanonicalEapTotals(
  input: CanonicalEapTotalsInput
): CanonicalEapTotalsResult {
  let totalMaterial = 0;
  let totalLabor = 0;
  let totalThirdParty = 0;

  for (const item of input.items) {
    totalMaterial += item.totalMaterial || 0;
    totalLabor += item.totalLabor || 0;
    totalThirdParty += item.totalThirdParty || 0;
  }

  const totalMaterialCost = round2(totalMaterial);
  const totalLaborCost = round2(totalLabor);
  const totalThirdPartyCost = round2(totalThirdParty);
  const totalDirectCost = round2(totalMaterialCost + totalLaborCost + totalThirdPartyCost);

  const bdiPercent = Math.max(0, Number(input.bdiPercent) || 0);
  const bdiValue = round2(totalDirectCost * (bdiPercent / 100));
  const totalCommercialPrice = round2(totalDirectCost + bdiValue);

  const area = input.builtAreaM2 > 0 ? input.builtAreaM2 : 1;

  return {
    totalMaterialCost,
    totalLaborCost,
    totalThirdPartyCost,
    totalDirectCost,
    bdiPercent,
    bdiValue,
    totalCommercialPrice,
    directCostPerM2: round2(totalDirectCost / area),
    costPerM2: round2(totalCommercialPrice / area),
  };
}

/**
 * Sincroniza em cascata Aquisições e Boletins em RASCUNHO após qualquer alteração na EAP.
 * - Preserva integralmente itens de compra em cotação, pedido emitido, entregues ou já vinculados ao Financeiro.
 * - Preserva integralmente Boletins de Medição com status APROVADO.
 */
export async function cascadeSyncEapProject(projectId: string): Promise<{
  syncedProcurement: boolean;
  updatedDraftBulletins: number;
  removedOrphanDraftEntries: number;
}> {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
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
        where: { status: "RASCUNHO" },
        include: { entries: true },
      },
    },
  });

  if (!eap) {
    return {
      syncedProcurement: false,
      updatedDraftBulletins: 0,
      removedOrphanDraftEntries: 0,
    };
  }

  let syncedProcurement = false;
  try {
    await generateProcurementPlanForProject(projectId);
    syncedProcurement = true;
  } catch {
    syncedProcurement = false;
  }

  // Mapa atual de itens da EAP para ressincronizar boletins apenas em RASCUNHO
  const itemMetaById = new Map<
    string,
    {
      description: string;
      unit: string;
      zoneQuantities: ReturnType<typeof normalizeZoneQuantities>;
      totalQtyWithLoss: number;
      unitPrice: number;
    }
  >();

  const bdiMult = 1 + Math.max(0, eap.bdiPercent || 0) / 100;

  for (const st of eap.stages) {
    for (const grp of st.groups) {
      for (const item of grp.items) {
        const zq = normalizeZoneQuantities(item.zoneQuantitiesJson);
        const calc = computeEapLine({
          code: item.code,
          stageCode: st.code,
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
          calc.commercialUnitPrice > calc.directUnitCost + 0.005
            ? calc.commercialUnitPrice
            : round2(calc.directUnitCost * bdiMult);

        itemMetaById.set(item.id, {
          description: item.description,
          unit: item.unit,
          zoneQuantities: zq,
          totalQtyWithLoss: calc.quantityWithLoss,
          unitPrice,
        });
      }
    }
  }

  let updatedDraftBulletins = 0;
  let removedOrphanDraftEntries = 0;

  for (const bulletin of eap.fieldMeasurementBulletins) {
    if (bulletin.status !== "RASCUNHO") continue;

    const orphanIds = bulletin.entries
      .filter((e) => Boolean(e.eapItemId) && !itemMetaById.has(e.eapItemId!))
      .map((e) => e.id);

    if (orphanIds.length > 0) {
      await prisma.eapFieldMeasurementEntry.deleteMany({
        where: { id: { in: orphanIds } },
      });
      removedOrphanDraftEntries += orphanIds.length;
    }

    let bulletinModified = orphanIds.length > 0;
    const survivingEntries = bulletin.entries.filter((e) => !orphanIds.includes(e.id));

    for (const entry of survivingEntries) {
      if (!entry.eapItemId) continue;
      const current = itemMetaById.get(entry.eapItemId);
      if (!current) continue;

      // Calcula quantidade planejada da zona correspondente ao pavimento do apontamento
      let plannedQty = entry.plannedQty;
      const lossMult =
        current.zoneQuantities.FUND_TERREO +
          current.zoneQuantities.PAV_SUPERIOR +
          current.zoneQuantities.COBERTURA +
          current.zoneQuantities.EXTERNO >
        0
          ? current.totalQtyWithLoss /
            (current.zoneQuantities.FUND_TERREO +
              current.zoneQuantities.PAV_SUPERIOR +
              current.zoneQuantities.COBERTURA +
              current.zoneQuantities.EXTERNO)
          : 1;

      if (entry.floorId === "FUNDACAO" || entry.floorId === "TERREO") {
        plannedQty = round2(current.zoneQuantities.FUND_TERREO * lossMult);
      } else if (entry.floorId === "PAV_SUPERIOR") {
        plannedQty = round2(current.zoneQuantities.PAV_SUPERIOR * lossMult);
      } else if (entry.floorId === "COBERTA" || entry.floorId === "COBERTURA") {
        plannedQty = round2(current.zoneQuantities.COBERTURA * lossMult);
      } else if (entry.floorId === "AREA_EXTERNA" || entry.floorId === "EXTERNO") {
        plannedQty = round2(current.zoneQuantities.EXTERNO * lossMult);
      }

      const accQty = round2(entry.previousExecutedQty + entry.currentExecutedQty);
      const accumulatedPct =
        plannedQty > 0 ? Math.min(100, round2((accQty / plannedQty) * 100)) : 0;
      const measuredAmount = round2(entry.currentExecutedQty * current.unitPrice);

      if (
        Math.abs(plannedQty - entry.plannedQty) > 0.01 ||
        Math.abs(current.unitPrice - entry.unitPrice) > 0.01 ||
        entry.serviceLabel !== current.description
      ) {
        await prisma.eapFieldMeasurementEntry.update({
          where: { id: entry.id },
          data: {
            serviceLabel: current.description,
            unit: current.unit,
            plannedQty,
            unitPrice: current.unitPrice,
            accumulatedPct,
            measuredAmount,
          },
        });
        bulletinModified = true;
      }
    }

    if (bulletinModified) {
      updatedDraftBulletins += 1;
    }
  }

  return {
    syncedProcurement,
    updatedDraftBulletins,
    removedOrphanDraftEntries,
  };
}
