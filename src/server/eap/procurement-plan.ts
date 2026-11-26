import { prisma } from "@/server/db";
import { round2 } from "@/server/eap/calculator";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import {
  drawPdfBrandedHeader,
  drawPdfHorizontalBarChart,
  drawPdfKpiCardsRow,
  PDF_PALETTE,
} from "@/lib/pdf/pdf-charts";
import type { LobFloorAllocationItem } from "@/lib/eap-lob-grid";

export type ProcurementStatus =
  | "A_COTAR"
  | "EM_COTACAO"
  | "PEDIDO_EMITIDO"
  | "ENTREGUE";

export type ProcurementCategory = "MATERIAL" | "TERCEIROS" | "EQUIPAMENTO";

export interface EapProcurementItemDTO {
  id: string;
  eapProjectId: string;
  packageId: string | null;
  packageNumber: number | null;
  packageName: string;
  stageCode: string | null;
  itemName: string;
  category: ProcurementCategory;
  unit: string;
  quantity: number;
  estimatedAmount: number;
  closedAmount: number | null;
  supplierName: string | null;
  needDate: string;
  leadTimeDays: number;
  orderDeadlineDate: string;
  status: ProcurementStatus;
  financialEntryId: string | null;
  notes: string | null;
}

export interface ProcurementPlanSummaryDTO {
  totalItems: number;
  totalEstimated: number;
  totalClosed: number;
  totalCommittedFinance: number;
  toQuoteCount: number;
  quotingCount: number;
  orderedCount: number;
  deliveredCount: number;
  urgentCount: number;
}

export function addWorkingDays(base: Date, workingDays: number): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  if (workingDays === 0) return d;
  const step = workingDays > 0 ? 1 : -1;
  let remaining = Math.abs(Math.trunc(workingDays));
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return d;
}

export function subtractWorkingDays(base: Date, workingDays: number): Date {
  return addWorkingDays(base, -Math.max(0, Math.trunc(workingDays)));
}

export function inferProcurementLeadTimeDays(
  stageCode: string | null,
  itemName: string,
  category: ProcurementCategory
): number {
  const norm = `${stageCode || ""} ${itemName}`.toLowerCase();
  if (
    norm.includes("esquadria") ||
    norm.includes("alumínio") ||
    norm.includes("aluminio") ||
    norm.includes("vidro") ||
    norm.includes("mármore") ||
    norm.includes("marmore") ||
    norm.includes("granito") ||
    norm.includes("elevador")
  ) {
    return 25;
  }
  if (
    norm.includes("louça") ||
    norm.includes("louca") ||
    norm.includes("metal") ||
    norm.includes("lumin") ||
    norm.includes("porcelanato") ||
    norm.includes("piscina")
  ) {
    return 18;
  }
  if (
    norm.includes("aço") ||
    norm.includes("aco") ||
    norm.includes("concreto") ||
    norm.includes("impermeabil") ||
    norm.includes("cobertura") ||
    norm.includes("telha")
  ) {
    return 12;
  }
  if (category === "TERCEIROS") {
    return 15;
  }
  return 10;
}

export interface ProcurementPlanSeedInput {
  plannedStartDate: Date;
  stages: Array<{
    code: string;
    name: string;
    items: Array<{
      description: string;
      unit: string;
      quantity: number;
      materialUnitCost: number;
      thirdPartyUnitCost: number;
    }>;
  }>;
  lobAllocations: LobFloorAllocationItem[];
  servicePackages: Array<{
    id: string;
    packageNumber: number;
    name: string;
    linkedStageCodes: string[];
  }>;
  schedulePackages: Array<{
    id: string;
    packageNumber: number;
    name: string;
    linkedStageCodes: string[];
    segments: Array<{ startDate: Date }>;
  }>;
}

export interface GeneratedProcurementRow {
  packageId: string | null;
  packageNumber: number | null;
  packageName: string;
  stageCode: string;
  itemName: string;
  category: ProcurementCategory;
  unit: string;
  quantity: number;
  estimatedAmount: number;
  needDate: Date;
  leadTimeDays: number;
  orderDeadlineDate: Date;
}

/**
 * Cruza os insumos/materiais e terceiros da Planilha EAP com as datas de início
 * dos pacotes no Planejamento LOB para gerar o Plano de Aquisições.
 */
