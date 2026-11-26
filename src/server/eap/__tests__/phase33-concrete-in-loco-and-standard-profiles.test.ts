import { describe, expect, it } from "vitest";
import {
  CONCRETE_METHOD_RATES,
  convertConcreteItemByMethod,
  isStructuralConcreteItem,
} from "@/server/eap/regional-standards-catalog";
import {
  computeWorkerHourlyRate,
  getStandardWorkTeamsForProfile,
} from "@/server/eap/teams-and-packages";

describe("Phase 33 — Concretagem In Loco (Betoneira) & Perfis Padrão Fortaleza/CE", () => {
  it("alterna corretamente entre USINADO e IN_LOCO_BETONEIRA com economia líquida coerente", () => {
    expect(isStructuralConcreteItem("04", "Concreto estrutural FCK 30")).toBe(true);
    expect(isStructuralConcreteItem("04", "Aço CA-50 10mm")).toBe(false);

    const usinado = convertConcreteItemByMethod({
      concreteMethod: "USINADO",
      standard: "MEDIO_PADRAO",
    });
    expect(usinado.materialUnitCost).toBe(CONCRETE_METHOD_RATES.USINADO.MEDIO_PADRAO.material);
    expect(usinado.laborUnitCost).toBe(CONCRETE_METHOD_RATES.USINADO.MEDIO_PADRAO.labor);
    expect(usinado.description).toContain("usinado");

    const inLoco = convertConcreteItemByMethod({
      concreteMethod: "IN_LOCO_BETONEIRA",
      standard: "MEDIO_PADRAO",
    });
    expect(inLoco.materialUnitCost).toBe(435);
    expect(inLoco.laborUnitCost).toBe(155);
    expect(inLoco.description).toContain("betoneira 400 L");

    const totalUsinado = usinado.materialUnitCost + usinado.laborUnitCost;
    const totalInLoco = inLoco.materialUnitCost + inLoco.laborUnitCost;
    expect(totalUsinado - totalInLoco).toBeGreaterThanOrEqual(80);
  });

  it("gera perfis padronizados de Mão de Obra (Baixo, Médio e Alto Padrão) com HORA = DIÁRIA / 8", () => {
    const baixo = getStandardWorkTeamsForProfile("BAIXO_PADRAO");
    expect(baixo).toHaveLength(3);
    const baixoTotalDiario = baixo
      .flatMap((t) => t.workers)
      .reduce((acc, w) => acc + w.dailyRate, 0);
    expect(baixoTotalDiario).toBe(1175);

    const medio = getStandardWorkTeamsForProfile("MEDIO_PADRAO");
    expect(medio).toHaveLength(3);

    const alto = getStandardWorkTeamsForProfile("ALTO_PADRAO");
    expect(alto).toHaveLength(3);

    for (const profile of [baixo, medio, alto]) {
      for (const team of profile) {
        for (const w of team.workers) {
          expect(w.hourlyRate).toBe(computeWorkerHourlyRate(w.dailyRate, 8));
        }
      }
    }
  });
});
