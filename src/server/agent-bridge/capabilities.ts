import { z } from "zod";
import { prisma } from "@/server/db";
import { getStudioSettings } from "@/server/services/settings-service";
import { updateProjectInstallment } from "@/server/services/installment-service";
import { parseCurrencyBRL, formatCurrencyBRL, formatDateBR } from "@/lib/formatters";
import { sendEmailViaResendApi, ensureEmailBootstrap } from "@/lib/email/email-infra";

export type AgentSource = "OPENBOT" | "OLLAMA_LOCAL" | "WHATSAPP_GATEWAY";
export type AgentModule =
  | "PROJECTS"
  | "ACERVO"
  | "FINANCE"
  | "PROPOSALS"
  | "EMAIL"
  | "BOOKING"
  | "WHATSAPP"
  | "TEAM"
  | "SETTINGS";

export interface AgentCapabilityDef {
  name: string;
  module: AgentModule;
  description: string;
  riskLevel: "READ" | "WRITE";
  requiresConfirmation: boolean;
  inputSchema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  revalidatePaths?: string[];
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

const CAPABILITIES: AgentCapabilityDef[] = [
  // 1. VISÃO EXECUTIVA & DIAGNÓSTICO
  {
    name: "system.overview",
    module: "SETTINGS",
    description: "Retorna KPIs consolidados do escritório (projetos, financeiro, acervo, e-mail e WhatsApp).",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => {
      const [projectsCount, clientsCount, pendingInstallments, openRfis, unreadEmails, waOnline, settings] =
        await Promise.all([
          prisma.project.count(),
          prisma.client.count(),
          prisma.projectInstallment.aggregate({
            where: { status: { not: "PAID" } },
            _sum: { amount: true },
            _count: true,
          }),
          prisma.acervoRfiMarkup.count({ where: { status: "ABERTA" } }),
          prisma.emailThread.count({ where: { isRead: false, folder: "INBOX" } }),
          prisma.whatsAppUserSession.count({ where: { connectionStatus: "CONNECTED" } }),
          getStudioSettings(),
        ]);

      return {
        studioName: settings.studioName,
        officialPixKey: `${settings.pixKeyType}: ${settings.pixKey}`,
        projectsCount,
        clientsCount,
        pendingInstallmentsCount: pendingInstallments._count,
        pendingInstallmentsTotal: Number(pendingInstallments._sum.amount || 0),
        openRfis,
        unreadEmails,
        whatsappSessionsOnline: waOnline,
      };
    },
  },
  {
    name: "system.health",
    module: "SETTINGS",
    description: "Verifica saúde do Neon Postgres, Gateway Local WhatsApp, Ollama e Infraestrutura de E-mail.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Date.now() - start;

      const [waGateway, emailConfig] = await Promise.all([
        prisma.whatsAppGatewayConfig.findUnique({ where: { id: "default" } }),
        prisma.emailDomainConfig.findUnique({ where: { id: "default" } }),
      ]);

      let localGatewayOnline = false;
      let ollamaOnline = false;
      let ollamaModel: string | null = null;
      if (waGateway?.gatewayUrl) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(`${waGateway.gatewayUrl.replace(/\/$/, "")}/health`, {
            signal: controller.signal,
            cache: "no-store",
          });
          clearTimeout(t);
          if (res.ok) {
            const h = (await res.json()) as { ok?: boolean; ollamaOnline?: boolean; ollamaModel?: string | null };
            localGatewayOnline = Boolean(h.ok);
            ollamaOnline = Boolean(h.ollamaOnline);
            ollamaModel = h.ollamaModel || null;
          }
        } catch {
          localGatewayOnline = false;
        }
      }

