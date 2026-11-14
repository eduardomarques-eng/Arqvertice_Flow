import { describe, it, expect } from "vitest";
import { parseAndValidateSheetName, getNextRevisionNumber } from "./naming-engine";

describe("CDE Naming Engine", () => {
  it("valida prancha com nomenclatura no padrão ConstruManager", () => {
    const result = parseAndValidateSheetName("ARQ-FAC-PE-DET-001-R00.dwg");
    expect(result.isValid).toBe(true);
    expect(result.projectCode).toBe("ARQ");
    expect(result.discipline).toBe("FACHADAS");
    expect(result.phase).toBe("PE");
    expect(result.docType).toBe("DET");
    expect(result.sequential).toBe("001");
    expect(result.revisionNumber).toBe("R00");
  });

  it("alerta nome fora da máscara mas preserva revisão flexível", () => {
    const result = parseAndValidateSheetName("Planta_Final_Revisada-R02.pdf");
    expect(result.isValid).toBe(false);
    expect(result.revisionNumber).toBe("R02");
    expect(result.error).toBeDefined();
  });

  it("calcula corretamente a próxima revisão sequencial R00 -> R01 -> R02", () => {
    expect(getNextRevisionNumber("R00")).toBe("R01");
    expect(getNextRevisionNumber("R01")).toBe("R02");
    expect(getNextRevisionNumber("R09")).toBe("R10");
  });
});
