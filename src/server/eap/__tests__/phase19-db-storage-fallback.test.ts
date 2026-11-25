import { describe, expect, it } from "vitest";
import { readRawBufferFromSource } from "../pdf-reader";
import { parseTqsHtml } from "../parsers/tqs-html-parser";
import { buildDefaultContractDocument, renderContractDocumentText } from "@/lib/contract-standard";

describe("Fase 19 — Fallback db:// no Storage EAP & Contrato Independente", () => {
  it("lê e minera RESDES.HTM via fallback db:// (rawTextContent) sem depender de Cloudflare R2", async () => {
    const sampleResdesHtml = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>RESDES.HTM — TQS</title></head>
        <body>
          <h2>Resumo Estrutural Geral - Area estrutural: 200,00 m2</h2>
          <table>
            <tr><th colspan="3">Piso 1: Terreo</th></tr>
            <tr><td>Concreto C35</td><td>19,10 m3</td><td>R$ 655,00</td></tr>
            <tr><td>Forma de Madeira</td><td>186,41 m2</td><td>R$ 58,00</td></tr>
          </table>
        </body>
      </html>
    `;

    const buf = await readRawBufferFromSource({
      id: "00000000-0000-0000-0000-000000000001",
      storageKey: "db://00000000-0000-0000-0000-000000000001",
      url: "db://00000000-0000-0000-0000-000000000001",
      rawTextContent: sampleResdesHtml,
      rawBinaryBase64: null,
    });

    const decoded = buf.toString("utf8");
    expect(decoded).toContain("Resumo Estrutural Geral");
    const parsed = parseTqsHtml(decoded, "src-db-1");
    expect(parsed.candidates.length).toBeGreaterThan(0);
  });

  it("decodifica PDF binário armazenado em rawBinaryBase64 no fallback db://", async () => {
    const pdfStub = Buffer.from("%PDF-1.4\n%ArqVertice\n", "ascii");
    const buf = await readRawBufferFromSource({
      storageKey: "db://00000000-0000-0000-0000-000000000002",
      rawBinaryBase64: pdfStub.toString("base64"),
      rawTextContent: null,
    });
    expect(buf.subarray(0, 8).toString("ascii")).toBe("%PDF-1.4");
  });

  it("gera Minuta Padrão de 8 Cláusulas independente de proposta comercial prévia", () => {
    const doc = buildDefaultContractDocument({
      title: "Contrato Avulso — Residência Meireles",
      contractor: {
        studioName: "ArqVértice Studio",
        technicalLeadName: "Eduardo Marques",
        cnpj: "66.773.164/0001-60",
        cityState: "Fortaleza/CE",
        commercialAddress: "Fortaleza/CE",
        email: "contato@arqvertice.com.br",
        pixKey: "66.773.164/0001-60",
        pixKeyType: "CNPJ",
        bankInstructions: "PIX CNPJ 66.773.164/0001-60",
      },
      includeStructuralPartner: true,
      client: {
        name: "Maria Silva",
        nationality: "brasileira",
        maritalStatus: "casada",
        profession: "Médica",
        rg: "1234567",
        cpfOrCnpj: "111.222.333-44",
        address: "Av. Beira Mar, 1000",
        city: "Fortaleza/CE",
      },
      project: {
        name: "Residência Meireles",
        type: "Residencial",
        areaM2: "320 m²",
        cityState: "Fortaleza/CE",
        proposalCode: "Minuta Avulsa",
      },
      scopeLines: ["Projeto Arquitetônico e Estrutural Executivo"],
      businessDays: 45,
      totalValue: 35000,
      artFee: { enabled: true, amount: 108.39 },
      contractDate: new Date("2026-11-24T12:00:00Z"),
      forumCity: "Fortaleza/CE",
    });

    expect(doc.clauses.length).toBeGreaterThanOrEqual(8);
    expect(doc.contractor.cnpj).toBe("66.773.164/0001-60");
    expect(doc.includeStructuralPartner).toBe(true);
    const fullText = renderContractDocumentText(doc);
    expect(fullText).toContain("66.773.164/0001-60");
    expect(fullText).toContain("Emanoel Luan Almeida da Rocha");
  });
});
