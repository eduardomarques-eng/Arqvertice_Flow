import { beforeEach, describe, expect, it, vi } from "vitest";
import { valorPorExtensoBRL } from "@/lib/currency-extenso";
import {
  buildDefaultEditorialData,
  computeInvestmentOptionTotal,
  computeOptionInstallments,
  readNormalizedPremisses,
} from "@/lib/proposal-standard";
import {
  buildDefaultContractDocument,
  renderContractDocumentText,
} from "@/lib/contract-standard";
import { generateProposalPdf } from "@/lib/pdf/proposal-pdf";
import { generateContractPdf } from "@/lib/pdf/contract-pdf";
import { freezePaymentPlan } from "@/lib/payment-plan";

// Mocks isolados para validar serviços sem tocar no banco real
const mockPrisma = vi.hoisted(() => ({
  studioSetting: { upsert: vi.fn() },
  proposal: { findUnique: vi.fn(), update: vi.fn() },
  proposalVersion: { findFirst: vi.fn() },
  proposalAccessLink: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  client: { findUnique: vi.fn(), update: vi.fn() },
  project: { update: vi.fn() },
  payment: { create: vi.fn() },
  projectInstallment: { upsert: vi.fn(), count: vi.fn() },
  contract: { findUnique: vi.fn(), update: vi.fn() },
  contractAddendum: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  notificationEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockAuth = vi.hoisted(() => ({
  currentUser: vi.fn(),
  requireRole: vi.fn(),
  requireProposalAccess: vi.fn(),
  requireContractAccess: vi.fn(),
  requireProjectAccess: vi.fn(),
  canUserAccessProject: vi.fn(),
}));

const mockTemplates = vi.hoisted(() => ({
  resolveTemplate: vi.fn(),
  listActiveContractTemplates: vi.fn(),
  messageTemplateExists: vi.fn(),
}));

const mockEmail = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  escapeHtml: (s: string) => s,
}));

vi.mock("@/server/db", () => ({ prisma: mockPrisma }));
vi.mock("@/server/auth", () => mockAuth);
vi.mock("@/server/services/message-template-service", () => mockTemplates);
vi.mock("@/server/services/email-service", () => mockEmail);
vi.mock("@/server/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
  systemActor: () => ({ actorId: "system", actorRole: "SYSTEM", actorLabel: "Sistema" }),
  clientLinkActor: () => ({ actorId: "client-link", actorRole: "CLIENT", actorLabel: "Link" }),
}));
vi.mock("@/server/services/notification-service", () => ({
  recordNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/services/document-service", () => ({
  storeCommercialDocument: vi.fn().mockResolvedValue({ created: true }),
}));

import { getStudioLegalProfile } from "@/server/services/settings-service";
import { sendProposalEmail } from "@/server/services/proposal-service";
import { convertApprovedProposal } from "@/server/services/conversion-service";
import { createContractAddendum } from "@/server/services/contract-service";
import { POST as sendToProposalPost } from "@/app/api/acervo/send-to-proposal/route";

