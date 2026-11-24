import { PdfWriter } from "./pdf-writer";
import type { ContractDocumentData } from "@/lib/contract-standard";
import { formatCurrencyBRL } from "@/lib/contract-template";

const MUTED = "#64748b";

/**
 * Gera o PDF jurídico corporativo oficial do contrato ArqVértice Studio / ArqVértice OS.
 */
export function generateContractPdf(data: ContractDocumentData): Uint8Array {
  const pdf = new PdfWriter({
    title: data.title || "Contrato de Prestação de Serviços",
    author: data.contractor.studioName || "ArqVértice Studio",
    subject: `${data.project.name} — ${data.project.proposalCode || "Contrato"}`,
  });

  // Cabeçalho institucional limpo e corporativo
  pdf.rect(pdf.margin, pdf.y, pdf.contentWidth, 42, { fill: "#0f172a" });
  pdf.drawText(data.contractor.studioName.toUpperCase(), pdf.margin + 12, pdf.y + 18, {
    size: 11,
    bold: true,
    color: "#ffffff",
  });
  pdf.drawText(
    `CNPJ ${data.contractor.cnpj} · ${data.contractor.cityState} · ArqVértice OS`,
    pdf.margin + 12,
    pdf.y + 32,
    { size: 8, color: "#cbd5e1" },
  );
  pdf.y += 52;

  pdf.heading(data.title.toUpperCase(), { size: 13, gapAfter: 6 });

  // Quadro resumo de qualificação das partes
  pdf.keyValueGrid(
    [
      { label: "Contratada", value: `${data.contractor.studioName} (${data.contractor.technicalLeadName})` },
      { label: "CNPJ Contratada", value: data.contractor.cnpj },
      ...(data.includeStructuralPartner
        ? [
            { label: "Co-Contratada", value: `${data.structuralPartner.name} (${data.structuralPartner.role})` },
            { label: "CNPJ Parceiro", value: data.structuralPartner.cnpj },
          ]
        : []),
      { label: "Contratante", value: data.client.name },
      { label: "CPF/CNPJ Contratante", value: data.client.cpfOrCnpj },
      { label: "RG", value: data.client.rg },
      { label: "Nacionalidade / Estado Civil", value: `${data.client.nationality} · ${data.client.maritalStatus}` },
      { label: "Profissão", value: data.client.profession },
      { label: "Endereço", value: `${data.client.address} — ${data.client.city}` },
      { label: "Empreendimento", value: data.project.name },
      { label: "Valor Global", value: `${formatCurrencyBRL(data.totalValue)} (${data.totalInWords})` },
    ],
    { columns: 2, labelWidth: 110 },
  );
  pdf.y += 8;

  // Cláusulas 1ª a 8ª
  for (const clause of data.clauses) {
    pdf.ensure(48);
    pdf.heading(`CLÁUSULA ${clause.number}ª — ${clause.title}`, { size: 10.5, gapAfter: 4 });
    const paragraphs = clause.body.split(/\r?\n/).filter((line) => line.trim().length > 0);
    for (const p of paragraphs) {
      pdf.paragraph(p, { size: 9 });
    }
    pdf.y += 2;
  }

  // Cláusulas opcionais habilitadas
  for (const opt of data.optionalClauses) {
    if (!opt.enabled) continue;
    pdf.ensure(44);
    pdf.heading(opt.title, { size: 10.5, gapAfter: 4 });
    pdf.paragraph(opt.body, { size: 9 });
    pdf.y += 2;
  }

  // Quadro de parcelas + ART (se habilitada) + Dados PIX oficiais
  pdf.ensure(70);
  pdf.heading("QUADRO DE HONORÁRIOS, PARCELAS & PIX OFICIAL", { size: 10.5, gapAfter: 4 });
  if (data.installments.length > 0) {
    pdf.table({
      columns: [
        { title: "Parcela", weight: 3 },
        { title: "%", weight: 1, align: "right" },
        { title: "Valor", weight: 1.5, align: "right" },
        { title: "Vencimento", weight: 1.5, align: "right" },
      ],
      rows: data.installments.map((inst) => [
        `${inst.order}. ${inst.label}`,
        `${String(inst.percent).replace(".", ",")}%`,
        formatCurrencyBRL(inst.amount),
        inst.dueDate || "Conforme marco",
      ]),
      headerFill: "#0f172a",
    });
    pdf.y += 6;
  }

  if (data.artFee.enabled) {
    pdf.paragraph(
      `Taxa de RRT/ART: ${formatCurrencyBRL(data.artFee.amount)} — ${data.artFee.description} (vinculada à ${data.artFee.linkedInstallmentLabel}).`,
      { size: 8.5, color: "#0f172a" },
    );
  }

  pdf.paragraph(
    `Dados PIX (${data.contractor.pixKeyType}: ${data.contractor.pixKey}): ${data.contractor.bankInstructions}`,
    { size: 8.5, color: MUTED },
  );

  // Local, data e blocos de assinatura coerentes com as partes ativas
  pdf.ensure(110);
  pdf.y += 8;
  pdf.paragraph(`${data.forumCity}, ${data.contractDate}.`, { size: 9.5, color: "#0f172a" });
  pdf.y += 18;

  const sigParties: Array<{ line1: string; line2: string }> = [
    { line1: data.client.name, line2: `CONTRATANTE · CPF/CNPJ: ${data.client.cpfOrCnpj}` },
    {
      line1: `${data.contractor.studioName} — ${data.contractor.technicalLeadName}`,
      line2: `CONTRATADA · CNPJ: ${data.contractor.cnpj}`,
    },
  ];
  if (data.includeStructuralPartner) {
    sigParties.push({
      line1: data.structuralPartner.name,
      line2: `PARCEIRO ESTRUTURAL · CNPJ: ${data.structuralPartner.cnpj}`,
    });
  }

  for (const party of sigParties) {
    pdf.ensure(38);
    pdf.rect(pdf.margin, pdf.y + 10, 260, 0.7, { fill: "#334155" });
    pdf.drawText(party.line1, pdf.margin, pdf.y + 22, { size: 9, bold: true, color: "#0f172a" });
    pdf.drawText(party.line2, pdf.margin, pdf.y + 33, { size: 8, color: MUTED });
    pdf.y += 42;
  }

  pdf.stampFooters(`${data.contractor.studioName} · ArqVértice OS · ${data.project.name}`);
  return pdf.build();
}
