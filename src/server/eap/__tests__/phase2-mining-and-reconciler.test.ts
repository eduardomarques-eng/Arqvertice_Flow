import { describe, expect, it } from "vitest";
import { parseTqsPages } from "@/server/eap/parsers/tqs-parser";
import { parseRevitPages } from "@/server/eap/parsers/revit-parser";
import {
  detectOutdatedAcervoSources,
  reconcileMinedCandidates,
  type RegionalLaborLookup,
  type RegionalMaterialLookup,
} from "@/server/eap/reconciler";

const MOCK_FORTALEZA_MATERIALS: RegionalMaterialLookup[] = [
  {
    id: "mat-aco-10",
    code: "ACO-CA50-100",
    name: "Aço CA-50 Ø 10,0 mm",
    category: "ACO",
    unit: "kg",
    defaultLossPercent: 10,
    eapStageCode: "04",
    materialUnitCost: 7.8,
    thirdPartyUnitCost: 0,
  },
  {
    id: "mat-conc-30",
    code: "CONC-FCK30",
    name: "Concreto Usinado fck 30 MPa",
    category: "CONCRETO",
    unit: "m³",
    defaultLossPercent: 5,
    eapStageCode: "04",
    materialUnitCost: 595,
    thirdPartyUnitCost: 65,
  },
  {
    id: "mat-conc-25",
    code: "CONC-FCK25",
    name: "Concreto Usinado fck 25 MPa",
    category: "CONCRETO",
    unit: "m³",
    defaultLossPercent: 5,
    eapStageCode: "04",
    materialUnitCost: 560,
    thirdPartyUnitCost: 65,
  },
  {
    id: "mat-forma",
    code: "FORM-MAD-COMP",
    name: "Fôrma de Madeira Compensado",
    category: "FORMAS",
    unit: "m²",
    defaultLossPercent: 8,
    eapStageCode: "04",
    materialUnitCost: 58,
    thirdPartyUnitCost: 14,
  },
  {
    id: "mat-tjc14",
    code: "ALV-TJC14",
    name: "Bloco Cerâmico Vedação 14cm (TJC14)",
    category: "ALVENARIA",
    unit: "m²",
    defaultLossPercent: 8,
    eapStageCode: "05",
    materialUnitCost: 56,
    thirdPartyUnitCost: 0,
  },
  {
    id: "mat-porta",
    code: "ESQ-PORTA-MAD",
    name: "Kit Porta Pronta de Madeira",
    category: "ESQUADRIAS",
    unit: "unid",
    defaultLossPercent: 0,
    eapStageCode: "17",
    materialUnitCost: 1350,
    thirdPartyUnitCost: 180,
  },
  {
    id: "mat-porc",
    code: "REV-PORC-90",
    name: "Porcelanato Retificado 90x90",
    category: "REVESTIMENTOS",
    unit: "m²",
    defaultLossPercent: 12,
    eapStageCode: "14",
    materialUnitCost: 148,
    thirdPartyUnitCost: 0,
  },
];

const MOCK_FORTALEZA_LABOR: RegionalLaborLookup[] = [
  { id: "lab-arm", code: "MO-ARMADOR", name: "Armador", unit: "kg", laborUnitCost: 3.1 },
  { id: "lab-conc", code: "MO-CONCRETAGEM", name: "Concretagem", unit: "m³", laborUnitCost: 68 },
  { id: "lab-carp", code: "MO-CARPINTEIRO", name: "Carpinteiro", unit: "m²", laborUnitCost: 42 },
  { id: "lab-pedr", code: "MO-PEDREIRO-EQ", name: "Pedreiro + Servente", unit: "m²", laborUnitCost: 34 },
  { id: "lab-azul", code: "MO-AZULEJISTA", name: "Azulejista", unit: "m²", laborUnitCost: 52 },
];

