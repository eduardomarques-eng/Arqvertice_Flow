import { describe, expect, it } from "vitest";
import { CANONICAL_LOB_PACKAGE_RULES } from "@/lib/eap-lob-grid";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import {
  drawPdfGroupedBarChart,
  drawPdfParetoAbcChart,
} from "@/lib/pdf/pdf-charts";

describe("Phase 34 — BDI, Equipes B/C, Pacote 37 e Gráficos PDF", () => {
  it("atribui corretamente Equipes A, B e C em CANONICAL_LOB_PACKAGE_RULES", () => {
    const teamA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 22, 27, 31, 35, 38];
    const teamB = [15, 16, 17, 18, 29, 34];
    const teamC = [19, 20, 23, 24, 25, 26, 28, 30, 32, 33, 36, 37];

    for (const pkg of teamA) {
      expect(CANONICAL_LOB_PACKAGE_RULES[pkg]?.defaultTeam).toBe("A");
    }
    for (const pkg of teamB) {
      expect(CANONICAL_LOB_PACKAGE_RULES[pkg]?.defaultTeam).toBe("B");
    }
    for (const pkg of teamC) {
      expect(CANONICAL_LOB_PACKAGE_RULES[pkg]?.defaultTeam).toBe("C");
    }
  });

  it("renomeia o Pacote 37 para Guarda-Corpos em Madeira Maciça e Corrimãos", () => {
    const pkg37 = MASTER_LOB_PACKAGES.find((p) => p.packageNumber === 37);
    expect(pkg37?.name).toBe("Guarda-Corpos em Madeira Maciça e Corrimãos");
  });

  it("gera PDF válido para drawPdfGroupedBarChart e drawPdfParetoAbcChart com rótulos longos", () => {
    const pdf = new PdfWriter({
      title: "Teste Gráficos PDF",
      author: "ArqVértice OS",
      subject: "Validação de layout",
    });
    drawPdfGroupedBarChart(pdf, {
      title: "Avanço Físico por Pavimento",
      seriesA: { label: "Previsto Linha de Balanço", colorHex: "#94A3B8" },
      seriesB: { label: "Realizado no Canteiro", colorHex: "#0EA5E9" },
      items: [
        {
          label: "Infraestrutura / Fundação",
          valueA: 100,
          valueB: 100,
          formattedA: "100%",
          formattedB: "100%",
        },
        {
          label: "Pavimento Térreo",
          valueA: 65,
          valueB: 42,
          formattedA: "65%",
          formattedB: "42%",
        },
      ],
    });
    drawPdfParetoAbcChart(pdf, {
      title: "Curva ABC — Principais Itens",
      items: [
        {
          label:
            "Fornecimento e assentamento de porcelanato acetinado retificado 90x90cm com argamassa AC-III",
          formattedValue: "R$ 45.200,00",
          value: 45200,
          cumulativePercent: 14.5,
          abcClass: "A",
        },
      ],
    });
    const bytes = pdf.build();
    expect(bytes.length).toBeGreaterThan(500);
  });
});
