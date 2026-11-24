import { sumZoneQuantities } from "./calculator";
import type { MinedEapCandidate } from "./parsers/types";

export interface RegionalMaterialLookup {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  defaultLossPercent: number;
  eapStageCode: string;
  materialUnitCost: number;
  thirdPartyUnitCost: number;
}

export interface RegionalLaborLookup {
  id: string;
  code: string;
  name: string;
  unit: string;
  laborUnitCost: number;
}

export interface ReconciledEapItem {
  description: string;
  unit: string;
  zoneQuantities: MinedEapCandidate["zoneQuantities"];
  eapStageCode: string;
  rawCategory: string;
  materialCatalogId: string | null;
  laborRoleId: string | null;
  code: string | null;
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  sourceSoftware: MinedEapCandidate["sourceSoftware"];
  sourceFileId: string | null;
  sourcePage: number;
  sanityFlag: string | null;
}

export interface ReconciledConflict {
  category: string;
  itemDescription: string;
  winningSource: "TQS" | "REVIT" | "MANUAL";
  discardedSource: string;
  winningQty: number;
  discardedQty: number;
  unit: string;
  reason: string;
  status: "BLOQUEADO_AUTO" | "SOBRESCRITO_HUMANO" | "RESOLVIDO";
}

export interface ReconcileOutput {
  acceptedItems: ReconciledEapItem[];
  conflicts: ReconciledConflict[];
  sanityWarnings: string[];
  steelRateKgPerM3: number | null;
}

export interface OutdatedSourceCheck {
  sourceFileId: string;
  acervoDocumentId: string;
  currentSourceRevision: string;
  latestAcervoRevision: string;
}

function normalizeUnit(u: string): string {
  return u.trim().toLowerCase().replace("m3", "m³").replace("m2", "m²");
}

function findMatchingMaterial(
  candidate: MinedEapCandidate,
  materials: RegionalMaterialLookup[]
): RegionalMaterialLookup | null {
  if (candidate.materialHintCode) {
    const exact = materials.find((m) => m.code.toUpperCase() === candidate.materialHintCode!.toUpperCase());
    if (exact) return exact;
  }
  return (
    materials.find(
      (m) =>
        m.category.toUpperCase() === candidate.rawCategory.toUpperCase() &&
        normalizeUnit(m.unit) === normalizeUnit(candidate.unit)
    ) ?? null
  );
}

function findMatchingLabor(
  candidate: MinedEapCandidate,
  laborRoles: RegionalLaborLookup[]
): RegionalLaborLookup | null {
  if (candidate.laborHintCode) {
    const exact = laborRoles.find((l) => l.code.toUpperCase() === candidate.laborHintCode!.toUpperCase());
    if (exact) return exact;
  }
  return null;
}

/**
 * Motor de Compatibilização Anti-Duplicidade (TQS × Revit), Auditoria de Sanidade Dimensional
 * e Auto-Binding com a Tabela Regional de Preços da Cidade.
 */
