import { createHash } from "node:crypto";
import { Prisma, type ContractStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { isClientRole, requireContractAccess, requireProjectAccess, requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit } from "@/server/audit";
import { getStudioLegalProfile } from "@/server/services/settings-service";
import { generateContractPdf } from "@/lib/pdf/contract-pdf";
import {
  buildDefaultContractDocument,
  renderContractDocumentText,
  type ContractDocumentData,
} from "@/lib/contract-standard";
import { readPaymentPlanSnapshot } from "@/lib/payment-plan";
import { readProposalEditorial } from "@/lib/proposal-standard";
import { formatCurrencyBRL } from "@/lib/contract-template";
import { valorPorExtensoBRL } from "@/lib/currency-extenso";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function formatAddress(address: Prisma.JsonValue | null): string {
  if (!address || typeof address !== "object" || Array.isArray(address)) return "";
  const fields = address as Record<string, unknown>;
  if (typeof fields.formatted === "string" && fields.formatted.trim()) return fields.formatted.trim();
  const parts = ["logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cep"]
    .map((key) => (typeof fields[key] === "string" ? fields[key].trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

export async function listContracts(filters?: { query?: string; status?: string; signatureStatus?: string }) {
  await requireRole("ADMIN");
  const q = filters?.query?.trim();
  const status = filters?.status?.trim();
  const signatureStatus = filters?.signatureStatus?.trim();

  return prisma.contract.findMany({
    where: {
      ...(status && status !== "ALL" ? { status: status as ContractStatus } : {}),
      ...(signatureStatus && signatureStatus !== "ALL"
        ? { signature: { status: signatureStatus as never } }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { proposal: { project: { name: { contains: q, mode: "insensitive" } } } },
              { proposal: { project: { client: { name: { contains: q, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      signature: true,
      addendums: { orderBy: { number: "asc" } },
      proposal: {
        select: {
          id: true,
          code: true,
          status: true,
          project: {
            select: {
              id: true,
              name: true,
              client: { select: { id: true, name: true, fullName: true } },
            },
          },
        },
      },
    },
  });
}

export async function listProposalsReadyForContract() {
  await requireRole("ADMIN");
  return prisma.proposal.findMany({
    where: { contract: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      code: true,
      status: true,
      approvedVersion: true,
      currentVersion: true,
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { name: true, fullName: true } },
        },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { title: true, total: true },
      },
    },
  });
}

export async function buildStructuredContractForContractId(contractId: string): Promise<ContractDocumentData> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      proposal: {
        include: {
          project: { include: { client: true, briefing: true } },
          versions: { orderBy: { version: "desc" } },
        },
      },
    },
  });
  if (!contract) return notFound("Contrato");

  const content = (contract.content ?? {}) as Record<string, unknown>;
  if (content.structured && typeof content.structured === "object" && !Array.isArray(content.structured)) {
    return content.structured as ContractDocumentData;
  }

  const legalProfile = await getStudioLegalProfile();
  const proposal = contract.proposal;
  const version =
    proposal.versions.find((v) => v.version === (proposal.approvedVersion ?? contract.version)) ??
    proposal.versions[0];
  const formalText = ((version?.formalText as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const services = Array.isArray(version?.services) ? (version.services as Array<Record<string, unknown>>) : [];
  const totalValue = Number(version?.total ?? content.total ?? 0);
  const planSnapshot = readPaymentPlanSnapshot(version?.paymentPlan);
  const editorial = readProposalEditorial(formalText, { totalValue });
  const client = proposal.project.client;
  const briefingResponses = (proposal.project.briefing?.responses ?? {}) as Record<string, unknown>;
  const areaStr = String(
    briefingResponses.area ?? briefingResponses.areaTotal ?? briefingResponses.metragem ?? editorial.cover.areaM2 ?? "",
  );
  const hasStructural = services.some(
    (s) =>
      String(s.discipline ?? "").toUpperCase().includes("ESTRUTUR") ||
      String(s.name ?? "").toUpperCase().includes("ESTRUTUR"),
  );

  return buildDefaultContractDocument({
    title: contract.title || `Contrato de Prestação de Serviços — ${proposal.project.name}`,
    contractor: {
      studioName: legalProfile.studioName,
      technicalLeadName: legalProfile.technicalLeadName,
      cnpj: legalProfile.studioCnpj,
      cityState: legalProfile.cityState,
      commercialAddress: legalProfile.commercialAddress,
      email: legalProfile.institutionalEmail,
      pixKey: legalProfile.pixKey,
      pixKeyType: legalProfile.pixKeyType,
      bankInstructions: legalProfile.bankInstructions,
    },
    includeStructuralPartner: hasStructural,
    client: {
      name: client.fullName ?? client.name,
      nationality: client.nationality || "brasileiro(a)",
      maritalStatus: client.maritalStatus || "a informar",
      profession: client.profession || "a informar",
      rg: client.rg || "a informar",
      cpfOrCnpj: client.cpf || client.document || "a informar",
      address: formatAddress(client.address) || "Endereço a informar",
      city: client.city || legalProfile.cityState,
    },
    project: {
      name: proposal.project.name,
      type: proposal.project.type || "Arquitetura e Engenharia",
      areaM2: areaStr ? `${areaStr} m²` : "conforme levantamento",
      cityState: legalProfile.cityState,
      proposalCode: proposal.code ?? `Proposta v${contract.version}`,
    },
    scopeLines: services.map(
      (s) => `${String(s.name ?? "Serviço")} (${String(s.quantity ?? "1")} ${String(s.unit ?? "un.")})`,
    ),
    businessDays: editorial.schedule.totalBusinessDays,
    installments:
      planSnapshot?.installments.map((inst, idx) => ({
        order: idx + 1,
        label: inst.label,
        percent: inst.percent,
        amount: inst.amount,
      })) ?? undefined,
    totalValue,
    artFee: { enabled: hasStructural, amount: 108.39 },
    contractDate: proposal.approvedAt ?? contract.createdAt,
    forumCity: legalProfile.cityState,
  });
}

export async function getContractDetail(contractId: string) {
  await requireContractAccess(contractId);
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      signature: true,
      template: true,
      addendums: { orderBy: { number: "asc" } },
      proposal: {
        include: {
          project: {
            include: {
              client: true,
              installments: { orderBy: [{ order: "asc" }, { dueDate: "asc" }] },
              eapProject: {
                include: {
                  baselineSnapshots: {
                    orderBy: { approvedAt: "desc" },
                    select: { id: true, versionLabel: true, totalCommercialPrice: true, approvedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!contract) return notFound("Contrato");

  const structured = await buildStructuredContractForContractId(contractId);
  const legalProfile = await getStudioLegalProfile();

  return { contract, structured, legalProfile };
}

export async function updateContractStructuredDraft(
  contractId: string,
  structured: ContractDocumentData,
) {
  const user = await requireRole("ADMIN");
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return notFound("Contrato");

  const normalized: ContractDocumentData = {
    ...structured,
    totalInWords: valorPorExtensoBRL(structured.totalValue),
  };
  const renderedText = renderContractDocumentText(normalized);
  const currentContent = ((contract.content ?? {}) as Record<string, unknown>);

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      title: normalized.title || contract.title,
      content: json({
        ...currentContent,
        structured: normalized,
        text: renderedText,
        total: normalized.totalValue,
      }),
    },
  });

  await recordAudit("CONTRACT_CHANGED", "Contract", contractId, user.id, {
    includeStructuralPartner: normalized.includeStructuralPartner,
    artEnabled: normalized.artFee.enabled,
    totalValue: normalized.totalValue,
  });

  return { contract: updated, structured: normalized, text: renderedText };
}

export async function getContractPdfBytes(contractId: string, options?: { archiveInAcervo?: boolean }) {
  const user = await requireContractAccess(contractId);
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      proposal: {
        select: { id: true, code: true, projectId: true, project: { select: { name: true } } },
      },
    },
  });
  if (!contract) return notFound("Contrato");

  const structured = await buildStructuredContractForContractId(contractId);
  const pdfBytes = generateContractPdf(structured);

  let acervoArchived = false;
  if (options?.archiveInAcervo && user.role === "ADMIN") {
    await archiveContractPdfInAcervo(contractId, pdfBytes, user.id);
    acervoArchived = true;
  }

  return {
    pdfBytes,
    filename: `Contrato_${contract.proposal.code ?? contract.proposal.project.name}_v${contract.version}.pdf`.replace(/[^a-zA-Z0-9_.-]+/g, "_"),
    acervoArchived,
  };
}

export async function archiveContractPdfInAcervo(contractId: string, pdfBytes: Uint8Array, actorUserId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      proposal: { select: { id: true, code: true, projectId: true, project: { select: { name: true } } } },
    },
  });
  if (!contract) return notFound("Contrato");

  const projectId = contract.proposal.projectId;
  const docCode = `CTR-${contract.proposal.code ?? contract.id.slice(0, 6).toUpperCase()}`;
  const checksumSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  const base64DataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`;
  const fileName = `Contrato_${contract.proposal.project.name}_v${contract.version}.pdf`.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  const sizeKb = `${Math.max(1, Math.round(pdfBytes.byteLength / 1024))} KB`;

  const existingDoc = await prisma.acervoDocument.findUnique({
    where: { projectId_code: { projectId, code: docCode } },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
  });

  if (!existingDoc) {
    const rev = await prisma.acervoDocument.create({
      data: {
        projectId,
        code: docCode,
        title: contract.title || `Contrato Oficial — ${contract.proposal.project.name}`,
        discipline: "LEGAL_APROVACAO",
        phase: "PROJETO_LEGAL",
        category: "DOCUMENTACAO_MEMORIAL",
        revisions: {
          create: {
            revisionNumber: "R00",
            isCurrent: true,
            status: contract.status === "SIGNED" ? "APROVADO_OBRA" : "EM_REVISAO_TECNICA",
            fileUrl: `/api/contracts/${contractId}/pdf`,
            fileName,
            fileSize: sizeKb,
            fileType: "PDF",
            checksumSha256,
            viewUrl: base64DataUrl.slice(0, 512),
            uploadedById: actorUserId,
            description: `Arquivamento automático do PDF oficial do contrato (${formatCurrencyBRL(
              Number((contract.content as Record<string, unknown>)?.total ?? 0),
            )}).`,
          },
        },
      },
      include: { revisions: true },
    });
    if (rev.revisions[0]) {
      await prisma.acervoDocument.update({
        where: { id: rev.id },
        data: { currentRevisionId: rev.revisions[0].id },
      });
    }
    return rev;
  }

  const nextRevNumber = `R${String(existingDoc.revisions.length).padStart(2, "0")}`;
  await prisma.acervoRevision.updateMany({
    where: { documentId: existingDoc.id, isCurrent: true },
    data: { isCurrent: false },
  });
  const createdRev = await prisma.acervoRevision.create({
    data: {
      documentId: existingDoc.id,
      revisionNumber: nextRevNumber,
      isCurrent: true,
      status: contract.status === "SIGNED" ? "APROVADO_OBRA" : "EM_REVISAO_TECNICA",
      fileUrl: `/api/contracts/${contractId}/pdf`,
      fileName,
      fileSize: sizeKb,
      fileType: "PDF",
      checksumSha256,
      uploadedById: actorUserId,
      description: "Nova revisão do PDF oficial do contrato.",
    },
  });
  await prisma.acervoDocument.update({
    where: { id: existingDoc.id },
    data: { currentRevisionId: createdRev.id },
  });
  return existingDoc;
}

export async function createContractAddendum(input: {
  contractId: string;
  title: string;
  description: string;
  additionalValue: number;
  additionalDays?: number;
  eapSnapshotId?: string | null;
  dueDate?: Date | null;
}) {
  const user = await requireRole("ADMIN");
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    include: {
      addendums: { orderBy: { number: "desc" }, take: 1 },
      proposal: { select: { projectId: true } },
    },
  });
  if (!contract) return notFound("Contrato");

  const nextNumber = (contract.addendums[0]?.number ?? 0) + 1;
  const projectId = contract.proposal.projectId;
  const additionalValue = Math.max(0, Number(input.additionalValue) || 0);
  const dueDate = input.dueDate ?? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const addendum = await tx.contractAddendum.create({
      data: {
        contractId: contract.id,
        projectId,
        eapSnapshotId: input.eapSnapshotId || null,
        number: nextNumber,
        title: input.title.trim(),
        description: input.description.trim(),
        additionalValue,
        additionalDays: Math.max(0, Math.round(Number(input.additionalDays) || 0)),
        status: "READY",
        installmentsJson: json([
          {
            order: 1,
            label: `Termo Aditivo nº ${nextNumber} — ${input.title.trim()}`,
            amount: additionalValue,
            dueDate: dueDate.toISOString(),
          },
        ]),
      },
    });

    if (additionalValue > 0) {
      const existingCount = await tx.projectInstallment.count({ where: { projectId } });
      const sourceKey = `addendum:${addendum.id}:p1`;
      await tx.projectInstallment.upsert({
        where: { sourceKey },
        update: {},
        create: {
          projectId,
          description: `Aditivo #${nextNumber}: ${input.title.trim()}`,
          amount: additionalValue,
          dueDate,
          status: "PENDING",
          order: existingCount + 1,
          sourceKey,
        },
      });
    }

    return addendum;
  });

  await recordAudit("CONTRACT_CHANGED", "ContractAddendum", result.id, user.id, {
    contractId: contract.id,
    number: nextNumber,
    additionalValue,
    eapSnapshotId: input.eapSnapshotId ?? null,
  });

  return result;
}

