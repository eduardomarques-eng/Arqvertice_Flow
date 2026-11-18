import { prisma } from "@/server/db";

export const DEFAULT_EMAIL_DOMAIN =
  (process.env.EMAIL_PRIMARY_DOMAIN || "arqvertice.com.br").trim().toLowerCase();

export const DEFAULT_GMAIL_MIRROR =
  (process.env.EMAIL_GMAIL_MIRROR || "eduardo.marques.arq@gmail.com")
    .trim()
    .toLowerCase();

export const DEFAULT_MAILBOXES = [
  {
    address: `eduardo@${DEFAULT_EMAIL_DOMAIN}`,
    displayName: "Eduardo Marques — Diretoria",
    department: "Diretoria",
    isShared: false,
  },
  {
    address: `contato@${DEFAULT_EMAIL_DOMAIN}`,
    displayName: "Contato & Novos Projetos",
    department: "Atendimento",
    isShared: true,
  },
  {
    address: `projetos@${DEFAULT_EMAIL_DOMAIN}`,
    displayName: "Coordenação de Projetos & BIM",
    department: "Projetos",
    isShared: true,
  },
  {
    address: `financeiro@${DEFAULT_EMAIL_DOMAIN}`,
    displayName: "Financeiro & Faturamento Pix",
    department: "Financeiro",
    isShared: true,
  },
];

export async function ensureEmailBootstrap() {
  await prisma.emailDomainConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      domain: DEFAULT_EMAIL_DOMAIN,
      gmailMirrorAddress: DEFAULT_GMAIL_MIRROR,
      gmailMirrorEnabled: true,
      mailflareWorkerUrl: process.env.MAILFLARE_WORKER_URL || null,
      mailflareMcpUrl: process.env.MAILFLARE_MCP_URL || null,
    },
  });

  for (const mb of DEFAULT_MAILBOXES) {
    await prisma.emailMailbox.upsert({
      where: { address: mb.address },
      update: {},
      create: {
        address: mb.address,
        displayName: mb.displayName,
        department: mb.department,
        isShared: mb.isShared,
        isActive: true,
      },
    });
  }

  for (const day of [1, 2, 3, 4, 5]) {
    await prisma.bookingSlotConfig.upsert({
      where: { dayOfWeek: day },
      update: {},
      create: {
        dayOfWeek: day,
        isEnabled: true,
        startTime: "09:00",
        endTime: "18:00",
        slotMinutes: 45,
      },
    });
  }
}

export async function getAccessibleMailboxes(user: {
  id: string;
  role: string;
}) {
  await ensureEmailBootstrap();
  const all = await prisma.emailMailbox.findMany({
    where: { isActive: true },
    orderBy: { address: "asc" },
  });

  if (user.role === "ADMIN") return all;
  return all.filter((m) => m.allowedUserIds.includes(user.id));
}

export async function getMonthlyResendUsage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sentThisMonth = await prisma.emailMessage.count({
    where: {
      direction: "OUTBOUND",
      status: "SENT",
      sentAt: { gte: monthStart },
    },
  });
  return {
    sentThisMonth,
    monthlyLimit: 3000,
    remaining: Math.max(0, 3000 - sentThisMonth),
  };
}

export async function sendEmailViaResendApi(params: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada no servidor.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      ...(params.cc && params.cc.length > 0 ? { cc: params.cc } : {}),
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!res.ok || !data.id) {
    throw new Error(
      data?.message || `Falha no envio via Resend API (HTTP ${res.status})`
    );
  }
  return { id: data.id };
}

