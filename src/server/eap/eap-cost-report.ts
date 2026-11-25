import { prisma } from "@/server/db";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { round2 } from "./calculator";
import { buildEapTreePayload } from "./workbench";

export type EapTreePayload = ReturnType<typeof buildEapTreePayload>;

export interface EapCostReportFloorDTO {
  code: string;
  label: string;
  materialCost: number;
  laborCost: number;
  thirdPartyCost: number;
  directCost: number;
  commercialPrice: number;
  sharePercent: number;
}

export interface EapCostReportDisciplineDTO {
  discipline: string;
  materialCost: number;
  laborCost: number;
  thirdPartyCost: number;
  directCost: number;
  commercialPrice: number;
  sharePercent: number;
  itemsCount: number;
}

export interface EapCostReportPhaseDTO {
  phaseCode: string;
  phaseName: string;
  materialCost: number;
  laborCost: number;
  thirdPartyCost: number;
  directCost: number;
  commercialPrice: number;
  sharePercent: number;
  stagesCount: number;
  itemsCount: number;
}

export interface EapCostReportStageDTO {
  code: string;
  name: string;
  discipline: string;
  phaseName: string;
  materialCost: number;
  laborCost: number;
  thirdPartyCost: number;
  directCost: number;
  commercialPrice: number;
  sharePercent: number;
  itemsCount: number;
}

export interface EapCostReportAbcItemDTO {
  rank: number;
  code: string;
  description: string;
  stageCode: string;
  stageName: string;
  unit: string;
  quantity: number;
  totalCommercialPrice: number;
  sharePercent: number;
  cumulativePercent: number;
  abcClass: "A" | "B" | "C";
}

export interface EapCostReportAbcClassSummary {
  count: number;
  totalValue: number;
  sharePercent: number;
}

export interface EapCostReportTeamDTO {
  teamCode: string;
  name: string;
  specialty: string;
  headcount: number;
  dailyCostEstimate: number;
  rolesSummary: string;
}

export interface EapCostReportPayload {
  meta: {
    projectId: string;
    projectName: string;
    clientName: string;
    cityLabel: string;
    title: string;
    builtAreaM2: number;
    bdiPercent: number;
    status: string;
    revision: number;
    isParametricFallback: boolean;
  };
  kpis: {
    totalMaterialCost: number;
    totalLaborCost: number;
    totalThirdPartyCost: number;
    totalDirectCost: number;
    bdiValue: number;
    bdiPercent: number;
    totalCommercialPrice: number;
    directCostPerM2: number;
    costPerM2: number;
    materialSharePercent: number;
    laborSharePercent: number;
    thirdPartySharePercent: number;
    totalItemsCount: number;
    concreteM3: number;
    steelKg: number;
    masonryM2: number;
    ceramicTileM2: number;
    roofM2: number;
  };
  byFloor: EapCostReportFloorDTO[];
  byDiscipline: EapCostReportDisciplineDTO[];
  byPhase: EapCostReportPhaseDTO[];
  stages: EapCostReportStageDTO[];
  abcCurve: {
    items: EapCostReportAbcItemDTO[];
    summaryByClass: Record<"A" | "B" | "C", EapCostReportAbcClassSummary>;
  };
  teams: EapCostReportTeamDTO[];
  premises: string[];
  exclusions: string[];
}

export interface WorkTeamRecordLike {
  teamCode: string;
  name: string;
  specialty: string;
  isActive: boolean;
  workers: Array<{
    roleName: string;
    headcount: number;
    dailyRate: number;
    socialChargesPct: number;
  }>;
}

const FLOOR_BUCKETS: Array<{ code: string; label: string }> = [
  { code: "INFRAESTRUTURA", label: "Infraestrutura / Fundação" },
  { code: "TERREO", label: "Térreo" },
  { code: "PAV_SUPERIOR", label: "Pavimento Superior" },
  { code: "COBERTURA", label: "Coberta" },
  { code: "EXTERNO", label: "Área Externa" },
];

export function resolveDisciplineForStageCode(stageCode: string): string {
  const num = Number(stageCode);
  if (num === 1 || num === 2) return "Serviços Preliminares / Gerais";
  if (num === 3 || num === 4) return "Estrutural";
  if (num === 8) return "Elétrico";
  if (num === 9 || num === 10) return "Hidrossanitário";
  if (num === 20 || num === 21) return "Luminotécnico";
  if (num === 22 || num === 23 || num === 24) return "Paisagismo";
  if (num >= 5 && num <= 26) return "Arquitetônico";
  return "Complementares / Outros";
}