export async function listProjectContractsForPortal(projectId: string) {
  const user = await requireProjectAccess(projectId);
  const isClient = isClientRole(user.role);
  return prisma.contract.findMany({
    where: {
      proposal: { projectId },
      ...(isClient ? { status: { in: ["READY", "SENT", "VIEWED", "SIGNED"] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      signature: { select: { status: true, signedAt: true, signatoryName: true } },
      addendums: { orderBy: { number: "asc" } },
      proposal: { select: { code: true, approvedVersion: true } },
    },
  });
}

export async function createContractTemplate(input: {
  name: string;
  body: string;
  scopeKey?: string | null;
  disciplines?: string[];
  isDefault?: boolean;
}) {
  const user = await requireRole("ADMIN");
  if (!input.name.trim() || !input.body.trim()) {
    throw new Error("Informe o nome e o texto da minuta contratual.");
  }
  const template = await prisma.contractTemplate.create({
    data: {
      name: input.name.trim(),
      body: input.body,
      scopeKey: input.scopeKey?.trim() || null,
      disciplines: input.disciplines ?? [],
      isDefault: Boolean(input.isDefault),
      active: true,
      clauses: [],
    },
  });
  await recordAudit("CONTRACT_TEMPLATE_UPDATED", "ContractTemplate", template.id, user.id, { name: template.name, created: true });
  return template;
}