export function buildProcurementPlanRows(
  input: ProcurementPlanSeedInput
): GeneratedProcurementRow[] {
  const pkgStartByNumber = new Map<number, Date>();

  // 1. Prioriza datas reais vindas das alocações LOB (dateIso)
  const minDateByPkg = new Map<number, string>();
  for (const alloc of input.lobAllocations) {
    if (!alloc.dateIso) continue;
    const prev = minDateByPkg.get(alloc.packageNumber);
    if (!prev || alloc.dateIso < prev) {
      minDateByPkg.set(alloc.packageNumber, alloc.dateIso);
    }
  }
  for (const [pkgNum, dateIso] of minDateByPkg.entries()) {
    pkgStartByNumber.set(pkgNum, new Date(`${dateIso}T00:00:00.000Z`));
  }

  // 2. Fallback para ScheduleSegment quando não há matriz por pavimento
  for (const sp of input.schedulePackages) {
    if (!pkgStartByNumber.has(sp.packageNumber) && sp.segments.length > 0) {
      const earliest = sp.segments.reduce(
        (min, s) => (s.startDate < min ? s.startDate : min),
        sp.segments[0].startDate
      );
      pkgStartByNumber.set(sp.packageNumber, earliest);
    }
  }

  // Mapeia stageCode -> pacote correspondente
  const stageToPackage = new Map<
    string,
    { id: string | null; packageNumber: number; name: string; needDate: Date }
  >();

  for (const sp of input.schedulePackages) {
    const needDate =
      pkgStartByNumber.get(sp.packageNumber) ??
      addWorkingDays(input.plannedStartDate, Math.max(0, (sp.packageNumber - 1) * 5));
    for (const code of sp.linkedStageCodes) {
      if (!stageToPackage.has(code)) {
        stageToPackage.set(code, {
          id: sp.id,
          packageNumber: sp.packageNumber,
          name: sp.name,
          needDate,
        });
      }
    }
  }

  for (const svc of input.servicePackages) {
    const needDate =
      pkgStartByNumber.get(svc.packageNumber) ??
      addWorkingDays(input.plannedStartDate, Math.max(0, (svc.packageNumber - 1) * 5));
    for (const code of svc.linkedStageCodes) {
      if (!stageToPackage.has(code)) {
        stageToPackage.set(code, {
          id: null,
          packageNumber: svc.packageNumber,
          name: svc.name,
          needDate,
        });
      }
    }
  }

  const rows: GeneratedProcurementRow[] = [];

  for (const stage of input.stages) {
    const pkgMeta = stageToPackage.get(stage.code) ?? {
      id: null,
      packageNumber: Number(stage.code) || 1,
      name: stage.name,
      needDate: addWorkingDays(input.plannedStartDate, Math.max(0, (Number(stage.code) - 1) * 6)),
    };

    for (const item of stage.items) {
      if (item.quantity <= 0) continue;
      const matTotal = item.quantity * item.materialUnitCost;
      const thirdTotal = item.quantity * item.thirdPartyUnitCost;
      const estimated = Math.round((matTotal + thirdTotal) * 100) / 100;
      if (estimated <= 0) continue;

      const category: ProcurementCategory =
        thirdTotal > matTotal
          ? "TERCEIROS"
          : item.description.toLowerCase().includes("locaç") ||
            item.description.toLowerCase().includes("equip")
            ? "EQUIPAMENTO"
            : "MATERIAL";

      const leadTimeDays = inferProcurementLeadTimeDays(
        stage.code,
        item.description,
        category
      );
      const orderDeadlineDate = subtractWorkingDays(pkgMeta.needDate, leadTimeDays);

      rows.push({
        packageId: pkgMeta.id,
        packageNumber: pkgMeta.packageNumber,
        packageName: pkgMeta.name,
        stageCode: stage.code,
        itemName: item.description,
        category,
        unit: item.unit || "un",
        quantity: Math.round(item.quantity * 100) / 100,
        estimatedAmount: estimated,
        needDate: pkgMeta.needDate,
        leadTimeDays,
        orderDeadlineDate,
      });
    }
  }

  rows.sort((a, b) => a.orderDeadlineDate.getTime() - b.orderDeadlineDate.getTime());
  return rows;
}