describe("Bloco B — Gerador Padrão de Propostas & Contratos ArqVértice OS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", name: "Eduardo" });
    mockAuth.currentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", name: "Eduardo" });
    mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") return fn(mockPrisma);
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("calcula opções de investimento (m² × valor), parcelas 30/35/35% e valor por extenso", () => {
    const editorial = buildDefaultEditorialData({ areaM2: 200, presetKey: "INTERIORES" });
    editorial.investmentOptions[0].unitPricePerM2 = 125;
    const total = computeInvestmentOptionTotal(editorial.investmentOptions[0]);
    expect(total).toBe(25_000);
    expect(valorPorExtensoBRL(total)).toBe("vinte e cinco mil reais");

    const installments = computeOptionInstallments(total, editorial.paymentCondition.installments);
    expect(installments.map((i) => i.percent)).toEqual([30, 35, 35]);
    expect(installments.map((i) => i.amount)).toEqual([7_500, 8_750, 8_750]);
  });

  it("unifica e preserva premisses tanto em string quanto array ou legado premises", () => {
    expect(readNormalizedPremisses({ premisses: "Linha 1\nLinha 2" })).toEqual(["Linha 1", "Linha 2"]);
    expect(readNormalizedPremisses({ premises: ["Legado A", "Legado B"] })).toEqual(["Legado A", "Legado B"]);
  });

  it("sendProposalEmail cria novo link para e-mail sem sobrescrever tokenHash do link WhatsApp existente", async () => {
    mockPrisma.proposalAccessLink.findFirst.mockResolvedValue({ id: "link-wa", versionNumber: 2 });
    mockPrisma.proposal.findUnique.mockResolvedValue({
      id: "prop-1",
      code: "PROP-2026-0001",
      expiresAt: null,
      project: { name: "Residência Praia", client: { name: "Pedro", fullName: "Pedro", email: "pedro@example.com" } },
      versions: [{ version: 2, title: "Proposta v2", total: 25000, formalText: { validityDays: 15 } }],
    });
    mockTemplates.resolveTemplate.mockResolvedValue({
      ok: true,
      key: "email.proposal",
      version: 1,
      text: "Olá Pedro, acesse sua proposta.",
    });
    mockEmail.sendEmail.mockResolvedValue({ ok: true, configured: true });

    const res = await sendProposalEmail("prop-1");
    expect(res.sent).toBe(true);
    expect(mockPrisma.proposalAccessLink.update).not.toHaveBeenCalled();
    expect(mockPrisma.proposalAccessLink.create).toHaveBeenCalledTimes(1);
  });

  it("getStudioLegalProfile usa CNPJ 66.773.164/0001-60 e omite CPF pessoal quando omitCpfInContracts está ativo", async () => {
    mockPrisma.studioSetting.upsert.mockResolvedValue({
      id: "default",
      studioName: "ArqVértice Studio",
      technicalLeadName: "Eduardo César Costa Marques",
      technicalLeadCpf: "021.502.003-09",
      omitCpfInContracts: true,
      technicalLeadReg: "CAU A123",
      studioCnpj: "66.773.164/0001-60",
      pixKey: "021.502.003-09",
      pixKeyType: "CPF",
      bankInstructions: "Pix CPF 021.502.003-09",
      structuralPartner: "Emanoel Luan Almeida da Rocha — CNPJ 51.510.575/0001-95",
      commercialAddress: "Fortaleza/CE",
      cityState: "Fortaleza / CE",
      institutionalEmail: "eduardo@arqvertice.com.br",
      documentSignature: "ArqVértice Studio",
      proposalValidityDays: 15,
      lateFeePercent: 2,
      lateInterestPercent: 1,
      defaultProposalScope: "",
      refundPolicyText: "",
      scheduleAlertDays: 3,
      inactivityTimeoutMin: 30,
      privacyPolicyVersion: "v1.0",
      forceLgpdReacceptAt: null,
      updatedAt: new Date(),
    });

    const profile = await getStudioLegalProfile();
    expect(profile.studioCnpj).toBe("66.773.164/0001-60");
    expect(profile.technicalLeadCpf).toBeNull();
    expect(profile.pixKeyType).toBe("CNPJ");
    expect(profile.pixKey).toBe("66.773.164/0001-60");
    expect(profile.bankInstructions).not.toContain("021.502.003-09");
  });

  it("gera minuta contratual de 8 cláusulas com toggle de parceiro estrutural e ART", () => {
    const doc = buildDefaultContractDocument({
      contractor: {
        studioName: "ArqVértice Studio",
        technicalLeadName: "Eduardo César Costa Marques",
        cnpj: "66.773.164/0001-60",
        cityState: "Fortaleza / CE",
        commercialAddress: "Av. Beira Mar",
        email: "eduardo@arqvertice.com.br",
        pixKey: "66.773.164/0001-60",
        pixKeyType: "CNPJ",
        bankInstructions: "PIX CNPJ 66.773.164/0001-60",
      },
      includeStructuralPartner: true,
      artFee: { enabled: true, amount: 108.39, linkedInstallmentLabel: "1ª Parcela" },
      client: { name: "Pedro Silva", cpfOrCnpj: "123.456.789-00" },
      project: { name: "Residência Praia", areaM2: "250 m²" },
      totalValue: 30_000,
    });

    expect(doc.clauses).toHaveLength(8);
    const text = renderContractDocumentText(doc);
    expect(text).toContain("66.773.164/0001-60");
    expect(text).toContain("51.510.575/0001-95");
    expect(text).toContain("trinta mil reais");
    expect(text).toContain("Taxa de RRT/ART: R$ 108,39");
  });

  it("converte approvedVersion gravando parcelas em ProjectInstallment e bloqueia OPERADOR/CLIENTE", async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      id: "prop-conv",
      status: "APPROVED",
      approvedVersion: 2,
      convertedAt: null,
      project: { id: "proj-1", name: "Obra", status: "PLANNING", startDate: new Date("2026-02-01T00:00:00Z"), clientId: "cli-1" },
      contract: { id: "ctr-1", status: "SIGNED" },
    });
    mockPrisma.proposalVersion.findFirst.mockResolvedValue({
      version: 2,
      title: "Proposta v2",
      total: 10_000,
      services: [],
      formalText: { formaPagamento: "50% entrada, 50% entrega" },
      paymentPlan: freezePaymentPlan({ formalText: { formaPagamento: "50% entrada, 50% entrega" }, total: 10_000 }),
    });
    mockPrisma.client.findUnique.mockResolvedValue({ id: "cli-1", status: "ACTIVE" });
    mockPrisma.project.update.mockResolvedValue({ status: "IN_PROGRESS" });
    mockPrisma.contract.findUnique.mockResolvedValue({ content: { text: "Contrato" }, title: "Contrato" });

    const out = await convertApprovedProposal("prop-conv");
    expect(out.converted).toBe(true);
    expect(mockPrisma.proposalVersion.findFirst).toHaveBeenCalledWith({
      where: { proposalId: "prop-conv", version: 2 },
    });
    expect(mockPrisma.projectInstallment.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.projectInstallment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: "proposal:prop-conv:v2:p1" },
      }),
    );

    // Bloqueio RBAC para OPERADOR/CLIENTE em /api/acervo/send-to-proposal
    mockAuth.currentUser.mockResolvedValueOnce({ id: "op-1", role: "OPERADOR" });
    const req = new Request("http://localhost/api/acervo/send-to-proposal", {
      method: "POST",
      body: JSON.stringify({ projectId: "proj-1", items: [{ category: "ARQ", description: "Parede", quantity: 10, unit: "m2" }] }),
    });
    const resp = await sendToProposalPost(req);
    expect(resp.status).toBe(403);
  });

  it("gera buffers válidos %PDF- para Proposta Editorial e Contrato e cria Termo Aditivo ligado a ProjectInstallment", async () => {
    const editorial = buildDefaultEditorialData({ areaM2: 180 });
    const propPdf = generateProposalPdf({
      code: "PROP-2026-0010",
      title: "Proposta Padrão",
      version: 1,
      clientName: "Pedro",
      projectName: "Residência Praia",
      services: [],
      total: 18_000,
      adjustment: 0,
      frozenPaymentPlan: freezePaymentPlan({ formalText: { formaPagamento: "30% entrada, 35% anteprojeto, 35% entrega" }, total: 18_000 }),
      formalText: { object: "Projeto completo", premisses: "Prazo em dias úteis", editorial },
      validityDays: 15,
      expiresAt: null,
      issuedAt: new Date("2026-01-10T00:00:00Z"),
      company: { name: "ArqVértice Studio", document: "66.773.164/0001-60" },
    });
    expect(Buffer.from(propPdf).toString("latin1").startsWith("%PDF-")).toBe(true);

    const contractDoc = buildDefaultContractDocument({
      contractor: {
        studioName: "ArqVértice Studio",
        technicalLeadName: "Eduardo Marques",
        cnpj: "66.773.164/0001-60",
        cityState: "Fortaleza / CE",
        commercialAddress: "",
        email: "eduardo@arqvertice.com.br",
        pixKey: "66.773.164/0001-60",
        pixKeyType: "CNPJ",
        bankInstructions: "PIX CNPJ 66.773.164/0001-60",
      },
      client: { name: "Pedro" },
      project: { name: "Residência Praia" },
      totalValue: 18_000,
    });
    const contractPdf = generateContractPdf(contractDoc);
    expect(Buffer.from(contractPdf).toString("latin1").startsWith("%PDF-")).toBe(true);

    mockPrisma.contract.findUnique.mockResolvedValue({
      id: "ctr-1",
      addendums: [],
      proposal: { projectId: "proj-1" },
    });
    mockPrisma.contractAddendum.create.mockResolvedValue({ id: "add-1", number: 1 });
    mockPrisma.projectInstallment.count.mockResolvedValue(3);

    const addendum = await createContractAddendum({
      contractId: "ctr-1",
      title: "Aditivo EAP v2.0",
      description: "Ampliação de área coberta",
      additionalValue: 4500,
      additionalDays: 15,
      eapSnapshotId: "snap-2",
    });
    expect(addendum.id).toBe("add-1");
    expect(mockPrisma.projectInstallment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: "addendum:add-1:p1" },
        create: expect.objectContaining({
          amount: 4500,
          order: 4,
        }),
      }),
    );
  });
});
