import { NextResponse } from "next/server";
import { canUserAccessProject, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { canEditProposal } from "@/lib/proposal-access";
import { normalizeProposalItem } from "@/lib/proposal-item";

interface TakeoffItemInput {
  category: string;
  description: string;
  quantity: number;
  unit: string;
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (["CLIENTE", "CLIENT", "OPERADOR", "OPERATOR"].includes(user.role)) {
      return NextResponse.json(
        { error: "Apenas administradores e equipe comercial podem enviar quantitativos para propostas." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { projectId, documentCode, revisionNumber, items } = body as {
      projectId?: string;
      documentCode?: string;
      revisionNumber?: string;
      items?: TakeoffItemInput[];
    };

    if (!projectId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Informe o projectId e ao menos um item de quantitativo." },
        { status: 400 }
      );
    }

    const hasAccess = await canUserAccessProject(user, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Você não possui acesso habilitado a este empreendimento." },
        { status: 403 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Empreendimento não encontrado." }, { status: 404 });
    }

    // Busca proposta mais recente do empreendimento ou cria uma em rascunho
    let proposal = await prisma.proposal.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    const mappedServices = items.map((item, idx) =>
      normalizeProposalItem(
        {
          name: `[${item.category}] ${item.description}`,
          description: `Levantamento BIM/IA (${documentCode || "PRANCHA"} ${revisionNumber || "R00"})`,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: 0,
          optional: false,
        },
        idx,
      ),
    );

    if (!proposal) {
      const year = new Date().getFullYear();
      const countYear = await prisma.proposal.count({
        where: { code: { startsWith: `PROP-${year}-` } },
      });
      const code = `PROP-${year}-${(countYear + 1).toString().padStart(4, "0")}`;

      proposal = await prisma.proposal.create({
        data: {
          projectId,
          status: "DRAFT",
          currentVersion: 1,
          code,
          versions: {
            create: {
              version: 1,
              title: `Proposta Técnica & Quantitativos — ${project.name}`,
              presentation: { summary: "Proposta gerada a partir de quantitativos BIM/IA do Acervo Manager." },
              formalText: { escopo: "Itens levantados automaticamente no Acervo Manager CDE." },
              services: mappedServices as unknown as Prisma.InputJsonValue,
              subtotal: 0,
              adjustment: 0,
              total: 0,
              authorId: user.id,
            },
          },
        },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });
    } else {
      if (!canEditProposal(proposal.status) || proposal.convertedAt) {
        return NextResponse.json(
          { error: "Proposta já aprovada, convertida ou encerrada não pode receber novos itens." },
          { status: 409 },
        );
      }
      const latestVersion = proposal.versions[0];
      const existingServices = Array.isArray(latestVersion?.services)
        ? (latestVersion.services as Array<Record<string, unknown>>)
        : [];
      const mergedServices = [...existingServices, ...mappedServices];

      if (latestVersion && !latestVersion.frozenAt && proposal.status === "DRAFT") {
        await prisma.proposalVersion.update({
          where: { id: latestVersion.id },
          data: {
            services: mergedServices as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        const nextVersionNumber = (latestVersion?.version || proposal.currentVersion || 0) + 1;
        await prisma.proposal.update({
          where: { id: proposal.id },
          data: {
            currentVersion: nextVersionNumber,
            versions: {
              create: {
                version: nextVersionNumber,
                title: latestVersion?.title || `Proposta — ${project.name}`,
                presentation: (latestVersion?.presentation as Prisma.InputJsonValue) || {},
                formalText: (latestVersion?.formalText as Prisma.InputJsonValue) || {},
                services: mergedServices as unknown as Prisma.InputJsonValue,
                subtotal: latestVersion?.subtotal || 0,
                adjustment: latestVersion?.adjustment || 0,
                total: latestVersion?.total || 0,
                authorId: user.id,
              },
            },
          },
        });
      }
    }

    const proposalPath = user.role === "ADMIN" ? `/admin/propostas/${proposal.id}` : `/equipe/propostas/${proposal.id}`;

    return NextResponse.json({
      success: true,
      proposalId: proposal.id,
      proposalCode: proposal.code,
      proposalUrl: proposalPath,
      addedCount: mappedServices.length,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_SEND_TO_PROPOSAL_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao enviar quantitativos para a proposta do empreendimento." },
      { status: 500 }
    );
  }
}