      return {
        neonPostgres: { connected: true, latencyMs: dbLatencyMs },
        whatsappGateway: {
          configured: Boolean(waGateway?.gatewayUrl),
          online: localGatewayOnline,
          ollamaOnline,
          ollamaModel,
        },
        emailInfra: {
          domain: emailConfig?.domain || "arqvertice.com.br",
          mxVerified: Boolean(emailConfig?.mxVerified),
          spfVerified: Boolean(emailConfig?.spfVerified),
          dkimVerified: Boolean(emailConfig?.dkimVerified),
        },
      };
    },
  },

  // 2. PROJETOS & CRONOGRAMA
  {
    name: "projects.list",
    module: "PROJECTS",
    description: "Lista empreendimentos com cliente, status e progresso médio de etapas.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
    jsonSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
    },
    execute: async (params) => {
      const limit = typeof params.limit === "number" ? params.limit : 20;
      const projects = await prisma.project.findMany({
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          budget: true,
          client: { select: { id: true, name: true } },
          stages: { select: { completion: true } },
        },
      });
      return projects.map((p) => {
        const avg = p.stages.length
          ? Math.round(p.stages.reduce((s, st) => s + st.completion, 0) / p.stages.length)
          : 0;
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          clientName: p.client?.name || "Cliente",
          budget: p.budget ? Number(p.budget) : null,
          progressPct: avg,
        };
      });
    },
  },
  {
    name: "projects.get",
    module: "PROJECTS",
    description: "Obtém detalhes completos de um projeto, etapas do cronograma e parcelas financeiras.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ projectId: z.string().uuid() }),
    jsonSchema: {
      type: "object",
      required: ["projectId"],
      properties: { projectId: { type: "string", format: "uuid" } },
    },
    execute: async (params) => {
      const project = await prisma.project.findUnique({
        where: { id: String(params.projectId) },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          stages: { orderBy: { order: "asc" }, select: { id: true, name: true, discipline: true, completion: true, status: true, dueDate: true } },
          installments: { orderBy: { order: "asc" }, select: { id: true, description: true, amount: true, status: true, dueDate: true, version: true } },
        },
      });
      if (!project) throw new Error("Projeto não encontrado.");
      return project;
    },
  },
  {
    name: "projects.create",
    module: "PROJECTS",
    description: "Cria um novo projeto vinculado a um cliente existente.",
    riskLevel: "WRITE",
    requiresConfirmation: false,
    inputSchema: z.object({
      name: z.string().min(2).max(160),
      clientId: z.string().uuid(),
      budget: z.union([z.number(), z.string()]).optional(),
      description: z.string().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["name", "clientId"],
      properties: {
        name: { type: "string" },
        clientId: { type: "string", format: "uuid" },
        budget: { type: "number" },
        description: { type: "string" },
      },
    },
    revalidatePaths: ["/admin", "/admin/projetos", "/equipe/projetos"],
    execute: async (params) => {
      const budgetVal = params.budget !== undefined ? parseCurrencyBRL(params.budget) : null;
      return prisma.project.create({
        data: {
          name: String(params.name).trim(),
          clientId: String(params.clientId),
          budget: budgetVal,
          description: typeof params.description === "string" ? params.description : null,
          status: "PLANNING",
        },
        select: { id: true, name: true, status: true, clientId: true },
      });
    },
  },
  {
    name: "projects.updateStage",
    module: "PROJECTS",
    description: "Atualiza progresso (0–100%) e status de uma etapa do cronograma.",
    riskLevel: "WRITE",
    requiresConfirmation: false,
    inputSchema: z.object({
      stageId: z.string().uuid(),
      completion: z.number().int().min(0).max(100),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "DELAYED"]).optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["stageId", "completion"],
      properties: {
        stageId: { type: "string", format: "uuid" },
        completion: { type: "integer", minimum: 0, maximum: 100 },
        status: { type: "string" },
      },
    },
    revalidatePaths: ["/admin", "/admin/cronograma", "/equipe/cronograma"],
    execute: async (params) => {
      const completion = Number(params.completion);
      const allowedStatuses = ["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const;
      type StageStatus = (typeof allowedStatuses)[number];
      const rawStatus = typeof params.status === "string" ? params.status : "";
      const status: StageStatus = (allowedStatuses as readonly string[]).includes(rawStatus)
        ? (rawStatus as StageStatus)
        : completion >= 100
          ? "COMPLETED"
          : completion > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      return prisma.scheduleStage.update({
        where: { id: String(params.stageId) },
        data: { completion, status },
        select: { id: true, name: true, completion: true, status: true, projectId: true },
      });
    },
  },

  // 3. ACERVO MANAGER / CDE
  {
    name: "acervo.listFiles",
    module: "ACERVO",
    description: "Lista pranchas e revisões técnicas do Acervo Manager CDE.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({
      projectId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    jsonSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", format: "uuid" },
        limit: { type: "integer" },
      },
    },
    execute: async (params) => {
      const docs = await prisma.acervoDocument.findMany({
        where: params.projectId ? { projectId: String(params.projectId) } : undefined,
        take: typeof params.limit === "number" ? params.limit : 25,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          code: true,
          title: true,
          discipline: true,
          projectId: true,
          revisions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { id: true, revisionNumber: true, status: true },
          },
        },
      });
      return docs;
    },
  },
  {
    name: "acervo.releaseForConstruction",
    module: "ACERVO",
    description: "Promove uma revisão de prancha para status 'BOM_PARA_OBRA' e registra histórico CDE.",
    riskLevel: "WRITE",
    requiresConfirmation: true,
    inputSchema: z.object({
      revisionId: z.string().uuid(),
      note: z.string().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["revisionId"],
      properties: {
        revisionId: { type: "string", format: "uuid" },
        note: { type: "string" },
      },
    },
    revalidatePaths: ["/admin/acervo", "/equipe/acervo"],
    execute: async (params) => {
      const rev = await prisma.acervoRevision.update({
        where: { id: String(params.revisionId) },
        data: { status: "BOM_PARA_OBRA" },
        include: { document: { select: { id: true, code: true, title: true } } },
      });
      return {
        revisionId: rev.id,
        revisionNumber: rev.revisionNumber,
        documentCode: rev.document.code,
        status: rev.status,
      };
    },
  },
  {
    name: "acervo.createRfi",
    module: "ACERVO",
    description: "Registra uma RFI / pendência técnica vinculada a uma revisão do Acervo (ex.: compatibilização estrutural).",
    riskLevel: "WRITE",
    requiresConfirmation: false,
    inputSchema: z.object({
      revisionId: z.string().uuid(),
      title: z.string().min(3).max(200),
      description: z.string().min(3),
      discipline: z.string().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["revisionId", "title", "description"],
      properties: {
        revisionId: { type: "string", format: "uuid" },
        title: { type: "string" },
        description: { type: "string" },
        discipline: { type: "string" },
      },
    },
    revalidatePaths: ["/admin/acervo", "/equipe/acervo"],
    execute: async (params) => {
      const rev = await prisma.acervoRevision.findUnique({
        where: { id: String(params.revisionId) },
        select: { id: true, documentId: true },
      });
      if (!rev) throw new Error("Revisão do Acervo não encontrada.");
      return prisma.acervoRfiMarkup.create({
        data: {
          code: `RFI-${Date.now().toString().slice(-4)}`,
          documentId: rev.documentId,
          revisionId: rev.id,
          title: String(params.title).trim(),
          description: String(params.description).trim(),
          status: "ABERTA",
        },
        select: { id: true, code: true, title: true, status: true, revisionId: true },
      });
    },
  },

  // 4. FINANCEIRO & PIX OFICIAL (021.502.003-09)
  {
    name: "finance.summary",
    module: "FINANCE",
    description: "Retorna resumo de caixa (total, recebido, pendente, em atraso) e Chave Pix Oficial.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ projectId: z.string().uuid().optional() }),
    jsonSchema: {
      type: "object",
      properties: { projectId: { type: "string", format: "uuid" } },
    },
    execute: async (params) => {
      const [installments, settings] = await Promise.all([
        prisma.projectInstallment.findMany({
          where: params.projectId ? { projectId: String(params.projectId) } : undefined,
          select: { amount: true, status: true, dueDate: true },
        }),
        getStudioSettings(),
      ]);
      let total = 0;
      let paid = 0;
      let overdue = 0;
      const now = Date.now();
      for (const i of installments) {
        const amt = Number(i.amount || 0);
        total += amt;
        if (i.status === "PAID") paid += amt;
        else if (i.status === "OVERDUE" || new Date(i.dueDate).getTime() < now) overdue += amt;
      }
      return {
        total,
        paid,
        pending: Math.max(0, total - paid),
        overdue,
        officialPix: { type: settings.pixKeyType, key: settings.pixKey },
      };
    },
  },
  {
    name: "finance.listEntries",
    module: "FINANCE",
    description: "Lista parcelas do cronograma financeiro.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({
      projectId: z.string().uuid().optional(),
      status: z.enum(["PENDING", "PAID", "OVERDUE", "READY_TO_BILL"]).optional(),
    }),
    jsonSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", format: "uuid" },
        status: { type: "string" },
      },
    },
    execute: async (params) => {
      return prisma.projectInstallment.findMany({
        where: {
          ...(params.projectId ? { projectId: String(params.projectId) } : {}),
          ...(params.status ? { status: String(params.status) } : {}),
        },
        take: 40,
        orderBy: [{ dueDate: "asc" }, { order: "asc" }],
        select: {
          id: true,
          projectId: true,
          description: true,
          amount: true,
          status: true,
          dueDate: true,
          version: true,
          project: { select: { name: true } },
        },
      });
    },
  },
  {
    name: "finance.createEntry",
    module: "FINANCE",
    description: "Cria uma nova parcela/lançamento no cronograma financeiro de um projeto.",
    riskLevel: "WRITE",
    requiresConfirmation: false,
    inputSchema: z.object({
      projectId: z.string().uuid(),
      description: z.string().min(2),
      amount: z.union([z.number(), z.string()]),
      dueDate: z.string(),
      order: z.number().int().positive().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["projectId", "description", "amount", "dueDate"],
      properties: {
        projectId: { type: "string", format: "uuid" },
        description: { type: "string" },
        amount: { type: "number" },
        dueDate: { type: "string" },
        order: { type: "integer" },
      },
    },
    revalidatePaths: ["/admin", "/admin/financeiro", "/equipe/financeiro"],
    execute: async (params) => {
      const amount = parseCurrencyBRL(params.amount);
      if (amount === null) throw new Error("Valor monetário inválido.");
      const count = await prisma.projectInstallment.count({
        where: { projectId: String(params.projectId) },
      });
      return prisma.projectInstallment.create({
        data: {
          projectId: String(params.projectId),
          description: String(params.description).trim(),
          amount,
          dueDate: new Date(String(params.dueDate)),
          status: "PENDING",
          order: typeof params.order === "number" ? params.order : count + 1,
        },
        select: { id: true, description: true, amount: true, status: true, dueDate: true, version: true },
      });
    },
  },
  {
    name: "finance.markInstallmentPaid",
    module: "FINANCE",
    description: "Dá baixa (marca como PAID) em uma parcela do cronograma com controle de versão.",
    riskLevel: "WRITE",
    requiresConfirmation: true,
    inputSchema: z.object({
      projectId: z.string().uuid(),
      installmentId: z.string().uuid(),
    }),
    jsonSchema: {
      type: "object",
      required: ["projectId", "installmentId"],
      properties: {
        projectId: { type: "string", format: "uuid" },
        installmentId: { type: "string", format: "uuid" },
      },
    },
    revalidatePaths: ["/admin", "/admin/financeiro", "/equipe/financeiro"],
    execute: async (params) => {
      return updateProjectInstallment(
        String(params.projectId),
        String(params.installmentId),
        { status: "PAID", paidDate: new Date() }
      );
    },
  },
  {
    name: "finance.sendPixReminder",
    module: "FINANCE",
    description: "Gera texto oficial de cobrança Pix (CPF 021.502.003-09) para uma parcela.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ installmentId: z.string().uuid() }),
    jsonSchema: {
      type: "object",
      required: ["installmentId"],
      properties: { installmentId: { type: "string", format: "uuid" } },
    },
    execute: async (params) => {
      const [inst, settings] = await Promise.all([
        prisma.projectInstallment.findUnique({
          where: { id: String(params.installmentId) },
          include: { project: { select: { name: true, client: { select: { name: true, phone: true, email: true } } } } },
        }),
        getStudioSettings(),
      ]);
      if (!inst) throw new Error("Parcela não encontrada.");
      const message = `Olá, ${inst.project.client.name}! Segue o lembrete da parcela "${inst.description}" (${inst.project.name}) no valor de ${formatCurrencyBRL(inst.amount)} com vencimento em ${formatDateBR(inst.dueDate)}.\n\nChave Pix (${settings.pixKeyType}): ${settings.pixKey} — ${settings.technicalLeadName} / ${settings.studioName}.`;
      return {
        installmentId: inst.id,
        recipientName: inst.project.client.name,
        recipientPhone: inst.project.client.phone,
        recipientEmail: inst.project.client.email,
        pixKey: settings.pixKey,
        pixKeyType: settings.pixKeyType,
        message,
      };
    },
  },

  // 5. COMERCIAL & PROPOSTAS
  {
    name: "proposals.list",
    module: "PROPOSALS",
    description: "Lista propostas comerciais do estúdio.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ limit: z.number().int().min(1).max(30).optional() }),
    jsonSchema: { type: "object", properties: { limit: { type: "integer" } } },
    execute: async (params) => {
      return prisma.proposal.findMany({
        take: typeof params.limit === "number" ? params.limit : 15,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          code: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          project: { select: { id: true, name: true, client: { select: { name: true } } } },
          versions: {
            take: 1,
            orderBy: { version: "desc" },
            select: { title: true, total: true },
          },
        },
      });
    },
  },
  {
    name: "proposals.create",
    module: "PROPOSALS",
    description: "Cria uma proposta comercial preliminar vinculada a um projeto usando os dados institucionais do estúdio.",
    riskLevel: "WRITE",
    requiresConfirmation: false,
    inputSchema: z.object({
      projectId: z.string().uuid(),
      title: z.string().min(3),
      totalValue: z.union([z.number(), z.string()]),
      scopeSummary: z.string().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["projectId", "title", "totalValue"],
      properties: {
        projectId: { type: "string", format: "uuid" },
        title: { type: "string" },
        totalValue: { type: "number" },
        scopeSummary: { type: "string" },
      },
    },
    revalidatePaths: ["/admin/propostas", "/equipe/propostas"],
    execute: async (params) => {
      const total = parseCurrencyBRL(params.totalValue);
      if (total === null) throw new Error("Valor da proposta inválido.");
      const settings = await getStudioSettings();
      const code = `PROP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      return prisma.proposal.create({
        data: {
          projectId: String(params.projectId),
          code,
          status: "DRAFT",
          currentVersion: 1,
          versions: {
            create: {
              version: 1,
              title: String(params.title).trim(),
              presentation: {},
              formalText: {
                escopo:
                  typeof params.scopeSummary === "string"
                    ? params.scopeSummary
                    : settings.defaultProposalScope || "Escopo Arquitetônico Completo ArqVértice Studio",
              },
              services: [],
              subtotal: total,
              adjustment: 0,
              total,
            },
          },
        },
        select: {
          id: true,
          code: true,
          status: true,
          currentVersion: true,
          versions: { select: { id: true, title: true, total: true } },
        },
      });
    },
  },

  // 6. E-MAIL PROFISSIONAL
  {
    name: "email.listThreads",
    module: "EMAIL",
    description: "Lista threads recentes das caixas corporativas @arqvertice.com.br.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ limit: z.number().int().min(1).max(30).optional() }),
    jsonSchema: { type: "object", properties: { limit: { type: "integer" } } },
    execute: async (params) => {
      await ensureEmailBootstrap();
      return prisma.emailThread.findMany({
        take: typeof params.limit === "number" ? params.limit : 15,
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          subject: true,
          folder: true,
          isRead: true,
          participantEmail: true,
          snippet: true,
          lastMessageAt: true,
          mailbox: { select: { address: true } },
        },
      });
    },
  },
  {
    name: "email.sendOrDraft",
    module: "EMAIL",
    description: "Envia e-mail profissional via Resend API ou salva na caixa corporativa.",
    riskLevel: "WRITE",
    requiresConfirmation: true,
    inputSchema: z.object({
      to: z.string().email(),
      subject: z.string().min(2),
      bodyText: z.string().min(2),
      fromPrefix: z.enum(["eduardo", "contato", "projetos", "financeiro"]).optional(),
      sendNow: z.boolean().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["to", "subject", "bodyText"],
      properties: {
        to: { type: "string", format: "email" },
        subject: { type: "string" },
        bodyText: { type: "string" },
        fromPrefix: { type: "string" },
        sendNow: { type: "boolean" },
      },
    },
    revalidatePaths: ["/admin/email", "/equipe/email"],
    execute: async (params) => {
      await ensureEmailBootstrap();
      const prefix = typeof params.fromPrefix === "string" ? params.fromPrefix : "contato";
      const mailbox = await prisma.emailMailbox.findFirst({
        where: { address: { startsWith: `${prefix}@` } },
      });
      if (!mailbox) throw new Error("Caixa corporativa não encontrada.");

      const thread = await prisma.emailThread.create({
        data: {
          mailboxId: mailbox.id,
          subject: String(params.subject).trim(),
          folder: "SENT",
          isRead: true,
          participantEmail: String(params.to).trim().toLowerCase(),
          snippet: String(params.bodyText).slice(0, 140),
        },
      });

      let providerId: string | null = null;
      let status = "SCHEDULED";
      if (params.sendNow !== false && process.env.RESEND_API_KEY) {
        const sent = await sendEmailViaResendApi({
          from: `ArqVértice <${mailbox.address}>`,
          to: [String(params.to).trim()],
          subject: String(params.subject).trim(),
          text: String(params.bodyText),
        });
        providerId = sent.id;
        status = "SENT";
      }

      const msg = await prisma.emailMessage.create({
        data: {
          threadId: thread.id,
          direction: "OUTBOUND",
          fromAddress: mailbox.address,
          toAddresses: [String(params.to).trim()],
          subject: String(params.subject).trim(),
          bodyText: String(params.bodyText),
          status,
          providerId,
          sentAt: status === "SENT" ? new Date() : null,
        },
        select: { id: true, status: true, providerId: true, fromAddress: true },
      });

      return { threadId: thread.id, ...msg };
    },
  },

  // 7. AGENDA & REUNIÕES (/agendar)
  {
    name: "booking.listUpcoming",
    module: "BOOKING",
    description: "Lista reuniões agendadas via /agendar.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ limit: z.number().int().min(1).max(30).optional() }),
    jsonSchema: { type: "object", properties: { limit: { type: "integer" } } },
    execute: async (params) => {
      return prisma.clientBooking.findMany({
        where: { status: "CONFIRMED" },
        take: typeof params.limit === "number" ? params.limit : 15,
        orderBy: { scheduledAt: "asc" },
      });
    },
  },
  {
    name: "booking.createSlot",
    module: "BOOKING",
    description: "Registra um novo agendamento de reunião na agenda pública.",
    riskLevel: "WRITE",
    requiresConfirmation: false,
    inputSchema: z.object({
      clientName: z.string().min(2),
      clientEmail: z.string().email(),
      topic: z.string().min(2),
      scheduledAt: z.string(),
      meetingType: z.enum(["ONLINE", "PRESENCIAL"]).optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["clientName", "clientEmail", "topic", "scheduledAt"],
      properties: {
        clientName: { type: "string" },
        clientEmail: { type: "string" },
        topic: { type: "string" },
        scheduledAt: { type: "string" },
        meetingType: { type: "string" },
      },
    },
    execute: async (params) => {
      return prisma.clientBooking.create({
        data: {
          clientName: String(params.clientName).trim(),
          clientEmail: String(params.clientEmail).trim().toLowerCase(),
          topic: String(params.topic).trim(),
          scheduledAt: new Date(String(params.scheduledAt)),
          meetingType: params.meetingType === "PRESENCIAL" ? "PRESENCIAL" : "ONLINE",
          status: "CONFIRMED",
        },
      });
    },
  },

  // 8. WHATSAPP MULTI-SESSÃO
  {
    name: "whatsapp.sessions",
    module: "WHATSAPP",
    description: "Lista sessões WhatsApp pareadas dos Arquitetos e Engenheiros.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {} },
    execute: async () => {
      return prisma.whatsAppUserSession.findMany({
        orderBy: { userName: "asc" },
        select: {
          id: true,
          userId: true,
          userName: true,
          userRole: true,
          sessionName: true,
          connectionStatus: true,
          connectedPhone: true,
          onlyKnownContacts: true,
        },
      });
    },
  },
  {
    name: "whatsapp.recentChats",
    module: "WHATSAPP",
    description: "Lista conversas recentes filtradas por privacidade no WhatsApp.",
    riskLevel: "READ",
    requiresConfirmation: false,
    inputSchema: z.object({ limit: z.number().int().min(1).max(30).optional() }),
    jsonSchema: { type: "object", properties: { limit: { type: "integer" } } },
    execute: async (params) => {
      return prisma.whatsAppConversation.findMany({
        take: typeof params.limit === "number" ? params.limit : 15,
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          contactName: true,
          contactPhone: true,
          projectId: true,
          unreadCount: true,
          lastMessageAt: true,
        },
      });
    },
  },
  {
    name: "whatsapp.sendMessage",
    module: "WHATSAPP",
    description: "Envia mensagem WhatsApp a partir de uma sessão conectada no Gateway Local.",
    riskLevel: "WRITE",
    requiresConfirmation: true,
    inputSchema: z.object({
      toPhone: z.string().min(8),
      text: z.string().min(2),
      sessionId: z.string().uuid().optional(),
    }),
    jsonSchema: {
      type: "object",
      required: ["toPhone", "text"],
      properties: {
        toPhone: { type: "string" },
        text: { type: "string" },
        sessionId: { type: "string", format: "uuid" },
      },
    },
    revalidatePaths: ["/admin/whatsapp", "/equipe/whatsapp"],
    execute: async (params) => {
      const session = params.sessionId
        ? await prisma.whatsAppUserSession.findUnique({ where: { id: String(params.sessionId) } })
        : await prisma.whatsAppUserSession.findFirst({ orderBy: { isStudioOfficial: "desc" } });
      if (!session) throw new Error("Nenhuma sessão WhatsApp provisionada.");

      const cleanPhone = String(params.toPhone).replace(/\D/g, "");
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;
      const conv = await prisma.whatsAppConversation.upsert({
        where: { sessionId_remoteJid: { sessionId: session.id, remoteJid } },
        update: { lastMessageAt: new Date() },
        create: {
          sessionId: session.id,
          ownerUserId: session.userId,
          remoteJid,
          contactPhone: cleanPhone,
          contactName: cleanPhone,
        },
      });
      const msg = await prisma.whatsAppMessage.create({
        data: {
          conversationId: conv.id,
          direction: "OUTBOUND",
          bodyText: String(params.text),
          status: "QUEUED",
        },
      });
      return { conversationId: conv.id, messageId: msg.id, status: msg.status };
    },
  },
];

export function getAgentManifest() {
  return {
    name: "ArqVértice Flow Command Bridge",
    version: "1.0.0",
    authHeader: "x-agent-key",
    capabilities: CAPABILITIES.map((c) => ({
      name: c.name,
      module: c.module,
      description: c.description,
      riskLevel: c.riskLevel,
      requiresConfirmation: c.requiresConfirmation,
      parameters: c.jsonSchema,
    })),
  };
}

export async function executeAgentAction(input: {
  action: string;
  params?: Record<string, unknown>;
  dryRun?: boolean;
  confirmationToken?: string;
  source?: AgentSource;
  actorEmail?: string | null;
}) {
  const cap = CAPABILITIES.find((c) => c.name === input.action);
  if (!cap) {
    throw new Error(`Ação desconhecida: ${input.action}`);
  }

  const parsedParams = cap.inputSchema.parse(input.params || {}) as Record<string, unknown>;
  const source: AgentSource = input.source || "OPENBOT";

  if (cap.requiresConfirmation && !input.dryRun && input.confirmationToken !== "CONFIRMED") {
    await prisma.agentActionLog.create({
      data: {
        source,
        actorEmail: input.actorEmail || null,
        module: cap.module,
        actionName: cap.name,
        inputSummary: JSON.stringify(parsedParams).slice(0, 500),
        resultSummary: "Aguardando confirmação explícita (confirmationToken: CONFIRMED).",
        status: "PENDING_CONFIRMATION",
      },
    });
    return {
      ok: false,
      status: "PENDING_CONFIRMATION",
      action: cap.name,
      message: "Esta ação modifica dados críticos. Reenvie com confirmationToken: 'CONFIRMED'.",
    };
  }

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      action: cap.name,
      module: cap.module,
      validatedParams: parsedParams,
    };
  }

  try {
    const result = await cap.execute(parsedParams);
    await prisma.agentActionLog.create({
      data: {
        source,
        actorEmail: input.actorEmail || null,
        module: cap.module,
        actionName: cap.name,
        inputSummary: JSON.stringify(parsedParams).slice(0, 500),
        resultSummary: JSON.stringify(result).slice(0, 1000),
        status: "SUCCESS",
      },
    });
    return {
      ok: true,
      status: "SUCCESS",
      action: cap.name,
      module: cap.module,
      revalidatePaths: cap.revalidatePaths || [],
      data: result,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Erro ao executar ação.";
    await prisma.agentActionLog.create({
      data: {
        source,
        actorEmail: input.actorEmail || null,
        module: cap.module,
        actionName: cap.name,
        inputSummary: JSON.stringify(parsedParams).slice(0, 500),
        resultSummary: errMsg.slice(0, 1000),
        status: "ERROR",
      },
    });
    throw err;
  }
}