export function resolvePhaseForStageCode(stageCode: string): { code: string; name: string } {
  const num = Number(stageCode);
  if (num >= 1 && num <= 3) return { code: "F1", name: "Fase 1 — Implantação & Infraestrutura" };
  if (num >= 4 && num <= 5) return { code: "F2", name: "Fase 2 — Supraestrutura & Vedação" };
  if (num >= 6 && num <= 10) return { code: "F3", name: "Fase 3 — Cobertura & Instalações" };
  if (num >= 11 && num <= 13) return { code: "F4", name: "Fase 4 — Revestimentos" };
  if (num >= 14 && num <= 18) return { code: "F5", name: "Fase 5 — Acabamentos" };
  return { code: "F6", name: "Fase 6 — Finais & Entrega" };
}

function buildParametricCostFallback(params: {
  projectId: string;
  projectName: string;
  clientName: string;
  tree: EapTreePayload;
  teams: EapCostReportTeamDTO[];
}): EapCostReportPayload {
  const { projectId, projectName, clientName, tree, teams } = params;
  const area = tree.builtAreaM2 > 0 ? tree.builtAreaM2 : 250;
  const bdiPct = tree.bdiPercent >= 0 ? tree.bdiPercent : 22;
  const baseDirectPerM2 = 2850;
  const totalDirectCost = round2(area * baseDirectPerM2);
  const totalMaterialCost = round2(totalDirectCost * 0.54);
  const totalLaborCost = round2(totalDirectCost * 0.34);
  const totalThirdPartyCost = round2(totalDirectCost - totalMaterialCost - totalLaborCost);
  const bdiValue = round2(totalDirectCost * (bdiPct / 100));
  const totalCommercialPrice = round2(totalDirectCost + bdiValue);

  const floorWeights = [
    { code: "INFRAESTRUTURA", label: "Infraestrutura / Fundação", w: 0.16 },
    { code: "TERREO", label: "Térreo", w: 0.38 },
    { code: "PAV_SUPERIOR", label: "Pavimento Superior", w: 0.28 },
    { code: "COBERTURA", label: "Coberta", w: 0.09 },
    { code: "EXTERNO", label: "Área Externa", w: 0.09 },
  ];

  const byFloor: EapCostReportFloorDTO[] = floorWeights.map((fw) => ({
    code: fw.code,
    label: fw.label,
    materialCost: round2(totalMaterialCost * fw.w),
    laborCost: round2(totalLaborCost * fw.w),
    thirdPartyCost: round2(totalThirdPartyCost * fw.w),
    directCost: round2(totalDirectCost * fw.w),
    commercialPrice: round2(totalCommercialPrice * fw.w),
    sharePercent: round2(fw.w * 100),
  }));

  const disciplineWeights = [
    { discipline: "Arquitetônico", w: 0.44, itemsCount: 28 },
    { discipline: "Estrutural", w: 0.28, itemsCount: 14 },
    { discipline: "Serviços Preliminares / Gerais", w: 0.08, itemsCount: 8 },
    { discipline: "Hidrossanitário", w: 0.08, itemsCount: 10 },
    { discipline: "Elétrico", w: 0.07, itemsCount: 9 },
    { discipline: "Luminotécnico", w: 0.03, itemsCount: 4 },
    { discipline: "Paisagismo", w: 0.02, itemsCount: 3 },
  ];

  const byDiscipline: EapCostReportDisciplineDTO[] = disciplineWeights.map((dw) => ({
    discipline: dw.discipline,
    materialCost: round2(totalMaterialCost * dw.w),
    laborCost: round2(totalLaborCost * dw.w),
    thirdPartyCost: round2(totalThirdPartyCost * dw.w),
    directCost: round2(totalDirectCost * dw.w),
    commercialPrice: round2(totalCommercialPrice * dw.w),
    sharePercent: round2(dw.w * 100),
    itemsCount: dw.itemsCount,
  }));

  const phaseWeights = [
    { code: "F1", name: "Fase 1 — Implantação & Infraestrutura", w: 0.17, stagesCount: 3, itemsCount: 12 },
    { code: "F2", name: "Fase 2 — Supraestrutura & Vedação", w: 0.25, stagesCount: 2, itemsCount: 16 },
    { code: "F3", name: "Fase 3 — Cobertura & Instalações", w: 0.22, stagesCount: 5, itemsCount: 18 },
    { code: "F4", name: "Fase 4 — Revestimentos", w: 0.16, stagesCount: 3, itemsCount: 12 },
    { code: "F5", name: "Fase 5 — Acabamentos", w: 0.14, stagesCount: 5, itemsCount: 11 },
    { code: "F6", name: "Fase 6 — Finais & Entrega", w: 0.06, stagesCount: 8, itemsCount: 7 },
  ];

  const byPhase: EapCostReportPhaseDTO[] = phaseWeights.map((pw) => ({
    phaseCode: pw.code,
    phaseName: pw.name,
    materialCost: round2(totalMaterialCost * pw.w),
    laborCost: round2(totalLaborCost * pw.w),
    thirdPartyCost: round2(totalThirdPartyCost * pw.w),
    directCost: round2(totalDirectCost * pw.w),
    commercialPrice: round2(totalCommercialPrice * pw.w),
    sharePercent: round2(pw.w * 100),
    stagesCount: pw.stagesCount,
    itemsCount: pw.itemsCount,
  }));

  const templateStages: Array<{ code: string; name: string; w: number }> = [
    { code: "01", name: "Serviços Preliminares & Canteiro", w: 0.04 },
    { code: "02", name: "Locação, Escavação & Mov. Terra", w: 0.04 },
    { code: "03", name: "Infraestrutura & Fundações", w: 0.09 },
    { code: "04", name: "Supraestrutura (Pilares, Vigas, Lajes)", w: 0.19 },
    { code: "05", name: "Alvenaria & Vedações", w: 0.06 },
    { code: "06", name: "Coberta & Telhamento", w: 0.07 },
    { code: "08", name: "Instalações Elétricas", w: 0.07 },
    { code: "09", name: "Instalações Hidrossanitárias", w: 0.08 },
    { code: "11", name: "Chapisco, Reboco & Emboço", w: 0.09 },
    { code: "14", name: "Revestimentos & Porcelanatos", w: 0.11 },
    { code: "16", name: "Esquadrias, Vidros & Serralheria", w: 0.08 },
    { code: "18", name: "Pintura Interna & Fachada", w: 0.05 },
    { code: "24", name: "Limpeza, Paisagismo & Entrega", w: 0.03 },
  ];

  const stages: EapCostReportStageDTO[] = templateStages.map((ts) => ({
    code: ts.code,
    name: ts.name,
    discipline: resolveDisciplineForStageCode(ts.code),
    phaseName: resolvePhaseForStageCode(ts.code).name,
    materialCost: round2(totalMaterialCost * ts.w),
    laborCost: round2(totalLaborCost * ts.w),
    thirdPartyCost: round2(totalThirdPartyCost * ts.w),
    directCost: round2(totalDirectCost * ts.w),
    commercialPrice: round2(totalCommercialPrice * ts.w),
    sharePercent: round2(ts.w * 100),
    itemsCount: 4,
  }));

  let cum = 0;
  const abcItems: EapCostReportAbcItemDTO[] = [...stages]
    .sort((a, b) => b.commercialPrice - a.commercialPrice)
    .map((st, idx) => {
      cum = round2(cum + st.sharePercent);
      const abcClass: "A" | "B" | "C" = cum <= 80 || idx < 4 ? "A" : cum <= 95 ? "B" : "C";
      return {
        rank: idx + 1,
        code: `EST-${st.code}`,
        description: `${st.name} (Estimativa paramétrica)`,
        stageCode: st.code,
        stageName: st.name,
        unit: "vb",
        quantity: 1,
        totalCommercialPrice: st.commercialPrice,
        sharePercent: st.sharePercent,
        cumulativePercent: Math.min(100, cum),
        abcClass,
      };
    });

  const summaryByClass: Record<"A" | "B" | "C", EapCostReportAbcClassSummary> = {
    A: { count: 0, totalValue: 0, sharePercent: 0 },
    B: { count: 0, totalValue: 0, sharePercent: 0 },
    C: { count: 0, totalValue: 0, sharePercent: 0 },
  };
  for (const item of abcItems) {
    summaryByClass[item.abcClass].count += 1;
    summaryByClass[item.abcClass].totalValue = round2(
      summaryByClass[item.abcClass].totalValue + item.totalCommercialPrice
    );
    summaryByClass[item.abcClass].sharePercent = round2(
      summaryByClass[item.abcClass].sharePercent + item.sharePercent
    );
  }

  return {
    meta: {
      projectId,
      projectName,
      clientName,
      cityLabel: tree.cityLabel,
      title: tree.title,
      builtAreaM2: area,
      bdiPercent: bdiPct,
      status: tree.status,
      revision: tree.currentRevision,
      isParametricFallback: true,
    },
    kpis: {
      totalMaterialCost,
      totalLaborCost,
      totalThirdPartyCost,
      totalDirectCost,
      bdiValue,
      bdiPercent: bdiPct,
      totalCommercialPrice,
      directCostPerM2: round2(totalDirectCost / area),
      costPerM2: round2(totalCommercialPrice / area),
      materialSharePercent: 54,
      laborSharePercent: 34,
      thirdPartySharePercent: 12,
      totalItemsCount: 76,
      concreteM3: round2(area * 0.27),
      steelKg: round2(area * 28.5),
      masonryM2: round2(area * 1.45),
      ceramicTileM2: round2(area * 1.25),
      roofM2: round2(area * 0.62),
    },
    byFloor,
    byDiscipline,
    byPhase,
    stages,
    abcCurve: { items: abcItems, summaryByClass },
    teams,
    premises: tree.premises.length > 0 ? tree.premises : ["Estimativa paramétrica padrão regional ativa enquanto quantitativos finais são conferidos."],
    exclusions: tree.exclusions,
  };
}