export function summarizeProcurementItems(
  items: ReadonlyArray<EapProcurementItemDTO>,
  now = new Date()
): ProcurementPlanSummaryDTO {
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let totalEstimated = 0;
  let totalClosed = 0;
  let totalCommittedFinance = 0;
  let toQuoteCount = 0;
  let quotingCount = 0;
  let orderedCount = 0;
  let deliveredCount = 0;
  let urgentCount = 0;

  for (const item of items) {
    totalEstimated += item.estimatedAmount;
    if (item.closedAmount !== null) totalClosed += item.closedAmount;
    if (item.financialEntryId) {
      totalCommittedFinance += item.closedAmount ?? item.estimatedAmount;
    }
    if (item.status === "A_COTAR") toQuoteCount += 1;
    else if (item.status === "EM_COTACAO") quotingCount += 1;
    else if (item.status === "PEDIDO_EMITIDO") orderedCount += 1;
    else if (item.status === "ENTREGUE") deliveredCount += 1;

    if (
      (item.status === "A_COTAR" || item.status === "EM_COTACAO") &&
      new Date(item.orderDeadlineDate) <= sevenDaysAhead
    ) {
      urgentCount += 1;
    }
  }

  return {
    totalItems: items.length,
    totalEstimated: Math.round(totalEstimated * 100) / 100,
    totalClosed: Math.round(totalClosed * 100) / 100,
    totalCommittedFinance: Math.round(totalCommittedFinance * 100) / 100,
    toQuoteCount,
    quotingCount,
    orderedCount,
    deliveredCount,
    urgentCount,
  };
}

function toDto(row: {
  id: string;
  eapProjectId: string;
  packageId: string | null;
  packageNumber: number | null;
  packageName: string;
  stageCode: string | null;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  estimatedAmount: number;
  closedAmount: number | null;
  supplierName: string | null;
  needDate: Date;
  leadTimeDays: number;
  orderDeadlineDate: Date;
  status: string;
  financialEntryId: string | null;
  notes: string | null;
}): EapProcurementItemDTO {
  return {
    id: row.id,
    eapProjectId: row.eapProjectId,
    packageId: row.packageId,
    packageNumber: row.packageNumber,
    packageName: row.packageName,
    stageCode: row.stageCode,
    itemName: row.itemName,
    category: (row.category as ProcurementCategory) || "MATERIAL",
    unit: row.unit,
    quantity: row.quantity,
    estimatedAmount: row.estimatedAmount,
    closedAmount: row.closedAmount,
    supplierName: row.supplierName,
    needDate: row.needDate.toISOString(),
    leadTimeDays: row.leadTimeDays,
    orderDeadlineDate: row.orderDeadlineDate.toISOString(),
    status: (row.status as ProcurementStatus) || "A_COTAR",
    financialEntryId: row.financialEntryId,
    notes: row.notes,
  };
}

export async function getProcurementPlanForProject(projectId: string) {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      procurementItems: {
        orderBy: [{ orderDeadlineDate: "asc" }, { packageNumber: "asc" }],
      },
    },
  });

  if (!eap) {
    throw new Error("EAP não inicializada para este projeto.");
  }

  const items = eap.procurementItems.map(toDto);
  return {
    eapProjectId: eap.id,
    projectId: eap.projectId,
    title: eap.title,
    items,
    summary: summarizeProcurementItems(items),
  };
}

