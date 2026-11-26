import { CANONICAL_LOB_PACKAGE_RULES } from "@/lib/eap-lob-grid";
import { round2 } from "./calculator";
import { computeCanonicalEapTotals } from "./cascade-sync";
import {
  getMasterTaxonomyForStage,
  normalizeStageCode,
  REQUIRED_RESIDENTIAL_STAGE_CODES,
  resolveOfficialDiscipline,
} from "./master-taxonomy";
import { REGIONAL_BENCHMARKS_FORTALEZA } from "./regional-standards-catalog";

export type AuditSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface EapAuditAlert {
  id: string;
  severity: AuditSeverity;
  category:
    | "ETAPA_ZERADA"
    | "PROPORCAO_MO"
    | "DUPLICIDADE"
    | "DISCIPLINA_DIVERGENTE"
    | "BENCHMARK_REGIONAL";
  stageCode?: string;
  title: string;
  description: string;
  recommendation: string;
  autoFixable: boolean;
}

export interface EapAuditProjectInput {
  builtAreaM2: number;
  bdiPercent: number;
  constructionStandard?: string | null;
  concreteMethod?: string | null;
  cityLabel?: string | null;
}

export interface EapAuditItemInput {
  id?: string;
  stageCode: string;
  stageName?: string;
  code?: string | null;
  description: string;
  unit?: string;
  discipline?: string | null;
  zoneQuantities?: {
    FUND_TERREO?: number;
    PAV_SUPERIOR?: number;
    COBERTURA?: number;
    EXTERNO?: number;
  };
  totalMaterial?: number;
  totalLabor?: number;
  totalThirdParty?: number;
  totalDirectCost?: number;
}

export interface EapAuditAllocationInput {
  packageNumber: number;
  teamCode: string;
}

export interface EapCoherenceAuditResult {
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
    autoFixableCount: number;
  };
  totals: {
    totalMaterialCost: number;
    totalLaborCost: number;
    totalThirdPartyCost: number;
    totalDirectCost: number;
    bdiValue: number;
    totalCommercialPrice: number;
    directCostPerM2: number;
    costPerM2: number;
  };
  benchmark: {
    cityLabel: string;
    sinapiDirectPerM2: number;
    cubWithBdiPerM2: number;
    projectDirectPerM2: number;
    projectWithBdiPerM2: number;
    deltaVsSinapiPercent: number;
    deltaVsCubPercent: number;
    classification: "ABAIXO_REFERENCIA" | "ADERENTE" | "ACIMA_REFERENCIA";
  };
  alerts: EapAuditAlert[];
}

const ZONE_LABELS: Record<string, string> = {
  FUND_TERREO: "Fundação / Térreo",
  PAV_SUPERIOR: "Pavimento Superior",
  COBERTURA: "Coberta",
  EXTERNO: "Área Externa",
};