export function buildEapCostReport(params: {
  projectId: string;
  projectName: string;
  clientName: string;
  tree: EapTreePayload;
  workTeams: WorkTeamRecordLike[];
}): EapCostReportPayload {
  const { projectId, projectName, clientName, tree, workTeams } = params;

  const teams: EapCostReportTeamDTO[] = workTeams
    .filter((t) => t.isActive)
    .map((t) => {
      const headcount = t.workers.reduce((s, w) => s + (w.headcount || 1), 0) || 1;
      const dailyCostEstimate = round2(
        t.workers.reduce(
          (s, w) => s + (w.headcount || 1) * (w.dailyRate || 0) * (1 + (w.socialChargesPct || 0) / 100),
          0
        )
      );
      const rolesSummary =
        t.workers.map((w) => `${w.headcount}x ${w.roleName}`).join(" · ") || t.specialty;
      return {
        teamCode: t.teamCode,
        name: t.name,
        specialty: t.specialty,
        headcount,
        dailyCostEstimate,
        rolesSummary,
      };
    });

  if (tree.indicators.totalCommercialPrice <= 0) {
    return buildParametricCostFallback({ projectId, projectName, clientName, tree, teams });
  }

  const ind = tree.indicators;
  const totalCommercial = ind.totalCommercialPrice;
  const totalDirect = ind.totalDirectCost;
  const bdiValue = round2(Math.max(0, totalCommercial - totalDirect));
  const area = tree.builtAreaM2 > 0 ? tree.builtAreaM2 : 1;

  const floorAcc = new Map<
    string,
    {
      code: string;
      label: string;
      materialCost: number;
      laborCost: number;
      thirdPartyCost: number;
      directCost: number;
      commercialPrice: number;
    }
  >();
  for (const b of FLOOR_BUCKETS) {
    floorAcc.set(b.code, {
      code: b.code,
      label: b.label,
      materialCost: 0,
      laborCost: 0,
      thirdPartyCost: 0,
      directCost: 0,
      commercialPrice: 0,
    });
  }

  const discAcc = new Map<string, EapCostReportDisciplineDTO>();
  const phaseAcc = new Map<string, EapCostReportPhaseDTO & { stageSet: Set<string> }>();
  const stages: EapCostReportStageDTO[] = [];
  const rawAbcItems: Array<{
    code: string;
    description: string;
    stageCode: string;
    stageName: string;
    unit: string;
    quantity: number;
    totalCommercialPrice: number;
  }> = [];

  let totalItemsCount = 0;
  let concreteM3 = 0;
  let steelKg = 0;
  let masonryM2 = 0;
  let ceramicTileM2 = 0;
  let roofM2 = 0;

  for (const stage of tree.stages) {
    const discipline = resolveDisciplineForStageCode(stage.code);
    const phase = resolvePhaseForStageCode(stage.code);
    const stageItems = stage.groups.flatMap((g) => g.items);
    const stageItemsCount = stageItems.length;
    totalItemsCount += stageItemsCount;

    stages.push({
      code: stage.code,
      name: stage.name,
      discipline,
      phaseName: phase.name,
      materialCost: round2(stage.totalMaterial),
      laborCost: round2(stage.totalLabor),
      thirdPartyCost: round2(stage.totalThirdParty),
      directCost: round2(stage.totalDirectCost),
      commercialPrice: round2(stage.totalCommercialPrice),
      sharePercent:
        totalCommercial > 0 ? round2((stage.totalCommercialPrice / totalCommercial) * 100) : 0,
      itemsCount: stageItemsCount,
    });

    const dCurr = discAcc.get(discipline) ?? {
      discipline,
      materialCost: 0,
      laborCost: 0,
      thirdPartyCost: 0,
      directCost: 0,
      commercialPrice: 0,
      sharePercent: 0,
      itemsCount: 0,
    };
    dCurr.materialCost = round2(dCurr.materialCost + stage.totalMaterial);
    dCurr.laborCost = round2(dCurr.laborCost + stage.totalLabor);
    dCurr.thirdPartyCost = round2(dCurr.thirdPartyCost + stage.totalThirdParty);
    dCurr.directCost = round2(dCurr.directCost + stage.totalDirectCost);
    dCurr.commercialPrice = round2(dCurr.commercialPrice + stage.totalCommercialPrice);
    dCurr.itemsCount += stageItemsCount;
    discAcc.set(discipline, dCurr);

    const pCurr = phaseAcc.get(phase.code) ?? {
      phaseCode: phase.code,
      phaseName: phase.name,
      materialCost: 0,
      laborCost: 0,
      thirdPartyCost: 0,
      directCost: 0,
      commercialPrice: 0,
      sharePercent: 0,
      stagesCount: 0,
      itemsCount: 0,
      stageSet: new Set<string>(),
    };
    pCurr.materialCost = round2(pCurr.materialCost + stage.totalMaterial);
    pCurr.laborCost = round2(pCurr.laborCost + stage.totalLabor);
    pCurr.thirdPartyCost = round2(pCurr.thirdPartyCost + stage.totalThirdParty);
    pCurr.directCost = round2(pCurr.directCost + stage.totalDirectCost);
    pCurr.commercialPrice = round2(pCurr.commercialPrice + stage.totalCommercialPrice);
    pCurr.itemsCount += stageItemsCount;
    pCurr.stageSet.add(stage.code);
    pCurr.stagesCount = pCurr.stageSet.size;
    phaseAcc.set(phase.code, pCurr);

    const isInfraStage = ["01", "02", "03"].includes(stage.code);

    for (const item of stageItems) {
      if (item.totalCommercialPrice > 0) {
        rawAbcItems.push({
          code: item.code || `${stage.code}.${item.orderIndex}`,
          description: item.description,
          stageCode: stage.code,
          stageName: stage.name,
          unit: item.unit,
          quantity: round2(item.totalQtyWithLoss),
          totalCommercialPrice: round2(item.totalCommercialPrice),
        });
      }

      const zq = item.zoneQuantities;
      const qSum = zq.FUND_TERREO + zq.PAV_SUPERIOR + zq.COBERTURA + zq.EXTERNO;
      if (qSum > 0 && item.totalCommercialPrice > 0) {
        const parts: Array<{ bucketCode: string; qty: number }> = [
          { bucketCode: isInfraStage ? "INFRAESTRUTURA" : "TERREO", qty: zq.FUND_TERREO },
          { bucketCode: "PAV_SUPERIOR", qty: zq.PAV_SUPERIOR },
          { bucketCode: "COBERTURA", qty: zq.COBERTURA },
          { bucketCode: "EXTERNO", qty: zq.EXTERNO },
        ];
        for (const p of parts) {
          if (p.qty <= 0) continue;
          const ratio = p.qty / qSum;
          const bucket = floorAcc.get(p.bucketCode);
          if (!bucket) continue;
          bucket.materialCost = round2(bucket.materialCost + item.totalMaterial * ratio);
          bucket.laborCost = round2(bucket.laborCost + item.totalLabor * ratio);
          bucket.thirdPartyCost = round2(bucket.thirdPartyCost + item.totalThirdParty * ratio);
          bucket.directCost = round2(bucket.directCost + item.totalDirectCost * ratio);
          bucket.commercialPrice = round2(bucket.commercialPrice + item.totalCommercialPrice * ratio);
        }
      }

      // Quantidades-chave
      const desc = item.description.toLowerCase();
      const unit = item.unit.toLowerCase().trim();
      const qty = item.totalQtyWithLoss;
      if ((unit === "m3" || unit === "m³") && /concret|fck|lastro/.test(desc)) {
        concreteM3 += qty;
      } else if (unit === "kg" && /aço|aco|armadura|ca-50|ca-60|vergalh/.test(desc)) {
        steelKg += qty;
      } else if ((unit === "m2" || unit === "m²") && /alvenaria|tijolo|bloco/.test(desc)) {
        masonryM2 += qty;
      } else if ((unit === "m2" || unit === "m²") && /porcelanato|cerâm|ceram|revestimento|piso/.test(desc)) {
        ceramicTileM2 += qty;
      } else if ((unit === "m2" || unit === "m²") && (stage.code === "06" || /telha|coberta|cobertura|telhado/.test(desc))) {
        roofM2 += qty;
      }
    }
  }

  const byFloor: EapCostReportFloorDTO[] = FLOOR_BUCKETS.map((b) => {
    const f = floorAcc.get(b.code)!;
    return {
      ...f,
      sharePercent: totalCommercial > 0 ? round2((f.commercialPrice / totalCommercial) * 100) : 0,
    };
  });

  const byDiscipline: EapCostReportDisciplineDTO[] = Array.from(discAcc.values())
    .map((d) => ({
      ...d,
      sharePercent: totalCommercial > 0 ? round2((d.commercialPrice / totalCommercial) * 100) : 0,
    }))
    .sort((a, b) => b.commercialPrice - a.commercialPrice);

  const byPhase: EapCostReportPhaseDTO[] = ["F1", "F2", "F3", "F4", "F5", "F6"]
    .map((code) => phaseAcc.get(code))
    .filter((p): p is EapCostReportPhaseDTO & { stageSet: Set<string> } => Boolean(p))
    .map(({ stageSet: _unused, ...p }) => ({
      ...p,
      sharePercent: totalCommercial > 0 ? round2((p.commercialPrice / totalCommercial) * 100) : 0,
    }));

  const sortedAbc = rawAbcItems.sort((a, b) => b.totalCommercialPrice - a.totalCommercialPrice);
  const abcTotal = sortedAbc.reduce((s, x) => s + x.totalCommercialPrice, 0) || totalCommercial;
  let runningCum = 0;
  const summaryByClass: Record<"A" | "B" | "C", EapCostReportAbcClassSummary> = {
    A: { count: 0, totalValue: 0, sharePercent: 0 },
    B: { count: 0, totalValue: 0, sharePercent: 0 },
    C: { count: 0, totalValue: 0, sharePercent: 0 },
  };
  const classifiedAbc: EapCostReportAbcItemDTO[] = sortedAbc.map((item, idx) => {
    const share = abcTotal > 0 ? round2((item.totalCommercialPrice / abcTotal) * 100) : 0;
    runningCum = round2(runningCum + share);
    const abcClass: "A" | "B" | "C" = runningCum <= 80 || idx === 0 ? "A" : runningCum <= 95 ? "B" : "C";
    summaryByClass[abcClass].count += 1;
    summaryByClass[abcClass].totalValue = round2(
      summaryByClass[abcClass].totalValue + item.totalCommercialPrice
    );
    summaryByClass[abcClass].sharePercent = round2(summaryByClass[abcClass].sharePercent + share);
    return {
      rank: idx + 1,
      ...item,
      sharePercent: share,
      cumulativePercent: Math.min(100, runningCum),
      abcClass,
    };
  });

  return {
    meta: {
      projectId,
      projectName,
      clientName,
      cityLabel: tree.cityLabel,
      title: tree.title,
      builtAreaM2: tree.builtAreaM2,
      bdiPercent: tree.bdiPercent,
      status: tree.status,
      revision: tree.currentRevision,
      isParametricFallback: false,
    },
    kpis: {
      totalMaterialCost: round2(ind.totalMaterialCost),
      totalLaborCost: round2(ind.totalLaborCost),
      totalThirdPartyCost: round2(ind.totalThirdPartyCost),
      totalDirectCost: round2(totalDirect),
      bdiValue,
      bdiPercent: tree.bdiPercent,
      totalCommercialPrice: round2(totalCommercial),
      directCostPerM2: round2(totalDirect / area),
      costPerM2: round2(totalCommercial / area),
      materialSharePercent: round2(ind.materialSharePercent),
      laborSharePercent: round2(ind.laborSharePercent),
      thirdPartySharePercent: round2(ind.thirdPartySharePercent),
      totalItemsCount,
      concreteM3: round2(concreteM3),
      steelKg: round2(steelKg),
      masonryM2: round2(masonryM2),
      ceramicTileM2: round2(ceramicTileM2),
      roofM2: round2(roofM2),
    },
    byFloor,
    byDiscipline,
    byPhase,
    stages,
    abcCurve: {
      items: classifiedAbc.slice(0, 30),
      summaryByClass,
    },
    teams,
    premises: tree.premises,
    exclusions: tree.exclusions,
  };
}

