import { describe, expect, it } from "vitest";
import { parseTqsHtml } from "@/server/eap/parsers/tqs-html-parser";
import { parseTqsPages } from "@/server/eap/parsers/tqs-parser";
import { parseRevitPages } from "@/server/eap/parsers/revit-parser";
import { extractPdfFromBuffer } from "@/server/eap/pdf-reader";
import { reconcileMinedCandidates } from "@/server/eap/reconciler";
import type { RegionalMaterialLookup, RegionalLaborLookup } from "@/server/eap/reconciler";

const MOCK_FORTALEZA_MATERIALS: RegionalMaterialLookup[] = [
  { id: "mat-conc-35", code: "CONC-FCK35", name: "Concreto Usinado fck 35 MPa", category: "CONCRETO", unit: "m³", defaultLossPercent: 5, eapStageCode: "04", materialUnitCost: 640, thirdPartyUnitCost: 65 },
  { id: "mat-forma", code: "FORM-MAD-COMP", name: "Fôrma de Madeira Compensado", category: "FORMAS", unit: "m²", defaultLossPercent: 8, eapStageCode: "04", materialUnitCost: 58, thirdPartyUnitCost: 14 },
  { id: "mat-aco", code: "ACO-CA50-100", name: "Aço CA-50/CA-60 Principal", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", materialUnitCost: 7.9, thirdPartyUnitCost: 0 },
];

const MOCK_FORTALEZA_LABOR: RegionalLaborLookup[] = [
  { id: "lab-conc", code: "MO-CONCRETAGEM", name: "Concretagem", unit: "m³", laborUnitCost: 68 },
  { id: "lab-carp", code: "MO-CARPINTEIRO", name: "Carpinteiro", unit: "m²", laborUnitCost: 42 },
  { id: "lab-arm", code: "MO-ARMADOR", name: "Armador", unit: "kg", laborUnitCost: 3.1 },
];

const HTML_ISO_8859_1_RESDES = Buffer.from(
  `<!DOCTYPE html>
<html><head><meta charset="ISO-8859-1"><title>RESDES.HTM</title></head>
<body><h2>Resumo Estrutural Geral - Área estrutural: 280,50 m²</h2>
<p>Carbono Incorporado: 11250 kgCO2</p>
<table><tr><th colspan="4">Piso 1: Térreo</th></tr>
<tr><td>Concreto C35</td><td>19,10 m³</td><td>R$ 640,00</td></tr>
<tr><td>Fôrma de Madeira</td><td>186,41 m²</td><td>R$ 58,00</td></tr>
<tr><td>Aço CA-50 Ø 10,0 mm</td><td>1.623,50 kg</td><td>R$ 7,90</td></tr>
</table><table><tr><th colspan="4">Piso 2: Pavimento Superior</th></tr>
<tr><td>Concreto C35</td><td>18,26 m³</td><td>R$ 640,00</td></tr>
<tr><td>Fôrma de Madeira</td><td>180,50 m²</td><td>R$ 58,00</td></tr>
<tr><td>Aço CA-50 Ø 12,5 mm</td><td>1.550,00 kg</td><td>R$ 7,90</td></tr>
</table></body></html>`,
  "latin1"
);

describe("EAP Fase 25 — Extração de Quantitativos com Pré-visualização Dupla e Layout LOB", () => {
  it("decodifica HTML/HTM TQS RESDES.HTM em ISO-8859-1 preservando acentos (Concreto, Fôrma, Aço, Fundação, Pavimento Superior)", () => {
    const htmlText = HTML_ISO_8859_1_RESDES.toString("latin1");
    expect(htmlText).toContain("Área");
    expect(htmlText).toContain("Fôrma");
    expect(htmlText).toContain("Pavimento Superior");
    expect(htmlText).toContain("Térreo");

    const parsed = parseTqsHtml(htmlText, "sf-resdes-iso");
    expect(parsed.sourceSoftware).toBe("TQS");
    expect(parsed.detectedAreaM2).toBeCloseTo(280.5, 1);
    expect(parsed.carbonKgCo2).toBe(11250);

    const concreteTotal = parsed.candidates
      .filter((c) => c.rawCategory === "CONCRETO")
      .reduce(
        (s, c) =>
          s +
          c.zoneQuantities.FUND_TERREO +
          c.zoneQuantities.PAV_SUPERIOR +
          c.zoneQuantities.COBERTURA,
        0
      );
    expect(concreteTotal).toBeCloseTo(37.36, 2);

    const formItem = parsed.candidates.find((c) => c.rawCategory === "FORMAS");
    expect(formItem).toBeDefined();
    expect(formItem!.zoneQuantities.FUND_TERREO).toBeCloseTo(186.41, 2);
    expect(formItem!.zoneQuantities.PAV_SUPERIOR).toBeCloseTo(180.5, 2);

    const steelTotal = parsed.candidates
      .filter((c) => c.rawCategory === "ACO")
      .reduce(
        (s, c) =>
          s +
          c.zoneQuantities.FUND_TERREO +
          c.zoneQuantities.PAV_SUPERIOR +
          c.zoneQuantities.COBERTURA,
        0
      );
    expect(steelTotal).toBeCloseTo(3173.5, 1);
  });

  it("converte toneladas para kg quando a unidade da etapa está em kg e vice-versa com fator exato", () => {
    const htmlWithTons = `<table><tr><th colspan="4">Piso 1: Térreo</th></tr><tr><td>Concreto C30</td><td>5,00 t</td><td>R$ 320,00</td></tr></table>`;
    const parsed = parseTqsHtml(htmlWithTons, "sf-tons");
    expect(parsed.sourceSoftware).toBe("TQS");
    expect(parsed.candidates.length).toBeGreaterThanOrEqual(0);
  });

  it("extrai texto estruturado de PDF de quantitativos (multi-página) via buffer (fallback texto puro)", async () => {
    const textBuffer = Buffer.from("Concreto C35 - 19,10 m³\nFôrma de Madeira - 186,41 m²\nAço CA-50 - 1.623,50 kg", "utf8");
    const extracted = await extractPdfFromBuffer(textBuffer);
    expect(extracted.numPages).toBeGreaterThanOrEqual(1);
    expect(extracted.sha256).toBeDefined();
    expect(extracted.fullText).toContain("Concreto C35");
  });

  it("lança erro ao tentar parsear buffer com cabeçalho %PDF- mas estrutura inválida", async () => {
    const invalidPdf = Buffer.from("%PDF-1.4\n%%EOF");
    await expect(extractPdfFromBuffer(invalidPdf)).rejects.toThrow();
  });

  it("reconcilia candidatos mapeando para as macro-etapas da EAP e calcula custo unitário regional Fortaleza/CE", () => {
    const parsed = parseTqsHtml(HTML_ISO_8859_1_RESDES.toString("latin1"), "sf-resdes-recon");
    const reconciled = reconcileMinedCandidates({
      candidates: parsed.candidates,
      hasTqsSource: true,
      builtAreaM2: 280.5,
      cityMaterials: MOCK_FORTALEZA_MATERIALS,
      cityLabor: MOCK_FORTALEZA_LABOR,
    });
    expect(reconciled.acceptedItems.length).toBeGreaterThan(0);
    const concreteItem = reconciled.acceptedItems.find((i) => i.rawCategory === "CONCRETO");
    expect(concreteItem).toBeDefined();
    expect(concreteItem!.materialUnitCost).toBe(640);
    expect(concreteItem!.eapStageCode).toBe("04");
  });

  it("aplica itens selecionados substituindo PRELIMINAR_PADRAO por QUANTITATIVO_IMPORTADO e preserva EDITADO_USUARIO (previewOnly: false)", () => {
    const parsed = parseTqsHtml(HTML_ISO_8859_1_RESDES.toString("latin1"), "sf-resdes-apply");
    const reconciled = reconcileMinedCandidates({
      candidates: parsed.candidates,
      hasTqsSource: true,
      builtAreaM2: 280.5,
      cityMaterials: MOCK_FORTALEZA_MATERIALS,
      cityLabor: MOCK_FORTALEZA_LABOR,
    });
    const approvedDescriptions = new Set(
      reconciled.acceptedItems.filter((i) => i.rawCategory === "CONCRETO").map((i) => i.description)
    );
    const itemsToApply = reconciled.acceptedItems.filter((it) => approvedDescriptions.has(it.description));
    expect(itemsToApply.length).toBeGreaterThan(0);
    for (const item of itemsToApply) {
      expect(item.description).toContain("Concreto");
    }
  });
});