describe("EAP Fase 2 — Mineração TQS/Revit, Compatibilização e Sanidade", () => {
  it("extrai tabelas TQS (aço, concreto, fôrmas e movimento de terra derivado) e Revit (alvenaria, portas, pisos)", () => {
    const tqsPages = [
      {
        pageNumber: 1,
        text: [
          "RESUMO ESTRUTURAL TQS",
          "Pavimento: Fundação e Baldrame",
          "Concreto fck 25 MPa Sapatas e Baldrames: 22,50 m³",
          "CA-50 10.0 mm Sapatas: 1.850,00 kg",
          "Pavimento: Pavimento Superior",
          "Concreto fck 30 MPa Pilares e Vigas: 55,00 m³",
          "CA-50 10.0 mm Pilares e Vigas: 4.950,00 kg",
          "Área de Fôrmas Vigas e Pilares: 340,00 m²",
        ].join("\n"),
      },
    ];

    const revitPages = [
      {
        pageNumber: 1,
        text: [
          "QUANTITATIVO REVIT — ARQUITETURA",
          "Área Construída Total: 280,00 m²",
          "Pavimento: Térreo",
          "TJC14 Alvenaria Vedação 14cm: 245,00 m²",
          "P1 - Porta de Madeira Interna: 12 unid",
          "Porcelanato Retificado Sala/Cozinha: 165,50 m²",
          "Pilares Concreto Estrutural (Revit): 18,00 m³",
          "Aço CA-50 Armadura (Revit): 1.600,00 kg",
        ].join("\n"),
      },
    ];

    const tqs = parseTqsPages(tqsPages, "src-tqs-1");
    const revit = parseRevitPages(revitPages, "src-revit-1");

    // TQS: 2 concretos + 2 aços + 1 fôrma + 3 derivados de movimento de terra = 8 itens
    expect(tqs.candidates.length).toBe(8);
    expect(tqs.candidates.some((c) => c.eapStageCode === "02" && c.isDerived)).toBe(true);

    // Revit: 3 arquitetônicos + 2 estruturais = 5 itens + área detectada
    expect(revit.detectedAreaM2).toBe(280);
    expect(revit.candidates.length).toBe(5);

    // Reconciliação TQS × Revit
    const reconciled = reconcileMinedCandidates({
      candidates: [...tqs.candidates, ...revit.candidates],
      hasTqsSource: true,
      builtAreaM2: 280,
      cityMaterials: MOCK_FORTALEZA_MATERIALS,
      cityLabor: MOCK_FORTALEZA_LABOR,
    });

    // Os 2 itens estruturais vindos do Revit devem ser bloqueados automaticamente (sem somar em dobro)
    expect(reconciled.conflicts).toHaveLength(2);
    expect(reconciled.conflicts.every((c) => c.status === "BLOQUEADO_AUTO")).toBe(true);
    expect(reconciled.conflicts.every((c) => c.winningSource === "TQS" && c.discardedSource === "REVIT")).toBe(true);

    // Auto-binding com Fortaleza/CE
    const tjc14 = reconciled.acceptedItems.find((i) => i.code === "ALV-TJC14");
    expect(tjc14).toBeDefined();
    expect(tjc14?.materialUnitCost).toBe(56);
    expect(tjc14?.laborUnitCost).toBe(34);
    expect(tjc14?.lossPercent).toBe(8);

    // Taxa de aço ponderada TQS: (1850 + 4950) / (22.5 + 55) = 6800 / 77.5 = 87.74 kg/m³ (dentro da faixa 25..220)
    expect(reconciled.steelRateKgPerM3).toBe(87.74);
  });

  it("dispara sanityFlag ao detectar verga lançada em m³ com volume anômalo (ex.: 32 m³)", () => {
    const revitPages = [
      {
        pageNumber: 2,
        text: "Vergas e Contravergas de Concreto: 32,00 m³",
      },
    ];
    const parsed = parseRevitPages(revitPages, "src-revit-2");
    const reconciled = reconcileMinedCandidates({
      candidates: parsed.candidates,
      hasTqsSource: false,
      cityMaterials: MOCK_FORTALEZA_MATERIALS,
      cityLabor: MOCK_FORTALEZA_LABOR,
    });

    expect(reconciled.acceptedItems).toHaveLength(1);
    expect(reconciled.acceptedItems[0].sanityFlag).toContain("ANOMALIA_UNIDADE_M3");
    expect(reconciled.sanityWarnings.length).toBeGreaterThan(0);
  });

  it("detecta revisão desatualizada no Acervo Manager sem modificar documentos originais", () => {
    const outdated = detectOutdatedAcervoSources(
      [
        { id: "src-1", acervoDocumentId: "doc-arq-1", revisionLabel: "R00" },
        { id: "src-2", acervoDocumentId: "doc-est-1", revisionLabel: "R02" },
      ],
      [
        { id: "doc-arq-1", latestRevisionNumber: "R01" },
        { id: "doc-est-1", latestRevisionNumber: "R02" },
      ]
    );

    expect(outdated).toHaveLength(1);
    expect(outdated[0]).toEqual({
      sourceFileId: "src-1",
      acervoDocumentId: "doc-arq-1",
      currentSourceRevision: "R00",
      latestAcervoRevision: "R01",
    });
  });
});