export function reconcileMinedCandidates(input: {
  candidates: MinedEapCandidate[];
  hasTqsSource: boolean;
  builtAreaM2?: number;
  cityMaterials: RegionalMaterialLookup[];
  cityLabor: RegionalLaborLookup[];
}): ReconcileOutput {
  const { candidates, hasTqsSource, cityMaterials, cityLabor } = input;
  const acceptedItems: ReconciledEapItem[] = [];
  const conflicts: ReconciledConflict[] = [];
  const sanityWarnings: string[] = [];

  // Mapa de elementos já aceitos por chave para detectar duplicidade interna entre arquivos da mesma fonte
  const seenKeys = new Map<string, { qty: number; sourceFileId: string | null; unit: string }>();

  // Soma prévia de concreto estrutural TQS (para checagem de proporção de vergas e taxa de aço)
  let totalConcreteM3 = 0;
  let totalSteelKg = 0;

  for (const cand of candidates) {
    const qty = sumZoneQuantities(cand.zoneQuantities);

    // 1. MATRIZ DE AUTORIDADE TQS × REVIT:
    // Quando há fonte TQS ativa, qualquer item estrutural vindo do Revit é bloqueado automaticamente.
    if (hasTqsSource && cand.sourceSoftware === "REVIT" && cand.isStructural) {
      conflicts.push({
        category: cand.rawCategory,
        itemDescription: cand.description,
        winningSource: "TQS",
        discardedSource: "REVIT",
        winningQty: 0,
        discardedQty: qty,
        unit: cand.unit,
        reason:
          "Regra anti-duplicidade TQS × Revit: elementos estruturais (aço, concreto, pilares, vigas, lajes e fundações) têm autoridade exclusiva do TQS.",
        status: "BLOQUEADO_AUTO",
      });
      continue;
    }

    // 2. DUPLICIDADE INTERNA ENTRE ARQUIVOS DA MESMA FONTE
    if (cand.elementKey) {
      const existing = seenKeys.get(cand.elementKey);
      if (existing && existing.sourceFileId && cand.sourceFileId && existing.sourceFileId !== cand.sourceFileId) {
        conflicts.push({
          category: cand.rawCategory,
          itemDescription: cand.description,
          winningSource: cand.sourceSoftware,
          discardedSource: `${cand.sourceSoftware} (arquivo duplicado)`,
          winningQty: existing.qty,
          discardedQty: qty,
          unit: cand.unit,
          reason: `Elemento/pavimento já minerado em outro arquivo ${cand.sourceSoftware}. Bloqueado para revisão humana.`,
          status: "BLOQUEADO_AUTO",
        });
        continue;
      }
      seenKeys.set(cand.elementKey, { qty, sourceFileId: cand.sourceFileId ?? null, unit: cand.unit });
    }

    // 3. AUTO-BINDING COM CATÁLOGO REGIONAL DA CIDADE
    const mat = findMatchingMaterial(cand, cityMaterials);
    const lab = findMatchingLabor(cand, cityLabor);

    // 4. AUDITORIA DE SANIDADE DIMENSIONAL, UNIDADE & PREÇO DEFASADO
    const flags: string[] = [];
    if (cand.sanityFlag) {
      flags.push(cand.sanityFlag);
      sanityWarnings.push(cand.sanityFlag);
    }

    if (!Number.isFinite(qty) || qty < 0) {
      flags.push("QUANTIDADE_INVALIDA: Quantidade negativa ou NaN detectada.");
    }

    const normCandUnit = normalizeUnit(cand.unit);
    if (mat && normalizeUnit(mat.unit) !== normCandUnit) {
      flags.push(
        `UNIDADE_INCOMPATIVEL: Item minerado em '${cand.unit}', mas catálogo '${mat.code}' utiliza '${mat.unit}'.`
      );
    }

    // Rejeita preço defasado do HTML (ex.: R$ 6,80/m² no TQS) se divergir > 50% do catálogo regional
    if (mat && typeof cand.sourceUnitPrice === "number" && cand.sourceUnitPrice > 0) {
      const regionalPrice = (mat.materialUnitCost || 0) + (mat.thirdPartyUnitCost || 0);
      if (regionalPrice > 0 && Math.abs(cand.sourceUnitPrice - regionalPrice) / regionalPrice > 0.5) {
        const msg = `PRECO_HTML_IGNORADO: Preço da fonte (R$ ${cand.sourceUnitPrice.toFixed(2).replace(".", ",")}/${cand.unit}) diverge >50% do catálogo regional (R$ ${regionalPrice.toFixed(2).replace(".", ",")}/${mat.unit}). Aplicado valor oficial da praça.`;
        flags.push(msg);
        sanityWarnings.push(msg);
      }
    }

    // Proteção contra erro clássico de lançar metro linear de verga/contraverga em campo de m³
    if (/verga|contraverga/i.test(cand.description) && normCandUnit === "m³" && qty > 10) {
      flags.push(
        `ANOMALIA_UNIDADE_M3: Volume de ${qty.toFixed(2)} m³ desproporcional para verga/contraverga (possível lançamento em metro linear no campo de m³).`
      );
      sanityWarnings.push(
        `Alerta dimensional em "${cand.description}": ${qty.toFixed(2)} m³ excede o limite esperado para vergas.`
      );
    }

    if (cand.rawCategory === "CONCRETO" && normCandUnit === "m³") {
      totalConcreteM3 += qty;
    }
    if (cand.rawCategory === "ACO" && normCandUnit === "kg") {
      totalSteelKg += qty;
    }

    acceptedItems.push({
      description: cand.description,
      unit: cand.unit,
      zoneQuantities: cand.zoneQuantities,
      eapStageCode: cand.eapStageCode,
      rawCategory: cand.rawCategory,
      materialCatalogId: mat?.id ?? null,
      laborRoleId: lab?.id ?? null,
      code: mat?.code ?? null,
      lossPercent: mat?.defaultLossPercent ?? 0,
      materialUnitCost: mat?.materialUnitCost ?? 0,
      laborUnitCost: lab?.laborUnitCost ?? 0,
      thirdPartyUnitCost: mat?.thirdPartyUnitCost ?? 0,
      sourceSoftware: cand.sourceSoftware,
      sourceFileId: cand.sourceFileId ?? null,
      sourcePage: cand.sourcePage,
      sanityFlag: flags.length > 0 ? flags.join(" | ") : null,
    });
  }

  // 5. AUDITORIA DE TAXA DE AÇO PONDERADA (kg/m³)
  let steelRateKgPerM3: number | null = null;
  if (totalConcreteM3 > 0 && totalSteelKg > 0) {
    steelRateKgPerM3 = Math.round((totalSteelKg / totalConcreteM3) * 100) / 100;
    if (steelRateKgPerM3 < 25 || steelRateKgPerM3 > 220) {
      const msg = `TAXA_ACO_FORA_FAIXA: Taxa ponderada de ${steelRateKgPerM3} kg/m³ fora da faixa residencial esperada (25–220 kg/m³).`;
      sanityWarnings.push(msg);
      for (const item of acceptedItems) {
        if (item.rawCategory === "ACO") {
          item.sanityFlag = item.sanityFlag ? `${item.sanityFlag} | ${msg}` : msg;
        }
      }
    }
  } else if (hasTqsSource && totalConcreteM3 > 0 && totalSteelKg === 0) {
    steelRateKgPerM3 = 0;
    const msg = `ACO_PRINCIPAL_ZERADO: Concreto (${totalConcreteM3.toFixed(2)} m³) sem aço principal detalhado no TQS (estimativa sugerida: ${Math.round(totalConcreteM3 * 85)} kg).`;
    if (!sanityWarnings.some((w) => w.includes("aço principal"))) {
      sanityWarnings.push(msg);
    }
  }

  return {
    acceptedItems,
    conflicts,
    sanityWarnings,
    steelRateKgPerM3,
  };
}

/**
 * Compara os arquivos vinculados à EAP com as revisões atuais do Acervo Manager (somente leitura)
 * e identifica documentos cuja revisão foi atualizada no Acervo.
 */
export function detectOutdatedAcervoSources(
  eapSources: Array<{
    id: string;
    acervoDocumentId: string | null;
    revisionLabel: string;
  }>,
  acervoDocs: Array<{
    id: string;
    latestRevisionNumber: string | null;
  }>
): OutdatedSourceCheck[] {
  const latestMap = new Map<string, string>();
  for (const doc of acervoDocs) {
    if (doc.latestRevisionNumber) {
      latestMap.set(doc.id, doc.latestRevisionNumber.trim().toUpperCase());
    }
  }

  const outdated: OutdatedSourceCheck[] = [];
  for (const src of eapSources) {
    if (!src.acervoDocumentId) continue;
    const latest = latestMap.get(src.acervoDocumentId);
    if (latest && latest !== src.revisionLabel.trim().toUpperCase()) {
      outdated.push({
        sourceFileId: src.id,
        acervoDocumentId: src.acervoDocumentId,
        currentSourceRevision: src.revisionLabel,
        latestAcervoRevision: latest,
      });
    }
  }

  return outdated;
}