export async function generateProcurementPlanForProject(projectId: string) {
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
      lobFloorAllocations: true,
      servicePackages: { orderBy: { packageNumber: "asc" } },
      schedulePackages: {
        orderBy: { packageNumber: "asc" },
        include: { segments: { orderBy: { startDate: "asc" } } },
      },
      procurementItems: true,
    },
  });

  if (!eap) {
    throw new Error("EAP não inicializada para este projeto.");
  }

  const plannedStart = eap.plannedStartDate ?? new Date();

  const generated = buildProcurementPlanRows({
    plannedStartDate: plannedStart,
    stages: eap.stages.map((st) => ({
      code: st.code,
      name: st.name,
      items: st.groups.flatMap((g) =>
        g.items.map((i) => {
          const zq =
            i.zoneQuantitiesJson && typeof i.zoneQuantitiesJson === "object"
              ? (i.zoneQuantitiesJson as Record<string, unknown>)
              : {};
          const rawQty = Object.values(zq).reduce<number>(
            (acc, val) => acc + (typeof val === "number" && Number.isFinite(val) ? val : 0),
            0
          );
          return {
            description: i.description,
            unit: i.unit,
            quantity: rawQty,
            materialUnitCost: i.materialUnitCost,
            thirdPartyUnitCost: i.thirdPartyUnitCost,
          };
        })
      ),
    })),
    lobAllocations: eap.lobFloorAllocations.map((a) => ({
      floorId: a.floorId,
      floorName: a.floorName,
      floorOrder: a.floorOrder,
      dateIso: a.dateIso,
      packageNumber: a.packageNumber,
      teamCode: a.teamCode,
      isOvertime: a.isOvertime,
      dataOrigin: a.dataOrigin,
    })),
    servicePackages: eap.servicePackages.map((sp) => ({
      id: sp.id,
      packageNumber: sp.packageNumber,
      name: sp.name,
      linkedStageCodes: sp.linkedEapStageCodes ?? [],
    })),
    schedulePackages: eap.schedulePackages.map((sp) => ({
      id: sp.id,
      packageNumber: sp.packageNumber,
      name: sp.name,
      linkedStageCodes: Array.isArray(sp.linkedStageCodesJson)
        ? (sp.linkedStageCodesJson as string[])
        : [],
      segments: sp.segments.map((seg) => ({ startDate: seg.startDate })),
    })),
  });

  // Preserva itens já em cotação/comprados/entregues ou com fornecedor/valor fechado;
  // substitui apenas A_COTAR em aberto sem financeiro
  const isLockedProcurement = (i: {
    status: string;
    financialEntryId: string | null;
    supplierName: string | null;
    closedAmount: number | null;
  }) =>
    i.status !== "A_COTAR" ||
    Boolean(i.financialEntryId) ||
    Boolean(i.supplierName) ||
    i.closedAmount !== null;

  const lockedKeys = new Set(
    eap.procurementItems
      .filter(isLockedProcurement)
      .map((i) => `${i.stageCode || ""}::${i.itemName.toLowerCase()}`)
  );

  await prisma.eapProcurementItem.deleteMany({
    where: {
      eapProjectId: eap.id,
      status: "A_COTAR",
      financialEntryId: null,
      supplierName: null,
      closedAmount: null,
    },
  });

  const toCreate = generated.filter(
    (row) => !lockedKeys.has(`${row.stageCode}::${row.itemName.toLowerCase()}`)
  );

  if (toCreate.length > 0) {
    await prisma.eapProcurementItem.createMany({
      data: toCreate.map((row) => ({
        eapProjectId: eap.id,
        packageId: row.packageId,
        packageNumber: row.packageNumber,
        packageName: row.packageName,
        stageCode: row.stageCode,
        itemName: row.itemName,
        category: row.category,
        unit: row.unit,
        quantity: row.quantity,
        estimatedAmount: row.estimatedAmount,
        needDate: row.needDate,
        leadTimeDays: row.leadTimeDays,
        orderDeadlineDate: row.orderDeadlineDate,
        status: "A_COTAR",
      })),
    });
  }

  return getProcurementPlanForProject(projectId);
}

/**
 * Sincroniza um ou todos os itens com Pedido Emitido / Entregue com o módulo Gestão Financeira
 * criando/atualizando registros idempotentes em `ProjectInstallment`.
 */
