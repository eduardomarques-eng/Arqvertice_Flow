import { prisma } from "@/server/db";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import {
  drawPdfBrandedHeader,
  drawPdfGanttTimeline,
  drawPdfHorizontalBarChart,
  drawPdfKpiCardsRow,
  drawPdfMonthlyHistogram,
  PDF_PALETTE,
} from "@/lib/pdf/pdf-charts";
import {
  CONCRETE_METHOD_LABELS,
  CONSTRUCTION_STANDARD_LABELS,
  type ConcreteMethod,
  type ConstructionStandard,
} from "./regional-standards-catalog";
import {
  CANONICAL_LOB_PACKAGE_RULES,
  DEFAULT_LOB_FLOORS,
  analyzeFloorMatrixConflicts,
  normalizeLobFloorId,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
  type LobFloorDefinition,
} from "@/lib/eap-lob-grid";

export interface EapScheduleReportPackageDTO {
  packageNumber: number;
  packageName: string;
  phaseOrder: number;
  phaseName: string;
  phaseGroupKey: string;
  phaseGroupTitle: string;
  phaseGroupColorHex: string;
  discipline: string;
  corHex: string;
  floorsLabel: string;
  teamCodes: string[];
  predecessorNumbers: number[];
  cureLagWorkingDays: number;
  startDate: string;
  endDate: string;
  workingDays: number;
  startRatio: number;
  widthRatio: number;
  cureWidthRatio: number;
  status: string;
}

export interface EapScheduleReportMonthDTO {
  monthKey: string;
  monthLabel: string;
  teamDays: Record<string, number>;
  totalDays: number;
}

export interface EapScheduleReportFloorDTO {
  floorId: string;
  floorName: string;
  workingDays: number;
  sharePercent: number;
}

export interface EapScheduleReportTeamDTO {
  teamCode: string;
  name: string;
  specialty: string;
  totalAllocatedDays: number;
  maxSimultaneousFronts: number;
}

export interface EapScheduleReportPayload {
  meta: {
    projectId: string;
    projectName: string;
    clientName: string;
    cityLabel: string;
    title: string;
    builtAreaM2: number;
    status: string;
    revision?: number;
    bdiPercent?: number;
    constructionStandardLabel?: string;
    concreteMethodLabel?: string;
  };
  kpis: {
    startDate: string;
    endDate: string;
    workingDaysTotal: number;
    calendarDaysTotal: number;
    monthsEstimated: number;
    activePackagesCount: number;
    teamsCount: number;
    totalAllocatedCells: number;
    teamOverloads: number;
    precedenceViolations: number;
    daysSavedByParallelism: number;
    healthLabel: string;
  };
  packages: EapScheduleReportPackageDTO[];
  monthlyHistogram: EapScheduleReportMonthDTO[];
  byFloor: EapScheduleReportFloorDTO[];
  teams: EapScheduleReportTeamDTO[];
}

