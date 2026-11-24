import { describe, expect, it } from "vitest";
import {
  computeScheduleAnalytics,
  evaluateScheduleAudit,
  generateScheduleFromEap,
  subtractCalendarDaysUTC,
} from "@/server/eap/scheduler";
import { toIsoDateKeyUTC } from "@/server/eap/calculator";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";

describe("EAP Fase 4 — Motor LOB, Curva S, Desembolso Mensal e Auditoria", () => {
  it("gera segmentos LOB por zona a partir de quantitativos/produtividade pulando feriados do Ceará e cria ProcurementGates", () => {
    const cearaHolidays = ["2026-03-19", "2026-03-25"];
    const packages = MASTER_LOB_PACKAGES.slice(0, 12).map((p, idx) => ({
      id: `pkg-${p.packageNumber}`,
      packageNumber: p.packageNumber,
      name: p.name,
      waveName: p.waveName,
      linkedStageCodes: p.linkedStageCodes,
      predecessorNumbers: p.predecessorNumbers,
      durationWorkingDays: p.defaultDurationWorkingDays,
      teamsCount: p.defaultTeamsCount,
      orderIndex: idx + 1,
    }));

    const items = [
      {
        stageCode: "05",
        zoneQuantities: { FUND_TERREO: 160, PAV_SUPERIOR: 160, COBERTURA: 0, EXTERNO: 0 },
        lossPercent: 0,
        dailyProductivityPerTeam: 16, // 160 / (16 * 2 equipes) = 5 dias úteis por zona
        teamsCount: 2,
        totalMaterial: 17920,
        totalLabor: 10880,
        totalThirdParty: 0,
        totalDirectCost: 28800,
        totalCommercialPrice: 35136,
      },
    ];

    const result = generateScheduleFromEap({
      packages,
      items,
      plannedStartDate: "2026-03-18",
      holidays: cearaHolidays,
    });

    // PCT 10 (Alvenaria Térreo, etapa 05) gera 2 trechos (FUND_TERREO e PAV_SUPERIOR) com 5 d.u. cada
    const pct10Segs = result.segments.filter((s) => s.packageNumber === 10);
    expect(pct10Segs).toHaveLength(2);
    expect(pct10Segs[0].workingDays).toBe(5);
    expect(pct10Segs[1].workingDays).toBe(5);
    expect(pct10Segs[1].startDate.getTime()).toBeGreaterThan(pct10Segs[0].endDate.getTime());

    // ProcurementGate do PCT 10 tem leadTimeDays = 12 dias antes do início
    const pct10Gate = result.procurementGates.find((g) => g.packageNumber === 10);
    expect(pct10Gate).toBeDefined();
    expect(toIsoDateKeyUTC(pct10Gate!.triggerDate)).toBe(
      toIsoDateKeyUTC(subtractCalendarDaysUTC(pct10Segs[0].startDate, 12))
    );
  });

  it("calcula Curva S e Fluxo de Desembolso Mensal batendo 100% com o valor comercial total da EAP", () => {
    const packages = [
      {
        packageNumber: 7,
        linkedStageCodes: ["04"],
        teamsCount: 2,
        segments: [
          { startDate: "2026-04-01", endDate: "2026-05-15", workingDays: 32 },
        ],
      },
      {
        packageNumber: 10,
        linkedStageCodes: ["05"],
        teamsCount: 2,
        segments: [
          { startDate: "2026-05-01", endDate: "2026-06-15", workingDays: 31 },
        ],
      },
    ];

    const stageBudgets = [
      {
        stageCode: "04",
        totalMaterial: 120000.33,
        totalLabor: 45000.17,
        totalThirdParty: 15000.5,
        totalDirectCost: 180001.0,
        totalCommercialPrice: 219601.22,
      },
      {
        stageCode: "05",
        totalMaterial: 40000.0,
        totalLabor: 25000.0,
        totalThirdParty: 0,
        totalDirectCost: 65000.0,
        totalCommercialPrice: 79300.0,
      },
    ];

    const expectedTotal = 298901.22;
    const analytics = computeScheduleAnalytics({
      packages,
      stageBudgets,
      holidays: ["2026-04-21", "2026-05-01"],
    });

    const sumMonthlyCommercial =
      Math.round(
        analytics.monthlySeries.reduce((acc, m) => acc + m.commercialCost, 0) * 100
      ) / 100;

    expect(sumMonthlyCommercial).toBe(expectedTotal);
    expect(analytics.monthlySeries[analytics.monthlySeries.length - 1].cumulativePhysicalPercent).toBe(100);
    expect(analytics.holidaysAppliedCount).toBe(2);
    expect(analytics.peakFronts).toBe(2);
    expect(analytics.peakTeams).toBe(4);
  });

  it("auditoria lógica detecta inversão Guarda-Corpos após Limpeza Final e bloqueia Baseline", () => {
    const audit = evaluateScheduleAudit({
      packages: [
        {
          packageNumber: 37,
          name: "Esquadria de Alumínio — Guarda-Corpos e Corrimãos",
          linkedStageCodes: ["16"],
          segments: [{ startDate: "2026-10-10", endDate: "2026-10-20" }],
          procurementGates: [],
        },
        {
          packageNumber: 38,
          name: "Limpeza Final Pós-Obra, Comissionamento e Entrega",
          linkedStageCodes: ["26"],
          segments: [{ startDate: "2026-10-05", endDate: "2026-10-09" }],
          procurementGates: [],
        },
      ],
      activeStageCodesWithQty: ["16", "26"],
      plannedStartDate: "2026-04-01",
      weeklyHistogram: [{ weekKey: "S01", weekStart: "2026-04-06", activeFronts: 7, activeTeams: 10 }],
    });

    expect(audit.approved).toBe(false);
    expect(audit.criticalBlockers.some((b) => b.includes("Inversão lógica"))).toBe(true);
    expect(audit.warnings.some((w) => w.includes("Sobrecarga"))).toBe(true);
  });
});
