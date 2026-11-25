import { describe, expect, it } from "vitest";
import {
  buildContinuousLobTimeline,
  DEFAULT_LOB_FLOORS,
  fillFloorAllocationsHorizontally,
  getLobPackageMeta,
  parseLobCellInput,
  shiftFloorAllocations,
} from "@/lib/eap-lob-grid";

describe("Fase 9 — Matriz LOB (Pavimentos × Datas + Células A1, B3)", () => {
  it("normaliza códigos combinados (a1 -> A1, A5, B15) e resolve cor/metadados do pacote", () => {
    expect(parseLobCellInput("a1", "B")).toEqual([
      { teamCode: "A", packageNumber: 1, code: "A1" },
    ]);

    expect(parseLobCellInput("A5, b15, a5", "A")).toEqual([
      { teamCode: "A", packageNumber: 5, code: "A5" },
      { teamCode: "B", packageNumber: 15, code: "B15" },
    ]);

    // Apenas número usa a Equipe Ativa
    expect(parseLobCellInput("7", "C")).toEqual([
      { teamCode: "C", packageNumber: 7, code: "C7" },
    ]);

    const pkg1 = getLobPackageMeta(1);
    expect(pkg1.corHex).toMatch(/^#[0-9A-F]{6}$/i);
    expect(["#FFFFFF", "#111827"]).toContain(pkg1.textHex);
  });

  it("gera linha do tempo contínua marcando Sábados, Domingos e feriados como sombreados/não úteis", () => {
    // 2026-04-03 (sexta) a 2026-04-07 (terça), com feriado em 2026-04-06 (segunda)
    const timeline = buildContinuousLobTimeline({
      scale: "DIARIO",
      startDate: "2026-04-03",
      endDate: "2026-04-07",
      holidays: [{ date: "2026-04-06", name: "Feriado Teste" }],
      trailingDays: 0,
    });

    expect(timeline.allCalendarDaysIso).toEqual([
      "2026-04-03", // Sexta (útil)
      "2026-04-04", // Sábado (FDS)
      "2026-04-05", // Domingo (FDS)
      "2026-04-06", // Segunda (Feriado)
      "2026-04-07", // Terça (útil)
    ]);

    expect(timeline.allWorkingDaysIso).toEqual(["2026-04-03", "2026-04-07"]);

    const sat = timeline.columns.find((c) => c.key === "2026-04-04");
    const sun = timeline.columns.find((c) => c.key === "2026-04-05");
    const hol = timeline.columns.find((c) => c.key === "2026-04-06");
    expect(sat?.isWeekend).toBe(true);
    expect(sat?.isNonWorking).toBe(true);
    expect(sun?.isWeekend).toBe(true);
    expect(hol?.isHoliday).toBe(true);
    expect(hol?.holidayName).toBe("Feriado Teste");
  });

  it("preenche horizontalmente e desloca intervalo (+N / -N dias úteis) pulando FDS e feriados", () => {
    const holidaySet = new Set(["2026-04-06"]); // Segunda feriado
    const terreo = DEFAULT_LOB_FLOORS[1];

    // Começa sexta 2026-04-03 e preenche 2 dias úteis -> deve cair em 2026-04-03 e 2026-04-07 (pulando 04, 05 e 06)
    const filled = fillFloorAllocationsHorizontally({
      allocations: [],
      floor: terreo,
      startDateIso: "2026-04-03",
      workingDaysCount: 2,
      tokens: [{ teamCode: "A", packageNumber: 4, code: "A4" }],
      holidaySet,
    });

    expect(filled.map((f) => f.dateIso)).toEqual(["2026-04-03", "2026-04-07"]);

    // Desloca +1 dia útil -> 2026-04-03 vai para 2026-04-07, e 2026-04-07 vai para 2026-04-08
    const shiftedForward = shiftFloorAllocations({
      allocations: filled,
      deltaWorkingDays: 1,
      holidaySet,
    });
    expect(shiftedForward.map((f) => f.dateIso)).toEqual(["2026-04-07", "2026-04-08"]);

    // Desloca -1 dia útil de volta -> retorna para 2026-04-03 e 2026-04-07
    const shiftedBack = shiftFloorAllocations({
      allocations: shiftedForward,
      deltaWorkingDays: -1,
      holidaySet,
    });
    expect(shiftedBack.map((f) => f.dateIso)).toEqual(["2026-04-03", "2026-04-07"]);
  });
});
