import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOB_FLOORS,
  analyzeFloorMatrixConflicts,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
} from "@/lib/eap-lob-grid";
import { generatePreliminary13MonthLobMatrix } from "@/lib/eap-preliminary-13m";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";
import {
  buildEapScheduleReportPayload,
  renderEapScheduleReportPdf,
} from "@/server/eap/eap-schedule-report";

describe("Fase 27 — Auditoria LOB (< 13 meses com Cura & Paralelismo) e Gantt Editorial", () => {
  const packages38: FloorMatrixServicePackage[] = MASTER_LOB_PACKAGES.map((p) => ({
    packageNumber: p.packageNumber,
    name: p.name,
    discipline: p.waveName.replace(/\bOnda\b/gi, "Fase"),
    corHex: "#1D4ED8",
    textHex: "#FFFFFF",
    predecessorNumbers: p.predecessorNumbers,
    productivityPerDay: 25,
    productivityUnit: "m²",
    linkedEapStageCodes: p.linkedStageCodes,
    isActive: true,
  }));

  const teamsABC: FloorMatrixWorkTeam[] = [
    {
      teamCode: "A",
      name: "Equipe A — Estrutura & Obra Bruta",
      specialty: "Estrutura",
      maxDailyHours: 8,
      maxSimultaneousFronts: 2,
      workers: [{ roleName: "Pedreiro", headcount: 3, dailyRate: 180, socialChargesPct: 40 }],
    },
    {
      teamCode: "B",
      name: "Equipe B — Alvenaria & Revestimentos",
      specialty: "Alvenaria/Acabamento",
      maxDailyHours: 8,
      maxSimultaneousFronts: 2,
      workers: [{ roleName: "Pedreiro", headcount: 3, dailyRate: 180, socialChargesPct: 40 }],
    },
    {
      teamCode: "C",
      name: "Equipe C — Instalações MEP",
      specialty: "Elétrica/Hidro",
      maxDailyHours: 8,
      maxSimultaneousFronts: 2,
      workers: [{ roleName: "Eletricista/Encanador", headcount: 2, dailyRate: 210, socialChargesPct: 40 }],
    },
  ];

  it("fecha obra de 250 m² (38 pacotes) estritamente abaixo de 13 meses (< 252 d.u.) com paralelismo real e 0 conflitos", () => {
    const result = generatePreliminary13MonthLobMatrix({
      startDate: "2027-02-01",
      builtAreaM2: 250,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages38,
      workTeams: teamsABC,
      holidaySet: new Set(),
    });

    expect(result.scheduledPackagesCount).toBe(38);
    expect(result.workingDaysSpan).toBeLessThan(252);
    expect(result.workingDaysSpan).toBeGreaterThanOrEqual(190);

    const startMs = Date.parse("2027-02-01T00:00:00Z");
    const endMs = Date.parse(`${result.endDate}T00:00:00Z`);
    const calendarDays = Math.round((endMs - startMs) / 86_400_000) + 1;
    expect(calendarDays).toBeLessThan(390);

    const analysis = analyzeFloorMatrixConflicts({
      allocations: result.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages38,
      workTeams: teamsABC,
      stageLoads: [],
      holidaySet: new Set(),
    });

    const teamOverloads = analysis.conflicts.filter((c) => c.type === "TEAM_OVERLOAD").length;
    const precedenceViolations = analysis.conflicts.filter(
      (c) => c.type === "PRECEDENCE_VIOLATION"
    ).length;

    expect(teamOverloads).toBe(0);
    expect(precedenceViolations).toBe(0);

    // Verifica paralelismo real (dias com mais de 1 frente/equipe trabalhando simultaneamente)
    const teamsPerDay = new Map<string, Set<string>>();
    for (const a of result.allocations) {
      const s = teamsPerDay.get(a.dateIso) ?? new Set<string>();
      s.add(a.teamCode);
      teamsPerDay.set(a.dateIso, s);
    }
    const parallelDays = Array.from(teamsPerDay.values()).filter((s) => s.size >= 2).length;
    expect(parallelDays).toBeGreaterThan(20);

    // Verifica janelas de cura: Fundação (4/5) -> Supraestrutura (7), Térreo (7) -> Superior (8), Reboco (19) -> Pintura (30)
    const maxDateOf = (pkgNum: number, floorId?: string) =>
      result.allocations
        .filter((a) => a.packageNumber === pkgNum && (!floorId || a.floorId === floorId))
        .map((a) => a.dateIso)
        .sort()
        .pop();
    const minDateOf = (pkgNum: number, floorId?: string) =>
      result.allocations
        .filter((a) => a.packageNumber === pkgNum && (!floorId || a.floorId === floorId))
        .map((a) => a.dateIso)
        .sort()[0];

    expect(minDateOf(7, "TERREO")! > maxDateOf(5)!).toBe(true);
    expect(minDateOf(8, "PAV_SUPERIOR")! > maxDateOf(7, "TERREO")!).toBe(true);
    expect(minDateOf(30, "TERREO")! > maxDateOf(19, "TERREO")!).toBe(true);
  });

  it("gera PDF editorial de Planejamento com agrupamento por fases e sem 'Onda'", () => {
    const result = generatePreliminary13MonthLobMatrix({
      startDate: "2027-02-01",
      builtAreaM2: 250,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages38,
      workTeams: teamsABC,
      holidaySet: new Set(),
    });

    const payload = buildEapScheduleReportPayload({
      meta: {
        projectId: "proj-pedro",
        projectName: "Residência de Praia",
        clientName: "Pedro",
        cityLabel: "Fortaleza/CE",
        title: "Planejamento LOB",
        builtAreaM2: 250,
        status: "EM_EXECUCAO",
      },
      allocations: result.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages38,
      workTeams: teamsABC,
      holidaySet: new Set(),
    });

    expect(payload.kpis.daysSavedByParallelism).toBeGreaterThan(50);
    expect(payload.packages.every((p) => p.phaseGroupTitle.startsWith("FASE "))).toBe(true);

    const pdfBytes = renderEapScheduleReportPdf(payload);
    const pdfStr = Buffer.from(pdfBytes).toString("latin1");
    expect(pdfStr.startsWith("%PDF-")).toBe(true);
    expect(pdfStr).not.toMatch(/\bOnda\b/i);
  });
});