export async function syncEmailInfrastructureApis(options?: {
  domain?: string;
  gmailMirrorAddress?: string;
  gmailMirrorEnabled?: boolean;
  mailflareWorkerUrl?: string | null;
  mailflareMcpUrl?: string | null;
}) {
  await ensureEmailBootstrap();
  const current = await prisma.emailDomainConfig.findUnique({
    where: { id: "default" },
  });

  const domain = (options?.domain || current?.domain || DEFAULT_EMAIL_DOMAIN)
    .trim()
    .toLowerCase();
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const cfToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CF_TOKEN?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  const diagnostics: {
    cloudflareConnected: boolean;
    resendConnected: boolean;
    mailflareConnected: boolean;
    zoneId: string | null;
    resendDomainId: string | null;
    mxVerified: boolean;
    spfVerified: boolean;
    dkimVerified: boolean;
    dmarcVerified: boolean;
    warnings: string[];
    dnsActions: Array<{ type: string; name: string; action: string }>;
  } = {
    cloudflareConnected: false,
    resendConnected: false,
    mailflareConnected: false,
    zoneId: current?.cloudflareZoneId || null,
    resendDomainId: current?.resendDomainId || null,
    mxVerified: current?.mxVerified || false,
    spfVerified: current?.spfVerified || false,
    dkimVerified: current?.dkimVerified || false,
    dmarcVerified: current?.dmarcVerified || false,
    warnings: [],
    dnsActions: [],
  };

  // 1. Check Cloudflare API & Zone
  if (cfAccountId && cfToken) {
    try {
      const verifyRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/tokens/verify`,
        { headers: { Authorization: `Bearer ${cfToken}` } }
      );
      if (verifyRes.ok) {
        diagnostics.cloudflareConnected = true;
      }

      const zonesRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`,
        { headers: { Authorization: `Bearer ${cfToken}` } }
      );
      const zonesData = (await zonesRes.json().catch(() => ({}))) as {
        result?: Array<{ id: string; name: string; status: string }>;
      };
      const zone = zonesData.result?.[0];
      if (zone) {
        diagnostics.zoneId = zone.id;
        const dnsRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?per_page=200`,
          { headers: { Authorization: `Bearer ${cfToken}` } }
        );
        const dnsData = (await dnsRes.json().catch(() => ({}))) as {
          result?: Array<{
            id: string;
            type: string;
            name: string;
            content: string;
            priority?: number;
          }>;
        };
        const records = dnsData.result || [];
        diagnostics.mxVerified = records.some((r) => r.type === "MX");
        diagnostics.spfVerified = records.some(
          (r) => r.type === "TXT" && r.content.includes("v=spf1")
        );
        diagnostics.dkimVerified = records.some(
          (r) =>
            (r.type === "TXT" || r.type === "CNAME") &&
            r.name.toLowerCase().includes("_domainkey")
        );
        diagnostics.dmarcVerified = records.some(
          (r) =>
            r.type === "TXT" &&
            r.name.toLowerCase().startsWith("_dmarc") &&
            r.content.includes("v=DMARC1")
        );
      } else {
        diagnostics.warnings.push(
          `Zona '${domain}' ainda não encontrada nesta conta Cloudflare. Adicione o domínio no painel Cloudflare para liberar DNS & Email Routing automático.`
        );
      }
    } catch (err) {
      diagnostics.warnings.push(
        `Cloudflare API: ${err instanceof Error ? err.message : "Erro ao consultar"}`
      );
    }
  } else {
    diagnostics.warnings.push(
      "CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN ausente no ambiente."
    );
  }

  // 2. Check / Register Resend Domain
  if (resendKey) {
    try {
      const listRes = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      if (listRes.ok) {
        diagnostics.resendConnected = true;
        const listData = (await listRes.json().catch(() => ({}))) as {
          data?: Array<{ id: string; name: string; status: string }>;
        };
        let target = (listData.data || []).find(
          (d) => d.name.toLowerCase() === domain
        );
        if (!target) {
          const createRes = await fetch("https://api.resend.com/domains", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: domain, region: "sa-east-1" }),
          });
          if (createRes.ok) {
            target = (await createRes.json()) as {
              id: string;
              name: string;
              status: string;
            };
          }
        }
        if (target) {
          diagnostics.resendDomainId = target.id;
          if (target.status === "verified") {
            diagnostics.spfVerified = true;
            diagnostics.dkimVerified = true;
          }
        }
      }
    } catch (err) {
      diagnostics.warnings.push(
        `Resend API: ${err instanceof Error ? err.message : "Erro ao consultar"}`
      );
    }
  } else {
    diagnostics.warnings.push("RESEND_API_KEY ausente no ambiente.");
  }

  // 3. Check Mailflare Worker health
  const workerUrl =
    options?.mailflareWorkerUrl ??
    current?.mailflareWorkerUrl ??
    process.env.MAILFLARE_WORKER_URL ??
    null;
  const mcpUrl =
    options?.mailflareMcpUrl ??
    current?.mailflareMcpUrl ??
    (workerUrl ? `${workerUrl.replace(/\/$/, "")}/api/mcp` : null);

  if (workerUrl) {
    try {
      const ping = await fetch(workerUrl, { method: "HEAD" });
      diagnostics.mailflareConnected = ping.status < 500;
    } catch {
      diagnostics.mailflareConnected = false;
    }
  }

  const updated = await prisma.emailDomainConfig.update({
    where: { id: "default" },
    data: {
      domain,
      cloudflareZoneId: diagnostics.zoneId,
      resendDomainId: diagnostics.resendDomainId,
      mailflareWorkerUrl: workerUrl,
      mailflareMcpUrl: mcpUrl,
      gmailMirrorAddress:
        options?.gmailMirrorAddress ?? current?.gmailMirrorAddress ?? DEFAULT_GMAIL_MIRROR,
      gmailMirrorEnabled:
        options?.gmailMirrorEnabled ?? current?.gmailMirrorEnabled ?? true,
      mxVerified: diagnostics.mxVerified,
      spfVerified: diagnostics.spfVerified,
      dkimVerified: diagnostics.dkimVerified,
      dmarcVerified: diagnostics.dmarcVerified,
      lastSyncAt: new Date(),
      lastSyncSummary: diagnostics,
    },
  });

  return { config: updated, diagnostics };
}