function normalizeItemFingerprint(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Auditor puro de coerência orçamentária da EAP:
 * detecta etapas obrigatórias zeradas, proporção anômala Material x MO,
 * duplicidades no mesmo pavimento, divergências contra MASTER_EAP_TAXONOMY
 * e compara R$/m² frente aos referenciais SINAPI-CE e CUB-CE.
 */
export function auditEapCoherence(
  project: EapAuditProjectInput,
  items: EapAuditItemInput[],
  allocations: EapAuditAllocationInput[] = []
): EapCoherenceAuditResult {
  const alerts: EapAuditAlert[] = [];

  const totals = computeCanonicalEapTotals({
    items: items.map((i) => ({
      totalMaterial: i.totalMaterial ?? 0,
      totalLabor: i.totalLabor ?? 0,
      totalThirdParty: i.totalThirdParty ?? 0,
      totalDirectCost:
        i.totalDirectCost ??
        round2((i.totalMaterial ?? 0) + (i.totalLabor ?? 0) + (i.totalThirdParty ?? 0)),
    })),
    bdiPercent: project.bdiPercent,
    builtAreaM2: project.builtAreaM2,
  });

  const stageMap = new Map<
    string,
    {
      stageCode: string;
      stageName: string;
      materialCost: number;
      laborCost: number;
      thirdPartyCost: number;
      directCost: number;
      activeItemsCount: number;
    }
  >();

  const seenByZoneKey = new Map<string, string>();
  const divergentStages = new Set<string>();

  for (const item of items) {
    const stageCode = normalizeStageCode(item.stageCode);
    const taxonomy = getMasterTaxonomyForStage(stageCode);
    const mat = item.totalMaterial ?? 0;
    const lab = item.totalLabor ?? 0;
    const tp = item.totalThirdParty ?? 0;
    const direct = item.totalDirectCost ?? round2(mat + lab + tp);

    const st = stageMap.get(stageCode) ?? {
      stageCode,
      stageName: item.stageName || taxonomy?.name || `Etapa ${stageCode}`,
      materialCost: 0,
      laborCost: 0,
      thirdPartyCost: 0,
      directCost: 0,
      activeItemsCount: 0,
    };

    st.materialCost = round2(st.materialCost + mat);
    st.laborCost = round2(st.laborCost + lab);
    st.thirdPartyCost = round2(st.thirdPartyCost + tp);
    st.directCost = round2(st.directCost + direct);

    const zq = item.zoneQuantities ?? {};
    const qTotal =
      (zq.FUND_TERREO ?? 0) +
      (zq.PAV_SUPERIOR ?? 0) +
      (zq.COBERTURA ?? 0) +
      (zq.EXTERNO ?? 0);
    if (qTotal > 0 || direct > 0) {
      st.activeItemsCount += 1;
    }
    stageMap.set(stageCode, st);

    // 4. Disciplina divergente da MASTER_EAP_TAXONOMY
    if (item.discipline && taxonomy && item.discipline.trim() !== taxonomy.discipline) {
      const divKey = `${stageCode}::${item.discipline.trim()}::${taxonomy.discipline}`;
      if (!divergentStages.has(divKey)) {
        divergentStages.add(divKey);
        alerts.push({
          id: `DISCIPLINE_MISMATCH_${stageCode}`,
          severity: "WARNING",
          category: "DISCIPLINA_DIVERGENTE",
          stageCode,
          title: `Etapa ${stageCode} com disciplina "${item.discipline}"`,
          description: `Pela taxonomia travada do ArqVértice OS, a Etapa ${stageCode} (${st.stageName}) pertence oficialmente à disciplina "${taxonomy.discipline}".`,
          recommendation: "Clique em Corrigir Automaticamente para alinhar à taxonomia oficial.",
          autoFixable: true,
        });
      }
    }

    // 3. Possível duplicidade no mesmo pavimento/zona
    const fingerprint = item.code?.trim()
      ? `CODE:${item.code.trim().toUpperCase()}`
      : `DESC:${normalizeItemFingerprint(item.description)}`;
    if (fingerprint.length > 6) {
      const zoneEntries = Object.entries(zq) as Array<[string, number | undefined]>;
      for (const [zoneKey, qty] of zoneEntries) {
        if (!qty || qty <= 0) continue;
        const composite = `${stageCode}::${zoneKey}::${fingerprint}`;
        const prevDesc = seenByZoneKey.get(composite);
        if (prevDesc) {
          alerts.push({
            id: `DUPLICATE_${stageCode}_${zoneKey}_${seenByZoneKey.size}`,
            severity: "WARNING",
            category: "DUPLICIDADE",
            stageCode,
            title: `Possível duplicidade na Etapa ${stageCode} (${ZONE_LABELS[zoneKey] || zoneKey})`,
            description: `O item "${item.description}" possui mesmo código ou descrição de "${prevDesc}" com quantidade lançada no mesmo pavimento.`,
            recommendation: "Revise os dois lançamentos na Planilha EAP para evitar contagem dupla.",
            autoFixable: false,
          });
        } else {
          seenByZoneKey.set(composite, item.description);
        }
      }
    }
  }

  // 1. Etapas obrigatórias zeradas (01, 02, 03, 04, 05, 08, 09)
  for (const reqCode of REQUIRED_RESIDENTIAL_STAGE_CODES) {
    const st = stageMap.get(reqCode);
    const taxonomy = getMasterTaxonomyForStage(reqCode);
    if (!st || st.directCost <= 0 || st.activeItemsCount === 0) {
      alerts.push({
        id: `REQUIRED_STAGE_EMPTY_${reqCode}`,
        severity: "CRITICAL",
        category: "ETAPA_ZERADA",
        stageCode: reqCode,
        title: `Etapa obrigatória ${reqCode} zerada`,
        description: `A etapa ${reqCode} (${taxonomy?.name || "Essencial"}) está com custo direto zerado ou sem quantitativos lançados.`,
        recommendation: "Preencha os quantitativos e custos unitários desta etapa antes de aprovar a Baseline.",
        autoFixable: false,
      });
    }
  }

  // 2. Proporção Material × Mão de Obra fora de expectedLaborShareRange
  for (const [stageCode, st] of stageMap.entries()) {
    if (st.directCost <= 500) continue;
    const taxonomy = getMasterTaxonomyForStage(stageCode);
    if (!taxonomy) continue;

    const laborShare = st.laborCost / st.directCost;
    const [minShare, maxShare] = taxonomy.expectedLaborShareRange;

    if (st.laborCost <= 0 && st.materialCost >= 2000) {
      alerts.push({
        id: `ZERO_LABOR_HIGH_MAT_${stageCode}`,
        severity: "CRITICAL",
        category: "PROPORCAO_MO",
        stageCode,
        title: `Etapa ${stageCode} com Material expressivo e Mão de Obra zerada`,
        description: `Etapa ${stageCode} (${st.stageName}) soma R$ ${st.materialCost.toFixed(2)} em material, porém R$ 0,00 em Mão de Obra.`,
        recommendation: `Revise os custos unitários de MO da Etapa ${stageCode} (faixa esperada ${(minShare * 100).toFixed(0)}%–${(maxShare * 100).toFixed(0)}%).`,
        autoFixable: false,
      });
    } else if (laborShare < minShare || laborShare > maxShare) {
      const pct = round2(laborShare * 100);
      alerts.push({
        id: `LABOR_SHARE_ANOMALY_${stageCode}`,
        severity: "WARNING",
        category: "PROPORCAO_MO",
        stageCode,
        title: `Proporção de Mão de Obra fora da faixa na Etapa ${stageCode} (${pct}%)`,
        description: `Na Etapa ${stageCode} (${st.stageName}), a Mão de Obra representa ${pct}% do custo direto, fora da faixa calibrada de ${(minShare * 100).toFixed(0)}% a ${(maxShare * 100).toFixed(0)}%.`,
        recommendation:
          laborShare > maxShare
            ? "Verifique possível duplicidade de diárias/MO ou multiplicação indevida em peças lineares."
            : "Verifique se a Mão de Obra executiva foi lançada integralmente nos itens da etapa.",
        autoFixable: false,
      });
    }
  }

  // Verificar também divergência de equipes nas alocações LOB (se informadas)
  const mismatchedPackages = new Set<number>();
  for (const alloc of allocations) {
    const rule = CANONICAL_LOB_PACKAGE_RULES[alloc.packageNumber];
    if (rule && alloc.teamCode && alloc.teamCode.toUpperCase() !== rule.defaultTeam) {
      mismatchedPackages.add(alloc.packageNumber);
    }
  }
  if (mismatchedPackages.size > 0) {
    const list = Array.from(mismatchedPackages).sort((a, b) => a - b).join(", ");
    alerts.push({
      id: "LOB_TEAM_TAXONOMY_MISMATCH",
      severity: "WARNING",
      category: "DISCIPLINA_DIVERGENTE",
      title: `${mismatchedPackages.size} pacote(s) LOB com equipe divergente do padrão A/B/C`,
      description: `Os pacotes [${list}] estão atribuídos a uma equipe diferente da regra oficial (A=Estrutura/Alvenaria/Coberta, B=Instalações, C=Acabamentos).`,
      recommendation: "Clique em Corrigir Automaticamente para realinhar as equipes A/B/C na Linha de Balanço.",
      autoFixable: true,
    });
  }

  // 5. Benchmark Regional Fortaleza/CE (SINAPI-CE e CUB-CE)
  const sinapi = REGIONAL_BENCHMARKS_FORTALEZA.sinapiDirectPerM2;
  const cub = REGIONAL_BENCHMARKS_FORTALEZA.cubWithBdiPerM2;
  const deltaVsSinapiPercent =
    sinapi > 0 ? round2(((totals.directCostPerM2 - sinapi) / sinapi) * 100) : 0;
  const deltaVsCubPercent =
    cub > 0 ? round2(((totals.costPerM2 - cub) / cub) * 100) : 0;

  let classification: "ABAIXO_REFERENCIA" | "ADERENTE" | "ACIMA_REFERENCIA" = "ADERENTE";
  if (deltaVsSinapiPercent < -20) classification = "ABAIXO_REFERENCIA";
  else if (deltaVsSinapiPercent > 35) classification = "ACIMA_REFERENCIA";

  if (totals.directCostPerM2 > 0) {
    const isOutlier = deltaVsSinapiPercent > 35 || deltaVsSinapiPercent < -30;
    alerts.push({
      id: "REGIONAL_BENCHMARK_FORTALEZA",
      severity: isOutlier ? "WARNING" : "INFO",
      category: "BENCHMARK_REGIONAL",
      title: `Benchmark Fortaleza/CE: ${totals.directCostPerM2.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/m² direto (${deltaVsSinapiPercent >= 0 ? "+" : ""}${deltaVsSinapiPercent}% vs SINAPI-CE)`,
      description: `Custo Direto/m² comparado ao SINAPI-CE (R$ ${sinapi.toFixed(2)}/m²) e Custo c/ BDI (${totals.costPerM2.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/m²) frente ao CUB-CE (R$ ${cub.toFixed(2)}/m²).`,
      recommendation: isOutlier
        ? "Analise as etapas de maior peso na Curva ABC para confirmar o padrão construtivo e quantitativos."
        : "Indicadores por m² coerentes com o mercado residencial do Ceará.",
      autoFixable: false,
    });
  }

  // Ordenação determinística: CRITICAL > WARNING > INFO
  const sevWeight: Record<AuditSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  alerts.sort((a, b) => sevWeight[a.severity] - sevWeight[b.severity]);

  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
  const warning = alerts.filter((a) => a.severity === "WARNING").length;
  const info = alerts.filter((a) => a.severity === "INFO").length;
  const autoFixableCount = alerts.filter((a) => a.autoFixable).length;

  return {
    summary: {
      critical,
      warning,
      info,
      total: alerts.length,
      autoFixableCount,
    },
    totals: {
      totalMaterialCost: totals.totalMaterialCost,
      totalLaborCost: totals.totalLaborCost,
      totalThirdPartyCost: totals.totalThirdPartyCost,
      totalDirectCost: totals.totalDirectCost,
      bdiValue: totals.bdiValue,
      totalCommercialPrice: totals.totalCommercialPrice,
      directCostPerM2: totals.directCostPerM2,
      costPerM2: totals.costPerM2,
    },
    benchmark: {
      cityLabel: project.cityLabel || "Fortaleza / CE",
      sinapiDirectPerM2: sinapi,
      cubWithBdiPerM2: cub,
      projectDirectPerM2: totals.directCostPerM2,
      projectWithBdiPerM2: totals.costPerM2,
      deltaVsSinapiPercent,
      deltaVsCubPercent,
      classification,
    },
    alerts,
  };
}