export async function syncProcurementToFinance(
  projectId: string,
  specificItemId?: string
) {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      procurementItems: {
        where: specificItemId
          ? { id: specificItemId }
          : { status: { in: ["PEDIDO_EMITIDO", "ENTREGUE"] } },
        orderBy: { needDate: "asc" },
      },
    },
  });

  if (!eap) {
    throw new Error("EAP não inicializada para este projeto.");
  }

  const maxOrderAgg = await prisma.projectInstallment.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  let nextOrder = (maxOrderAgg._max.order ?? 0) + 1;
  let syncedCount = 0;

  for (const item of eap.procurementItems) {
    const amount = item.closedAmount ?? item.estimatedAmount;
    const sourceKey = `eap-procurement:${item.id}`;
    const desc = `[Compra Obra] ${item.itemName}${item.supplierName ? ` — ${item.supplierName}` : ""}`;
    const financeStatus = item.status === "ENTREGUE" ? "PAID" : "PENDING";

    const existing = await prisma.projectInstallment.findUnique({
      where: { sourceKey },
    });

    let entryId: string;
    if (existing) {
      const updated = await prisma.projectInstallment.update({
        where: { id: existing.id },
        data: {
          description: desc,
          amount,
          dueDate: item.needDate,
          status: financeStatus,
          paidDate: item.status === "ENTREGUE" ? existing.paidDate ?? new Date() : null,
          version: { increment: 1 },
        },
      });
      entryId = updated.id;
    } else {
      const created = await prisma.projectInstallment.create({
        data: {
          projectId,
          description: desc,
          amount,
          dueDate: item.needDate,
          paidDate: item.status === "ENTREGUE" ? new Date() : null,
          status: financeStatus,
          order: nextOrder++,
          sourceKey,
        },
      });
      entryId = created.id;
    }

    if (item.financialEntryId !== entryId) {
      await prisma.eapProcurementItem.update({
        where: { id: item.id },
        data: { financialEntryId: entryId },
      });
    }
    syncedCount += 1;
  }

  const plan = await getProcurementPlanForProject(projectId);
  return {
    syncedCount,
    totalCommittedFinance: plan.summary.totalCommittedFinance,
    plan,
  };
}