const MONTH_ABBR_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatDateBR(iso: string): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${MONTH_ABBR_PT[idx]}/${y.slice(2)}`;
}

const PHASE_LABELS: Record<number, string> = {
  1: "Preliminares & Locação",
  2: "Terraplanagem & Fundações",
  3: "Supraestrutura",
  4: "Alvenaria & Vedações",
  5: "Cobertura & Impermeabilização",
  6: "Instalações & Embutidos",
  7: "Chapisco, Reboco & Regularização",
  8: "Revestimentos, Esquadrias & Pintura",
  9: "Acabamentos Finais & Entrega",
};

function resolveGanttPhaseGroup(phaseOrder: number): {
  key: string;
  title: string;
  colorHex: string;
} {
  if (phaseOrder <= 2) {
    return {
      key: "G1",
      title: "FASE 1 — IMPLANTAÇÃO & FUNDAÇÃO",
      colorHex: "#0E7490",
    };
  }
  if (phaseOrder <= 4) {
    return {
      key: "G2",
      title: "FASE 2 — SUPRAESTRUTURA & VEDAÇÃO",
      colorHex: "#4338CA",
    };
  }
  if (phaseOrder <= 6) {
    return {
      key: "G3",
      title: "FASE 3 — COBERTURA & INSTALAÇÕES",
      colorHex: "#0F766E",
    };
  }
  if (phaseOrder === 7) {
    return {
      key: "G4",
      title: "FASE 4 — REVESTIMENTOS & CURA",
      colorHex: "#C2410C",
    };
  }
  if (phaseOrder === 8) {
    return {
      key: "G5",
      title: "FASE 5 — ACABAMENTOS",
      colorHex: "#047857",
    };
  }
  return {
    key: "G6",
    title: "FASE 6 — FINAIS & ENTREGA",
    colorHex: "#475569",
  };
}

function sanitizeNoOnda(raw: string): string {
  return raw.replace(/\bOnda\b/gi, "Fase");
}

export function buildEapScheduleReportPayload(input: {
  meta: EapScheduleReportPayload["meta"];
  allocations: LobFloorAllocationItem[];
  floors: LobFloorDefinition[];
  servicePackages: FloorMatrixServicePackage[];
  workTeams: FloorMatrixWorkTeam[];
  holidaySet: Set<string>;
  plannedStartDate?: string | null;
}): EapScheduleReportPayload {
  const sortedAllocs = [...input.allocations].sort((a, b) =>
    a.dateIso.localeCompare(b.dateIso)
  );
  const allDates = sortedAllocs.map((a) => a.dateIso);
  const startDate =
    allDates[0] ??
    input.plannedStartDate ??
    new Date().toISOString().slice(0, 10);
  const endDate = allDates[allDates.length - 1] ?? startDate;

  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const calendarDaysTotal = Math.max(
    1,
    Math.round((endMs - startMs) / 86_400_000) + 1
  );
  const uniqueWorkingDays = new Set(allDates).size;
  const monthsEstimated = Math.max(
    1,
    Math.round((calendarDaysTotal / 30.4375) * 10) / 10
  );

  const conflictAnalysis = analyzeFloorMatrixConflicts({
    allocations: input.allocations,
    floors: input.floors,
    servicePackages: input.servicePackages,
    workTeams: input.workTeams,
    stageLoads: [],
    holidaySet: input.holidaySet,
  });

  const teamOverloads = conflictAnalysis.conflicts.filter(
    (c) => c.type === "TEAM_OVERLOAD"
  ).length;
  const precedenceViolations = conflictAnalysis.conflicts.filter(
    (c) => c.type === "PRECEDENCE_VIOLATION"
  ).length;
  const totalCritical = teamOverloads + precedenceViolations;

  const pkgMap = new Map(
    input.servicePackages.map((p) => [p.packageNumber, p])
  );
  const floorNameMap = new Map(
    input.floors.map((f) => [normalizeLobFloorId(f.floorId), f.floorName])
  );

  // Agrupa alocações por pacote
  const byPkg = new Map<number, LobFloorAllocationItem[]>();
  for (const a of sortedAllocs) {
    const list = byPkg.get(a.packageNumber) ?? [];
    list.push(a);
    byPkg.set(a.packageNumber, list);
  }

  const packages: EapScheduleReportPackageDTO[] = [];
  for (const [pkgNum, items] of Array.from(byPkg.entries()).sort(
    (a, b) => a[0] - b[0]
  )) {
    const pkgInfo = pkgMap.get(pkgNum);
    const rule = CANONICAL_LOB_PACKAGE_RULES[pkgNum];
    const pkgDates = items.map((i) => i.dateIso).sort();
    const pStart = pkgDates[0];
    const pEnd = pkgDates[pkgDates.length - 1];
    const pStartMs = Date.parse(`${pStart}T00:00:00Z`);
    const pEndMs = Date.parse(`${pEnd}T00:00:00Z`);

    const startRatio = Math.max(
      0,
      Math.min(0.98, (pStartMs - startMs) / Math.max(1, endMs - startMs))
    );
    const widthRatio = Math.max(
      0.015,
      Math.min(
        1 - startRatio,
        (pEndMs - pStartMs + 86_400_000) / Math.max(86_400_000, endMs - startMs + 86_400_000)
      )
    );

    const floorNames = Array.from(
      new Set(
        items.map(
          (i) =>
            floorNameMap.get(normalizeLobFloorId(i.floorId)) ?? i.floorName
        )
      )
    );
    const teamCodes = Array.from(new Set(items.map((i) => i.teamCode))).sort();
    const phaseOrder = rule?.phaseOrder ?? 5;
    const rawPhase = PHASE_LABELS[phaseOrder] ?? `Etapa ${phaseOrder}`;
    const phaseGroup = resolveGanttPhaseGroup(phaseOrder);
    const cureLagWorkingDays = rule?.cureLagWorkingDays ?? 0;
    const totalSpanDays = Math.max(1, (endMs - startMs) / 86_400_000 + 1);
    const cureWidthRatio =
      cureLagWorkingDays > 0
        ? Math.min(0.06, Math.max(0.01, (cureLagWorkingDays * 1.4) / totalSpanDays))
        : 0;

    packages.push({
      packageNumber: pkgNum,
      packageName: sanitizeNoOnda(pkgInfo?.name ?? `Pacote ${pkgNum}`),
      phaseOrder,
      phaseName: sanitizeNoOnda(`Fase ${phaseOrder} — ${rawPhase}`),
      phaseGroupKey: phaseGroup.key,
      phaseGroupTitle: phaseGroup.title,
      phaseGroupColorHex: phaseGroup.colorHex,
      discipline: sanitizeNoOnda(pkgInfo?.discipline ?? "Execução"),
      corHex: phaseGroup.colorHex,
      floorsLabel: floorNames.join(", "),
      teamCodes,
      predecessorNumbers: rule?.predecessorNumbers ?? pkgInfo?.predecessorNumbers ?? [],
      cureLagWorkingDays,
      startDate: pStart,
      endDate: pEnd,
      workingDays: items.length,
      startRatio,
      widthRatio,
      cureWidthRatio,
      status: "Programado",
    });
  }

  // Histograma mensal por equipe
  const monthTeamMap = new Map<string, Record<string, number>>();
  for (const a of sortedAllocs) {
    const mKey = a.dateIso.slice(0, 7);
    const rec = monthTeamMap.get(mKey) ?? {};
    rec[a.teamCode] = (rec[a.teamCode] ?? 0) + 1;
    monthTeamMap.set(mKey, rec);
  }
  const monthlyHistogram: EapScheduleReportMonthDTO[] = Array.from(
    monthTeamMap.entries()
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, teamDays]) => ({
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      teamDays,
      totalDays: Object.values(teamDays).reduce((s, v) => s + v, 0),
    }));

  // Distribuição de dias úteis por pavimento
  const floorCountMap = new Map<string, number>();
  for (const a of sortedAllocs) {
    const nf = normalizeLobFloorId(a.floorId);
    floorCountMap.set(nf, (floorCountMap.get(nf) ?? 0) + 1);
  }
  const totalAllocCount = Math.max(1, sortedAllocs.length);
  const byFloor: EapScheduleReportFloorDTO[] = input.floors.map((f) => {
    const nf = normalizeLobFloorId(f.floorId);
    const days = floorCountMap.get(nf) ?? 0;
    return {
      floorId: nf,
      floorName: f.floorName,
      workingDays: days,
      sharePercent: Math.round((days / totalAllocCount) * 1000) / 10,
    };
  });

  // Equipes
  const teamAllocMap = new Map<string, number>();
  for (const a of sortedAllocs) {
    teamAllocMap.set(a.teamCode, (teamAllocMap.get(a.teamCode) ?? 0) + 1);
  }
  const teams: EapScheduleReportTeamDTO[] = input.workTeams.map((t) => ({
    teamCode: t.teamCode,
    name: sanitizeNoOnda(t.name),
    specialty: sanitizeNoOnda(t.specialty),
    totalAllocatedDays: teamAllocMap.get(t.teamCode) ?? 0,
    maxSimultaneousFronts: t.maxSimultaneousFronts,
  }));

  return {
    meta: input.meta,
    kpis: {
      startDate,
      endDate,
      workingDaysTotal: uniqueWorkingDays,
      calendarDaysTotal,
      monthsEstimated,
      activePackagesCount: packages.length,
      teamsCount: teams.length,
      totalAllocatedCells: sortedAllocs.length,
      teamOverloads,
      precedenceViolations,
      daysSavedByParallelism: Math.max(0, sortedAllocs.length - uniqueWorkingDays),
      healthLabel:
        totalCritical === 0
          ? "0 conflitos (100% Coerente)"
          : `${totalCritical} alerta(s) crítico(s)`,
    },
    packages,
    monthlyHistogram,
    byFloor,
    teams,
  };
}

export async function loadEapScheduleReportFromDb(
  projectId: string
): Promise<EapScheduleReportPayload | null> {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      project: { include: { client: true } },
      city: { include: { holidays: { orderBy: { date: "asc" } } } },
      servicePackages: { orderBy: { packageNumber: "asc" } },
      workTeams: {
        orderBy: { teamCode: "asc" },
        include: { workers: true },
      },
      lobFloorAllocations: {
        orderBy: [{ dateIso: "asc" }, { floorOrder: "asc" }],
      },
    },
  });

  if (!eap) return null;

  const floors: LobFloorDefinition[] =
    Array.isArray(eap.lobFloorsJson) && eap.lobFloorsJson.length > 0
      ? (eap.lobFloorsJson as unknown as LobFloorDefinition[])
      : DEFAULT_LOB_FLOORS;

  const servicePackages: FloorMatrixServicePackage[] = eap.servicePackages.map(
    (sp) => ({
      packageNumber: sp.packageNumber,
      name: sp.name,
      discipline: sp.discipline,
      corHex: sp.corHex,
      textHex: sp.textHex,
      predecessorNumbers: sp.predecessorNumbers ?? [],
      productivityPerDay: sp.productivityPerDay,
      productivityUnit: sp.productivityUnit,
      linkedEapStageCodes: sp.linkedEapStageCodes ?? [],
      isActive: sp.isActive,
    })
  );

  const workTeams: FloorMatrixWorkTeam[] = eap.workTeams.map((wt) => ({
    teamCode: wt.teamCode,
    name: wt.name,
    specialty: wt.specialty,
    maxDailyHours: wt.maxDailyHours,
    maxSimultaneousFronts: wt.maxSimultaneousFronts,
    workers: wt.workers.map((w) => ({
      roleName: w.roleName,
      headcount: w.headcount,
      dailyRate: w.dailyRate,
      socialChargesPct: w.socialChargesPct,
      maxDailyOutput: w.maxDailyOutput,
    })),
  }));

  const allocations: LobFloorAllocationItem[] = eap.lobFloorAllocations.map(
    (a) => ({
      floorId: a.floorId,
      floorName: a.floorName,
      floorOrder: a.floorOrder,
      dateIso: a.dateIso,
      teamCode: a.teamCode,
      packageNumber: a.packageNumber,
      isOvertime: a.isOvertime,
    })
  );

  const holidaySet = new Set(
    eap.city.holidays.map((h) => h.date.toISOString().slice(0, 10))
  );

  return buildEapScheduleReportPayload({
    meta: {
      projectId: eap.projectId,
      projectName: eap.project.name,
      clientName: eap.project.client.name,
      cityLabel: `${eap.city.name}/${eap.city.state}`,
      title: eap.title,
      builtAreaM2: eap.builtAreaM2,
      status: eap.status,
      revision: eap.currentRevision,
      bdiPercent: eap.bdiPercent,
      constructionStandardLabel:
        CONSTRUCTION_STANDARD_LABELS[
          (eap.constructionStandard as ConstructionStandard) || "MEDIO_PADRAO"
        ] || "Médio Padrão",
      concreteMethodLabel:
        CONCRETE_METHOD_LABELS[(eap.concreteMethod as ConcreteMethod) || "USINADO"] ||
        "Concreto Usinado",
    },
    allocations,
    floors,
    servicePackages,
    workTeams,
    holidaySet,
    plannedStartDate: eap.plannedStartDate
      ? eap.plannedStartDate.toISOString().slice(0, 10)
      : null,
  });
}

export function renderEapScheduleReportPdf(
  payload: EapScheduleReportPayload
): Uint8Array {
  const pdf = new PdfWriter(
    {
      title: `Relatorio de Planejamento e Cronograma - ${payload.meta.projectName}`,
      author: "ArqVertice OS",
      subject: `Planejamento LOB e Cronograma Executivo (${payload.meta.cityLabel})`,
    },
    { margin: 28 }
  );

  drawPdfBrandedHeader(pdf, {
    eyebrow: "ArqVertice OS · Planejamento & Linha de Balanco",
    title: "Planejamento",
    subtitle: `${payload.meta.projectName} · Cliente: ${payload.meta.clientName} · ${payload.meta.cityLabel}`,
    metaLine: `Area Construida: ${payload.meta.builtAreaM2} m2 · ${payload.meta.revision ? `Revisao: R${String(payload.meta.revision).padStart(2, "0")} · ` : ""}Periodo: ${formatDateBR(payload.kpis.startDate)} a ${formatDateBR(payload.kpis.endDate)}`,
    accentHex: "#059669",
  });

  drawPdfKpiCardsRow(pdf, [
    {
      label: "Inicio e Termino",
      value: `${formatDateBR(payload.kpis.startDate)}`,
      sub: `Termino: ${formatDateBR(payload.kpis.endDate)}`,
      accentHex: "#059669",
      bgHex: "#ECFDF5",
    },
    {
      label: "Prazo Total",
      value: `${payload.kpis.workingDaysTotal} Dias Uteis`,
      sub: `${payload.kpis.calendarDaysTotal} Dias Corridos (~${payload.kpis.monthsEstimated} meses)`,
      accentHex: "#2563EB",
      bgHex: "#EFF6FF",
    },
    {
      label: "Pacotes e Celulas",
      value: `${payload.kpis.activePackagesCount} Pacotes`,
      sub: `${payload.kpis.totalAllocatedCells} celulas alocadas`,
      accentHex: "#7C3AED",
      bgHex: "#F5F3FF",
    },
    {
      label: "Saude e Equipes",
      value: `${payload.kpis.teamsCount} equipes`,
      sub: payload.kpis.healthLabel,
      accentHex:
        payload.kpis.teamOverloads + payload.kpis.precedenceViolations === 0
          ? "#059669"
          : "#DC2626",
      bgHex:
        payload.kpis.teamOverloads + payload.kpis.precedenceViolations === 0
          ? "#ECFDF5"
          : "#FEF2F2",
    },
  ]);

  // 1. Cronograma
  pdf.ensure(110);
  pdf.heading("1. Cronograma");
  const totalMonths = payload.monthlyHistogram.length || 1;
  const monthMarkers = payload.monthlyHistogram
    .filter((_, idx) => totalMonths <= 14 || idx % 2 === 0)
    .map((m, idx, arr) => ({
      label: m.monthLabel,
      offsetRatio: arr.length <= 1 ? 0 : idx / arr.length,
    }));

  drawPdfGanttTimeline(pdf, {
    title: "Sequenciamento Fisico dos Pacotes de Servico (Cura e Paralelismo)",
    totalSpanDays: payload.kpis.calendarDaysTotal,
    monthMarkers,
    bars: payload.packages.map((pkg) => ({
      codeLabel: `Pacote ${String(pkg.packageNumber).padStart(2, "0")} · ${pkg.packageName}`,
      phaseLabel: pkg.phaseName,
      phaseGroupTitle: pkg.phaseGroupTitle,
      phaseGroupColorHex: pkg.phaseGroupColorHex,
      startRatio: pkg.startRatio,
      widthRatio: pkg.widthRatio,
      cureWidthRatio: pkg.cureWidthRatio,
      colorHex: pkg.phaseGroupColorHex,
      durationLabel: `Equipe ${pkg.teamCodes.join(",")} · ${pkg.workingDays} Dias Uteis`,
    })),
  });

  // 2. Histograma de Carga Mensal de Equipes
  pdf.ensure(165);
  pdf.heading("2. Histograma Mensal de Carga das Equipes");
  const teamColors = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626"];
  drawPdfMonthlyHistogram(pdf, {
    title: "Dias-Equipe Trabalhados por Mes (Histograma de Efetivo)",
    teamSeries: payload.teams.map((t, idx) => ({
      teamCode: t.teamCode,
      label: `Equipe ${t.teamCode}`,
      colorHex: teamColors[idx % teamColors.length],
    })),
    months: payload.monthlyHistogram.map((m) => ({
      monthLabel: m.monthLabel,
      teamDays: m.teamDays,
      totalDays: m.totalDays,
    })),
  });

  // 3. Distribuição por Pavimento
  pdf.ensure(125);
  pdf.heading("3. Distribuicao de Dias Uteis por Pavimento");
  drawPdfHorizontalBarChart(pdf, {
    title: "Alocacao de Frentes por Pavimento e Setor",
    items: payload.byFloor.map((f, idx) => ({
      label: f.floorName,
      value: f.workingDays,
      formattedValue: `${f.workingDays} Dias Uteis`,
      colorHex: PDF_PALETTE[idx % PDF_PALETTE.length],
      percent: f.sharePercent,
    })),
  });

  // 4. Tabela Executiva do Cronograma
  pdf.ensure(100);
  pdf.heading("4. Tabela Executiva do Cronograma por Pacote");
  pdf.table({
    columns: [
      { title: "Fase", weight: 1.4 },
      { title: "Pacote", weight: 2.2 },
      { title: "Pavimentos", weight: 1.6 },
      { title: "Equipe", weight: 0.7 },
      { title: "Inicio", weight: 1.0 },
      { title: "Termino", weight: 1.0 },
      { title: "Dias Uteis", weight: 0.8 },
      { title: "Status", weight: 1.0 },
    ],
    rows: payload.packages.map((p) => [
      p.phaseName.replace(/\s*—\s*.*$/, ""),
      `Pacote ${String(p.packageNumber).padStart(2, "0")} - ${p.packageName}`,
      p.floorsLabel,
      p.teamCodes.join(", "),
      formatDateBR(p.startDate),
      formatDateBR(p.endDate),
      String(p.workingDays),
      p.status,
    ]),
    size: 7,
  });

  pdf.stampFooters(`ArqVertice OS · Planejamento LOB · ${payload.meta.projectName}`);
  return pdf.build();
}
