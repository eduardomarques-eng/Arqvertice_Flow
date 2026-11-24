import { describe, expect, it } from "vitest";
import {
  analyzeLobConflicts,
  autoLevelConflictingPackages,
  buildLobTimeline,
  getLobPackageMeta,
  LOB_PACKAGE_COLOR_MAP,
  scaleUnitsToWorkingDays,
  shiftSchedulePackages,
  workingDaySetToSegments,
  type LobPackageLike,
} from "@/lib/eap-lob-grid";

describe("EAP Fase 3 — Planilha Interativa LOB, Multi-Escala, Deslocar Intervalo & Nivelamento", () => {
  it("gera linha do tempo em 4 escalas (Diário, Semanal, Mensal, Anual) sinalizando feriados em cinza", () => {
    const holidays = [{ date: "2026-04-21", name: "Tiradentes" }];

    const daily = buildLobTimeline({
      scale: "DIARIO",
      startDate: "2026-04-20",
      endDate: "2026-04-24",
      holidays,
      trailingWorkingDays: 0,
    });
    expect(daily.columns.some((c) => c.key === "2026-04-21" && c.isHoliday && !c.editable)).toBe(true);
    expect(daily.allWorkingDaysIso).not.toContain("2026-04-21");

    const weekly = buildLobTimeline({
      scale: "SEMANAL",
      startDate: "2026-04-01",
      endDate: "2026-05-15",
      holidays,
      trailingWorkingDays: 0,
    });
    expect(weekly.columns.length).toBeGreaterThanOrEqual(6);

    const monthly = buildLobTimeline({
      scale: "MENSAL",
      startDate: "2026-04-01",
      endDate: "2026-08-31",
      holidays,
      trailingWorkingDays: 0,
    });
    expect(monthly.columns.length).toBeGreaterThanOrEqual(5);

    const annual = buildLobTimeline({
      scale: "ANUAL",
      startDate: "2026-04-01",
      endDate: "2027-06-30",
      holidays,
      trailingWorkingDays: 0,
    });
    expect(annual.columns.map((c) => c.label)).toEqual(["2026", "2027"]);
  });

  it("fornece mapa central de cores de pacotes e agrupa dias úteis em segmentos contínuos pulando feriados", () => {
    expect(Object.keys(LOB_PACKAGE_COLOR_MAP).length).toBe(38);
    const meta1 = getLobPackageMeta(1);
    const meta4 = getLobPackageMeta(4);
    expect(meta1.corHex).not.toBe(meta4.corHex);

    // 20/04 (seg) + 22/04 (qua), com 21/04 sendo feriado -> 1 único segmento contínuo de 2 d.u.
    const holidaySet = new Set(["2026-04-21"]);
    const segs = workingDaySetToSegments({
      zoneCode: "FUND_TERREO",
      activeIsoSet: new Set(["2026-04-20", "2026-04-22", "2026-04-24"]),
      holidaySet,
    });

    expect(segs).toHaveLength(2);
    expect(segs[0].startDate).toBe("2026-04-20");
    expect(segs[0].endDate).toBe("2026-04-22");
    expect(segs[0].workingDays).toBe(2);
    expect(segs[1].startDate).toBe("2026-04-24");
    expect(segs[1].workingDays).toBe(1);
  });

  it("desloca intervalo pulando fins de semana e feriados, preservando duração e cascateando sucessores", () => {
    const holidaySet = new Set(["2026-04-21"]);
    const packages: LobPackageLike[] = [
      {
        id: "p1",
        packageNumber: 1,
        name: "Canteiro",
        waveName: "Onda 1",
        linkedStageCodes: ["01"],
        predecessorNumbers: [],
        durationWorkingDays: 2,
        teamsCount: 2,
        segments: [
          {
            zoneCode: "FUND_TERREO",
            segmentOrder: 1,
            startDate: "2026-04-17", // sex
            endDate: "2026-04-20", // seg (2 d.u.)
            workingDays: 2,
            parallelLane: 1,
          },
        ],
      },
      {
        id: "p2",
        packageNumber: 2,
        name: "Locação",
        waveName: "Onda 1",
        linkedStageCodes: ["01"],
        predecessorNumbers: [1],
        durationWorkingDays: 2,
        teamsCount: 2,
        segments: [
          {
            zoneCode: "FUND_TERREO",
            segmentOrder: 1,
            startDate: "2026-04-22", // qua (pula 21/04)
            endDate: "2026-04-23",
            workingDays: 2,
            parallelLane: 1,
          },
        ],
      },
    ];

    // Desloca PCT 01 em +1 dia útil: 17->20, 20->22 (pulando 18,19 e feriado 21)
    const { packages: shifted, movedPackageNumbers } = shiftSchedulePackages({
      packages,
      targetPackageNumbers: [1],
      deltaWorkingDays: scaleUnitsToWorkingDays("DIARIO", 1),
      holidaySet,
      cascadeDependents: true,
    });

    expect(movedPackageNumbers).toEqual([1, 2]);
    const p1 = shifted.find((p) => p.packageNumber === 1)!;
    const p2 = shifted.find((p) => p.packageNumber === 2)!;
    expect(p1.segments[0].startDate).toBe("2026-04-20");
    expect(p1.segments[0].endDate).toBe("2026-04-22");
    expect(p1.segments[0].workingDays).toBe(2);
    // Sucessor PCT 02 também avançou em cascata e inicia após 22/04
    expect(p2.segments[0].startDate).toBe("2026-04-23");
    expect(p2.segments[0].endDate).toBe("2026-04-24");
  });

  it("detecta excesso de equipe e quebra de precedência e nivela automaticamente para janelas livres", () => {
    const holidaySet = new Set<string>();
    const packages: LobPackageLike[] = [
      {
        id: "p1",
        packageNumber: 1,
        name: "Fundação",
        waveName: "Onda 1",
        linkedStageCodes: ["03"],
        predecessorNumbers: [],
        durationWorkingDays: 3,
        teamsCount: 4,
        segments: [
          {
            zoneCode: "FUND_TERREO",
            segmentOrder: 1,
            startDate: "2026-04-06",
            endDate: "2026-04-08",
            workingDays: 3,
            parallelLane: 1,
          },
        ],
      },
      {
        id: "p2",
        packageNumber: 2,
        name: "Baldrame",
        waveName: "Onda 1",
        linkedStageCodes: ["03"],
        predecessorNumbers: [1],
        durationWorkingDays: 2,
        teamsCount: 4,
        segments: [
          {
            zoneCode: "FUND_TERREO",
            segmentOrder: 1,
            // Inicia no dia 07/04 -> viola precedência de p1 (08/04) E soma 8 equipes (> limite 5)
            startDate: "2026-04-07",
            endDate: "2026-04-08",
            workingDays: 2,
            parallelLane: 2,
          },
        ],
      },
    ];

    const initialAnalysis = analyzeLobConflicts({
      packages,
      holidaySet,
      maxTeamsLimit: 5,
    });
    expect(initialAnalysis.overloadedDays.length).toBeGreaterThan(0);
    expect(initialAnalysis.precedenceViolations).toHaveLength(1);

    const { packages: leveled, leveledPackageNumbers } = autoLevelConflictingPackages({
      packages,
      holidaySet,
      maxTeamsLimit: 5,
    });
    expect(leveledPackageNumbers).toContain(2);

    const afterAnalysis = analyzeLobConflicts({
      packages: leveled,
      holidaySet,
      maxTeamsLimit: 5,
    });
    expect(afterAnalysis.overloadedDays).toHaveLength(0);
    expect(afterAnalysis.precedenceViolations).toHaveLength(0);
  });
});