export async function loadEapCostReportFromDb(
  projectId: string
): Promise<EapCostReportPayload | null> {
  const [project, eap] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: true,
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: { items: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        workTeams: {
          orderBy: { teamCode: "asc" },
          include: { workers: true },
        },
      },
    }),
  ]);

  if (!project || !eap) return null;

  const tree = buildEapTreePayload({
    id: eap.id,
    projectId: eap.projectId,
    cityId: eap.cityId,
    cityLabel: `${eap.city.name}/${eap.city.state}`,
    title: eap.title,
    builtAreaM2: eap.builtAreaM2,
    bdiPercent: eap.bdiPercent,
    plannedStartDate: eap.plannedStartDate,
    status: eap.status,
    currentRevision: eap.currentRevision,
    premisesJson: eap.premisesJson,
    exclusionsJson: eap.exclusionsJson,
    zones: eap.zones,
    stages: eap.stages,
    conflicts: eap.conflictLogs,
  });

  return buildEapCostReport({
    projectId: project.id,
    projectName: project.name,
    clientName: project.client?.name || "Cliente",
    tree,
    workTeams: eap.workTeams,
  });
}

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderEapCostReportPdf(payload: EapCostReportPayload): Uint8Array {
  const pdf = new PdfWriter({
    title: `Relatorio de Custos da EAP - ${payload.meta.projectName}`,
    author: "ArqVertice OS",
    subject: `Relatorio Analitico de Custos da Planilha EAP (${payload.meta.cityLabel})`,
  });

  // Cabeçalho Corporativo ArqVértice OS
  pdf.rect(0, 0, pdf.width, 108, { fill: "0.09 0.09 0.11" });
  pdf.drawText("ARQVERTICE OS · ORCAMENTO EXECUTIVO", pdf.margin, 34, {
    size: 10,
    bold: true,
    color: "0.93 0.90 0.85",
  });
  pdf.drawText("RELATORIO DE CUSTOS DA PLANILHA EAP", pdf.margin, 58, {
    size: 15,
    bold: true,
    color: "1 1 1",
  });
  pdf.drawText(
    `${payload.meta.projectName} · Cliente: ${payload.meta.clientName} · ${payload.meta.cityLabel}`,
    pdf.margin,
    80,
    { size: 10, color: "0.85 0.87 0.90" }
  );
  pdf.drawText(
    `Area: ${payload.meta.builtAreaM2} m2 · Revisao: R${String(payload.meta.revision).padStart(2, "0")} · BDI: ${payload.meta.bdiPercent}%${payload.meta.isParametricFallback ? " · Estimativa Parametrica" : ""}`,
    pdf.margin,
    96,
    { size: 8.5, color: "0.70 0.74 0.80" }
  );
  pdf.y = 124;

  // Ficha KPI Resumo
  pdf.heading("1. Resumo Executivo de Custos & Quantidades-Chave");
  pdf.keyValueGrid(
    [
      { label: "Total Geral (c/ BDI)", value: fmtBRL(payload.kpis.totalCommercialPrice) },
      { label: "Custo por m2 (c/ BDI)", value: `${fmtBRL(payload.kpis.costPerM2)}/m2` },
      { label: "Custo Direto Total", value: fmtBRL(payload.kpis.totalDirectCost) },
      { label: `BDI Aplicado (${payload.kpis.bdiPercent}%)`, value: fmtBRL(payload.kpis.bdiValue) },
      {
        label: `Materiais (${payload.kpis.materialSharePercent.toFixed(1)}%)`,
        value: fmtBRL(payload.kpis.totalMaterialCost),
      },
      {
        label: `Mao de Obra (${payload.kpis.laborSharePercent.toFixed(1)}%)`,
        value: fmtBRL(payload.kpis.totalLaborCost),
      },
      {
        label: `Terceiros (${payload.kpis.thirdPartySharePercent.toFixed(1)}%)`,
        value: fmtBRL(payload.kpis.totalThirdPartyCost),
      },
      { label: "Itens Orcados na EAP", value: `${payload.kpis.totalItemsCount} itens` },
    ],
    { columns: 2, labelWidth: 118 }
  );

  pdf.y += 4;
  pdf.flowText(
    `Quantidades-Chave: Concreto: ${payload.kpis.concreteM3.toFixed(1)} m3 · Aco: ${payload.kpis.steelKg.toFixed(0)} kg · Alvenaria: ${payload.kpis.masonryM2.toFixed(1)} m2 · Pisos/Revest.: ${payload.kpis.ceramicTileM2.toFixed(1)} m2 · Coberta: ${payload.kpis.roofM2.toFixed(1)} m2`,
    { size: 8.5, bold: true, color: "#334155", gapAfter: 10 }
  );

  // 2. Custos por Pavimento
  pdf.heading("2. Distribuicao de Custos por Pavimento / Zona");
  pdf.table({
    columns: [
      { title: "Pavimento / Zona", weight: 2.2 },
      { title: "Material", weight: 1.3 },
      { title: "Mao de Obra", weight: 1.3 },
      { title: "Terceiros", weight: 1.2 },
      { title: "Total c/ BDI", weight: 1.4 },
      { title: "% Part.", weight: 0.8 },
    ],
    rows: payload.byFloor.map((f) => [
      f.label,
      fmtBRL(f.materialCost),
      fmtBRL(f.laborCost),
      fmtBRL(f.thirdPartyCost),
      fmtBRL(f.commercialPrice),
      `${f.sharePercent.toFixed(1)}%`,
    ]),
    size: 8,
  });

  pdf.y += 10;

  // 3. Custos por Disciplina
  pdf.heading("3. Custos por Disciplina Tecnica");
  pdf.table({
    columns: [
      { title: "Disciplina", weight: 2.3 },
      { title: "Itens", weight: 0.7 },
      { title: "Custo Direto", weight: 1.4 },
      { title: "Total c/ BDI", weight: 1.5 },
      { title: "% Part.", weight: 0.8 },
    ],
    rows: payload.byDiscipline.map((d) => [
      d.discipline,
      String(d.itemsCount),
      fmtBRL(d.directCost),
      fmtBRL(d.commercialPrice),
      `${d.sharePercent.toFixed(1)}%`,
    ]),
    size: 8,
  });

  pdf.y += 10;

  // 4. Custos por Fase Construtiva
  pdf.heading("4. Custos por Fase Construtiva");
  pdf.table({
    columns: [
      { title: "Fase Construtiva", weight: 2.5 },
      { title: "Etapas", weight: 0.7 },
      { title: "Custo Direto", weight: 1.4 },
      { title: "Total c/ BDI", weight: 1.5 },
      { title: "% Part.", weight: 0.8 },
    ],
    rows: payload.byPhase.map((p) => [
      p.phaseName,
      String(p.stagesCount),
      fmtBRL(p.directCost),
      fmtBRL(p.commercialPrice),
      `${p.sharePercent.toFixed(1)}%`,
    ]),
    size: 8,
  });

  pdf.y += 10;

  // 5. Etapas Analíticas da EAP
  pdf.heading("5. Resumo Analitico por Etapa da EAP");
  pdf.table({
    columns: [
      { title: "Etapa", weight: 2.4 },
      { title: "Disciplina", weight: 1.4 },
      { title: "Material", weight: 1.2 },
      { title: "Mao de Obra", weight: 1.2 },
      { title: "Total c/ BDI", weight: 1.4 },
      { title: "%", weight: 0.7 },
    ],
    rows: payload.stages
      .filter((s) => s.commercialPrice > 0)
      .map((s) => [
        `${s.code} - ${s.name}`,
        s.discipline,
        fmtBRL(s.materialCost),
        fmtBRL(s.laborCost),
        fmtBRL(s.commercialPrice),
        `${s.sharePercent.toFixed(1)}%`,
      ]),
    size: 7.5,
  });

  pdf.y += 10;

  // 6. Curva ABC (Top 15)
  pdf.heading("6. Curva ABC de Insumos & Servicos (Top 15)");
  pdf.flowText(
    `Classe A: ${payload.abcCurve.summaryByClass.A.count} itens (${payload.abcCurve.summaryByClass.A.sharePercent.toFixed(1)}%) · Classe B: ${payload.abcCurve.summaryByClass.B.count} itens (${payload.abcCurve.summaryByClass.B.sharePercent.toFixed(1)}%) · Classe C: ${payload.abcCurve.summaryByClass.C.count} itens (${payload.abcCurve.summaryByClass.C.sharePercent.toFixed(1)}%)`,
    { size: 8.5, bold: true, color: "#334155", gapAfter: 5 }
  );
  pdf.table({
    columns: [
      { title: "Classe", weight: 0.6 },
      { title: "Descricao", weight: 2.8 },
      { title: "Qtd", weight: 0.9 },
      { title: "Total c/ BDI", weight: 1.3 },
      { title: "% Acum.", weight: 0.9 },
    ],
    rows: payload.abcCurve.items.slice(0, 15).map((item) => [
      item.abcClass,
      `${item.stageCode} · ${item.description}`,
      `${item.quantity} ${item.unit}`,
      fmtBRL(item.totalCommercialPrice),
      `${item.cumulativePercent.toFixed(1)}%`,
    ]),
    size: 7.5,
  });

  if (payload.teams.length > 0) {
    pdf.y += 10;
    pdf.heading("7. Equipes & Composição de Mao de Obra");
    pdf.table({
      columns: [
        { title: "Equipe", weight: 1.5 },
        { title: "Especialidade", weight: 1.5 },
        { title: "Efetivo", weight: 0.7 },
        { title: "Custo Diario Est.", weight: 1.2 },
      ],
      rows: payload.teams.map((t) => [
        `${t.teamCode} - ${t.name}`,
        t.specialty,
        `${t.headcount} prof.`,
        fmtBRL(t.dailyCostEstimate),
      ]),
      size: 8,
    });
  }

  if (payload.premises.length > 0 || payload.exclusions.length > 0) {
    pdf.y += 10;
    pdf.heading("8. Premissas & Exclusoes Tecnicas");
    if (payload.premises.length > 0) {
      pdf.flowText("Premissas:", { size: 9, bold: true, gapAfter: 2 });
      for (const pr of payload.premises) {
        pdf.flowText(`• ${pr}`, { size: 8, indent: 8, gapAfter: 2 });
      }
    }
    if (payload.exclusions.length > 0) {
      pdf.y += 4;
      pdf.flowText("Itens Nao Inclusos:", { size: 9, bold: true, gapAfter: 2 });
      for (const ex of payload.exclusions) {
        pdf.flowText(`• ${ex}`, { size: 8, indent: 8, gapAfter: 2 });
      }
    }
  }

  pdf.stampFooters(`ArqVértice OS · Custos EAP · ${payload.meta.projectName}`);
  return pdf.build();
}