function formatBrl(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDateBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const STATUS_LABEL: Record<ProcurementStatus, string> = {
  A_COTAR: "A Cotar",
  EM_COTACAO: "Em Cotacao",
  PEDIDO_EMITIDO: "Pedido Emitido",
  ENTREGUE: "Entregue",
};

export interface ProcurementMonthlyRow {
  monthKey: string;
  monthLabel: string;
  mainPackages: string;
  monthlyAmount: number;
  cumulativeAmount: number;
  cumulativePct: number;
}

export function buildProcurementMonthlyDisbursement(
  items: EapProcurementItemDTO[]
): ProcurementMonthlyRow[] {
  const byMonth = new Map<string, { amount: number; pkgs: Set<string> }>();
  for (const item of items) {
    const iso = (item.orderDeadlineDate || item.needDate || "").slice(0, 7);
    const monthKey = /^\d{4}-\d{2}$/.test(iso) ? iso : "2026-01";
    const curr = byMonth.get(monthKey) ?? { amount: 0, pkgs: new Set<string>() };
    curr.amount = round2(curr.amount + (item.closedAmount ?? item.estimatedAmount ?? 0));
    if (item.packageName) curr.pkgs.add(item.packageName);
    byMonth.set(monthKey, curr);
  }

  const sortedKeys = Array.from(byMonth.keys()).sort();
  const total = sortedKeys.reduce((s, k) => s + (byMonth.get(k)?.amount ?? 0), 0);
  let cum = 0;

  return sortedKeys.map((k) => {
    const entry = byMonth.get(k)!;
    cum = round2(cum + entry.amount);
    const [yr, mo] = k.split("-");
    const monthLabel = `${mo}/${yr.slice(2)}`;
    const mainPackages = Array.from(entry.pkgs).slice(0, 2).join(", ") || "Suprimentos Gerais";
    return {
      monthKey: k,
      monthLabel,
      mainPackages,
      monthlyAmount: entry.amount,
      cumulativeAmount: cum,
      cumulativePct: total > 0 ? round2((cum / total) * 100) : 0,
    };
  });
}

export async function buildProcurementPdfBuffer(projectId: string): Promise<Buffer> {
  const plan = await getProcurementPlanForProject(projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      client: { select: { name: true } },
      eapProject: {
        select: {
          builtAreaM2: true,
          currentRevision: true,
          city: { select: { name: true, state: true } },
        },
      },
    },
  });

  const cityLabel = project?.eapProject?.city
    ? `${project.eapProject.city.name}/${project.eapProject.city.state}`
    : "Fortaleza/CE";
  const areaM2 = project?.eapProject?.builtAreaM2 ?? 0;
  const rev = project?.eapProject?.currentRevision ?? 1;

  const title = `Aquisicoes & Calendario de Suprimentos — ${project?.name || plan.title}`;
  const subtitle = `Cliente: ${project?.client?.name || "—"} · ${cityLabel}`;
  const metaLine = `Area Construida: ${areaM2} m2 · Revisao: R${String(rev).padStart(2, "0")} · ${plan.summary.totalItems} itens · Gerado em ${new Date().toLocaleDateString("pt-BR")}`;

  const pdf = new PdfWriter({
    title,
    author: "ArqVertice OS",
    subject: "Plano de Aquisicoes, Curva S e Calendario de Suprimentos",
  });

  drawPdfBrandedHeader(pdf, {
    eyebrow: "ARQVERTICE OS · AQUISICOES & SUPRIMENTOS",
    title: "Aquisicoes & Calendario de Suprimentos",
    subtitle,
    metaLine,
    accentHex: "#0EA5E9",
  });

  drawPdfKpiCardsRow(pdf, [
    {
      label: "Orcamento Total",
      value: formatBrl(plan.summary.totalEstimated),
      accentHex: PDF_PALETTE[0],
    },
    {
      label: "Comprometido",
      value: formatBrl(plan.summary.totalCommittedFinance || plan.summary.totalClosed),
      accentHex: PDF_PALETTE[1],
    },
    {
      label: "Saldo a Contratar",
      value: formatBrl(
        Math.max(0, plan.summary.totalEstimated - (plan.summary.totalCommittedFinance || plan.summary.totalClosed))
      ),
      accentHex: PDF_PALETTE[4],
    },
    {
      label: "Urgentes (<= 7 dias)",
      value: `${plan.summary.urgentCount} itens`,
      accentHex: plan.summary.urgentCount > 0 ? PDF_PALETTE[2] : PDF_PALETTE[1],
    },
  ]);

  const monthlyRows = buildProcurementMonthlyDisbursement(plan.items);

  if (monthlyRows.length > 0) {
    pdf.ensure(40);
    pdf.heading("1. Curva S Financeira Acumulada e Fluxo de Desembolso Mensal");

    drawPdfHorizontalBarChart(pdf, {
      title: "Curva S Financeira — Desembolso Previsto Acumulado (%)",
      items: monthlyRows.map((m) => ({
        label: m.monthLabel,
        value: m.cumulativePct,
        formattedValue: `${m.cumulativePct.toFixed(1).replace(".", ",")}% (${formatBrl(m.cumulativeAmount)})`,
        colorHex: "#2563EB",
      })),
    });

    drawPdfHorizontalBarChart(pdf, {
      title: "Fluxo de Desembolso Mensal Previsto (R$/Mes)",
      items: monthlyRows.map((m, idx) => ({
        label: m.monthLabel,
        value: m.monthlyAmount,
        formattedValue: formatBrl(m.monthlyAmount),
        colorHex: PDF_PALETTE[idx % PDF_PALETTE.length],
      })),
    });

    pdf.ensure(40);
    pdf.heading("2. Tabela Consolidada de Desembolso Mensal");
    pdf.table({
      columns: [
        { title: "Mes/Ano", weight: 0.9 },
        { title: "Principais Pacotes/Compras do Mes", weight: 2.8 },
        { title: "Desembolso Mensal", weight: 1.3, align: "right" },
        { title: "Acumulado (R$)", weight: 1.3, align: "right" },
        { title: "% Acum.", weight: 0.9, align: "right" },
      ],
      rows: monthlyRows.map((m) => [
        m.monthLabel,
        m.mainPackages,
        formatBrl(m.monthlyAmount),
        formatBrl(m.cumulativeAmount),
        `${m.cumulativePct.toFixed(1).replace(".", ",")}%`,
      ]),
    });
  }

  pdf.ensure(40);
  pdf.heading("3. Calendario de Suprimentos e Compras da Obra");

  pdf.table({
    columns: [
      { title: "Data Limite Pedido", weight: 1.1 },
      { title: "Necessidade Obra", weight: 1.1 },
      { title: "Insumo / Servico", weight: 2.6 },
      { title: "Pacote", weight: 1.5 },
      { title: "Valor Previsto", weight: 1.2, align: "right" },
      { title: "Status", weight: 1.0 },
    ],
    rows: plan.items.map((item) => [
      formatDateBr(item.orderDeadlineDate),
      formatDateBr(item.needDate),
      item.itemName,
      item.packageName,
      formatBrl(item.closedAmount ?? item.estimatedAmount),
      STATUS_LABEL[item.status] || item.status,
    ]),
  });

  return Buffer.from(pdf.build());
}
