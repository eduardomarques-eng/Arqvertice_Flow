import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  requireRole: vi.fn(),
  sendEmail: vi.fn().mockResolvedValue({ ok: true, configured: true }),
  sendTransactionalEmail: vi.fn().mockResolvedValue({ ok: true, configured: true, provider: "resend", externalId: "re_1" }),
  sendEmailViaResendApi: vi.fn().mockResolvedValue({ id: "re_direct" }),
  getAccessibleMailboxes: vi.fn(),
  ensureEmailBootstrap: vi.fn().mockResolvedValue(undefined),
  ensureWhatsAppBootstrapForUser: vi.fn(),
  prisma: {
    whatsAppUserSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    whatsAppGatewayConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    whatsAppConversation: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    whatsAppMessage: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    acervoRevision: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    acervoRfiMarkup: {
      count: vi.fn(),
      create: vi.fn(),
    },
    communicationLog: {
      create: vi.fn(),
    },
    emailThread: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailMessage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    client: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    acervoGrd: {
      count: vi.fn(),
      create: vi.fn(),
    },
    bookingSlotConfig: {
      findUnique: vi.fn(),
    },
    clientBooking: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/auth", () => ({
  currentUser: mocks.currentUser,
  requireRole: mocks.requireRole,
  canUserAccessProject: vi.fn().mockResolvedValue(true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/email-service", () => ({
  sendEmail: mocks.sendEmail,
  appUrl: () => "https://arqvertice-os.vercel.app",
  escapeHtml: (v: string) =>
    v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!),
}));
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...actual,
    sendTransactionalEmail: mocks.sendTransactionalEmail,
  };
});
vi.mock("@/lib/email/email-infra", () => ({
  getAccessibleMailboxes: mocks.getAccessibleMailboxes,
  sendEmailViaResendApi: mocks.sendEmailViaResendApi,
  ensureEmailBootstrap: mocks.ensureEmailBootstrap,
}));
vi.mock("@/lib/whatsapp/multi-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whatsapp/multi-session")>();
  return {
    ...actual,
    ensureWhatsAppBootstrapForUser: mocks.ensureWhatsAppBootstrapForUser,
  };
});

import { POST as whatsappWebhookPost } from "@/app/api/whatsapp/webhook/route";
import { validateGatewayUrl, verifyWhatsAppWebhookAuth } from "@/lib/whatsapp/gateway-client";
import { POST as whatsappSessionPost } from "@/app/api/whatsapp/session/route";
import { POST as whatsappSendPost } from "@/app/api/whatsapp/send/route";
import { buildArqVerticeEmailTemplate, sanitizeEmailHtml } from "@/lib/email/resend-service";
import { POST as emailSendPost } from "@/app/api/email/send/route";
import { dispatchCommunicationAction } from "@/server/actions/team";
import { createAcervoGrd } from "@/server/services/acervo-cde-service";
import { POST as bookingPost } from "@/app/api/booking/route";

describe("Bloco C — Hardening & Gatilhos de WhatsApp e E-mail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WA_AKG_WEBHOOK_SECRET;
    delete process.env.WA_AKG_API_KEY;
    delete process.env.WA_AKG_GATEWAY_URL;
    delete process.env.WA_AKG_URL;
  });

  describe("Frente 1 — WhatsApp Webhook Fail-Closed, Anti-Replay & SSRF", () => {
    it("recusa 401 (fail-closed) quando WA_AKG_WEBHOOK_SECRET está ausente ou inválido", async () => {
      const req = new Request("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": "qualquer" },
        body: JSON.stringify({ sessionId: "s1", event: "connected" }),
      });

      const res = await whatsappWebhookPost(req);
      expect(res.status).toBe(401);

      process.env.WA_AKG_WEBHOOK_SECRET = "super-secret-token";
      const badReq = new Request("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": "wrong-secret" },
        body: JSON.stringify({ sessionId: "s1", event: "connected" }),
      });
      const res2 = await whatsappWebhookPost(badReq);
      expect(res2.status).toBe(401);
    });

    it("valida assinatura HMAC-SHA256 e bloqueia replay fora da janela de 5 min", () => {
      const secret = "hmac-test-secret-1234";
      const rawBody = JSON.stringify({ sessionId: "wa_1", event: "connected" });
      const now = 1_750_000_000_000;
      const freshTs = String(now - 30_000);
      const freshHmac = createHmac("sha256", secret)
        .update(`${freshTs}.${rawBody}`, "utf8")
        .digest("hex");

      const okAuth = verifyWhatsAppWebhookAuth({
        rawBody,
        secret,
        nowMs: now,
        headers: new Headers({
          "x-webhook-timestamp": freshTs,
          "x-arqvertice-signature": `sha256=${freshHmac}`,
        }),
      });
      expect(okAuth.ok).toBe(true);

      const staleTs = String(now - 6 * 60 * 1000);
      const staleHmac = createHmac("sha256", secret)
        .update(`${staleTs}.${rawBody}`, "utf8")
        .digest("hex");
      const replayAuth = verifyWhatsAppWebhookAuth({
        rawBody,
        secret,
        nowMs: now,
        headers: new Headers({
          "x-webhook-timestamp": staleTs,
          "x-arqvertice-signature": `sha256=${staleHmac}`,
        }),
      });
      expect(replayAuth.ok).toBe(false);
    });

    it("bloqueia SSRF em validateGatewayUrl e na rota update_gateway (exige ADMIN + HTTPS)", async () => {
      expect(validateGatewayUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
      expect(validateGatewayUrl("https://10.0.0.1:3005").ok).toBe(false);
      expect(validateGatewayUrl("https://192.168.1.50:3005").ok).toBe(false);
      expect(validateGatewayUrl("https://172.16.0.10:3005").ok).toBe(false);
      expect(validateGatewayUrl("http://localhost:3005", { isProd: true }).ok).toBe(false);
      expect(validateGatewayUrl("http://localhost:3005", { isProd: false }).ok).toBe(true);
      expect(validateGatewayUrl("https://my-tunnel.trycloudflare.com", { isProd: true }).ok).toBe(true);

      // Tentativa sem sessão ADMIN usando apenas header x-webhook-secret deve dar 401
      mocks.currentUser.mockResolvedValueOnce(null);
      process.env.WA_AKG_WEBHOOK_SECRET = "secret";
      const unauthRes = await whatsappSessionPost(
        new Request("http://localhost/api/whatsapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-secret": "secret" },
          body: JSON.stringify({ action: "update_gateway", gatewayUrl: "https://ok.trycloudflare.com" }),
        })
      );
      expect(unauthRes.status).toBe(401);

      // ADMIN tentando salvar URL SSRF deve receber 400
      mocks.currentUser.mockResolvedValueOnce({ id: "u-admin", name: "Eduardo", role: "ADMIN" });
      mocks.ensureWhatsAppBootstrapForUser.mockResolvedValueOnce({
        id: "s-admin",
        userId: "u-admin",
        sessionName: "wa_admin",
        connectionStatus: "DISCONNECTED",
      });
      mocks.prisma.whatsAppGatewayConfig.findUnique.mockResolvedValueOnce(null);

      const ssrfRes = await whatsappSessionPost(
        new Request("http://localhost/api/whatsapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_gateway", gatewayUrl: "http://169.254.169.254/" }),
        })
      );
      expect(ssrfRes.status).toBe(400);
    });

    it("retorna 503 GATEWAY_OFFLINE em vez de fabricar QR sintético quando gateway está offline", async () => {
      mocks.currentUser.mockResolvedValueOnce({ id: "u-admin", name: "Eduardo", role: "ADMIN" });
      mocks.ensureWhatsAppBootstrapForUser.mockResolvedValueOnce({
        id: "s-admin",
        userId: "u-admin",
        sessionName: "wa_admin",
        connectionStatus: "DISCONNECTED",
        connectedPhone: null,
      });
      mocks.prisma.whatsAppGatewayConfig.findUnique.mockResolvedValueOnce({
        id: "default",
        gatewayUrl: null,
      });

      const res = await whatsappSessionPost(
        new Request("http://localhost/api/whatsapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        })
      );
      const data = await res.json();
      expect(res.status).toBe(503);
      expect(data.status).toBe("GATEWAY_OFFLINE");
      expect(mocks.prisma.whatsAppUserSession.update).not.toHaveBeenCalled();
    });

    it("cria registro real de AcervoRfiMarkup no fluxo convert_to_rfi", async () => {
      mocks.currentUser.mockResolvedValueOnce({ id: "u-eng", name: "Eng. Luan", role: "ENGENHEIRO" });
      mocks.prisma.whatsAppConversation.findUnique.mockResolvedValueOnce({
        id: "conv-1",
        ownerUserId: "u-eng",
        clientId: "cli-1",
        projectId: "proj-1",
        contactName: "Pedro",
        contactPhone: "5585999990000",
      });
      mocks.prisma.acervoRevision.findFirst.mockResolvedValueOnce({
        id: "rev-1",
        documentId: "doc-1",
        document: { id: "doc-1", projectId: "proj-1", code: "EST-01" },
      });
      mocks.prisma.acervoRfiMarkup.count.mockResolvedValueOnce(2);
      mocks.prisma.acervoRfiMarkup.create.mockResolvedValueOnce({
        id: "rfi-3",
        code: "RFI-003",
        documentId: "doc-1",
        revisionId: "rev-1",
      });
      mocks.prisma.communicationLog.create.mockResolvedValueOnce({ id: "log-1" });

      const res = await whatsappSendPost(
        new Request("http://localhost/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "convert_to_rfi",
            conversationId: "conv-1",
            text: "Confirmar altura da viga V12 sobre a varanda.",
          }),
        })
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.rfi.code).toBe("RFI-003");
      expect(mocks.prisma.acervoRfiMarkup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "RFI-003",
            documentId: "doc-1",
            revisionId: "rev-1",
            status: "ABERTA",
          }),
        })
      );
      expect(mocks.prisma.communicationLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("Frente 2 — E-mail RBAC, Anti-XSS/BOLA e Gatilhos Reais", () => {
    it("escapa HTML malicioso (<script>) em buildArqVerticeEmailTemplate e sanitiza bodyHtml", () => {
      const rendered = buildArqVerticeEmailTemplate({
        recipientName: 'João <script>alert("xss")</script>',
        category: 'Financeiro <img src=x onerror=alert(1)>',
        projectName: "Obra <script>hack()</script>",
        messageBody: "Linha 1\n<script>fetch('evil')</script>",
      });
      expect(rendered).not.toContain("<script>");
      expect(rendered).not.toContain("<img src=x");
      expect(rendered).toContain("&lt;script&gt;");

      const sanitized = sanitizeEmailHtml(
        '<p>Olá</p><script>evil()</script><scr<script>ipt>evil2()</script><img/src=x/onerror=alert(1)><a href="javascript:alert(1)" onclick="steal()">Link</a>'
      );
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("onerror");
      expect(sanitized).not.toContain("onclick");
      expect(sanitized).not.toContain("javascript:");
    });

    it("bloqueia dispatchCommunicationAction quando usuário não é ADMIN (RBAC)", async () => {
      mocks.requireRole.mockRejectedValueOnce(new Error("Acesso negado"));
      await expect(
        dispatchCommunicationAction({
          recipientType: "CLIENTE",
          recipientName: "Pedro",
          recipientContact: "pedro@example.com",
          channel: "EMAIL",
          category: "AVISO_GERAL",
          messageBody: "Teste",
        })
      ).rejects.toThrow("Acesso negado");
    });

    it("bloqueia BOLA (403) em POST /api/email/send quando threadId não pertence às caixas acessíveis do usuário", async () => {
      mocks.currentUser.mockResolvedValueOnce({ id: "u-arq", name: "Ana", role: "ARQUITETO" });
      mocks.getAccessibleMailboxes.mockResolvedValueOnce([
        { id: "mb-arq", address: "projetos@arqvertice.com.br" },
      ]);
      mocks.prisma.emailThread.findUnique.mockResolvedValueOnce({
        id: "thread-financeiro",
        mailboxId: "mb-financeiro",
      });

      const res = await emailSendPost(
        new Request("http://localhost/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mailboxId: "mb-arq",
            threadId: "thread-financeiro",
            to: ["cliente@example.com"],
            subject: "Re: Confidencial",
            bodyText: "Tentativa indevida em caixa alheia",
          }),
        })
      );
      expect(res.status).toBe(403);
      expect(mocks.prisma.emailMessage.create).not.toHaveBeenCalled();
    });

    it("dispara e-mail automático ao emitir GRD do Acervo (createAcervoGrd) e ao confirmar agendamento (/api/booking)", async () => {
      // 1. GRD
      const mockGrdResult = {
        id: "grd-1",
        code: "GRD-2026-0001",
        projectId: "proj-1",
        recipientName: "Construtora Alfa",
        recipientEmail: "obra@alfa.com.br",
        items: [
          {
            documentCode: "ARQ-01",
            documentTitle: "Planta Baixa Térreo",
            revisionNumber: "R02",
            statusAtIssue: "BOM_PARA_OBRA",
            fileUrl: "https://cdn.example.com/ARQ-01-R02.pdf",
          },
        ],
        project: {
          id: "proj-1",
          name: "Residência de Praia",
          client: { id: "cli-1", name: "Pedro", phone: null },
        },
      };
      mocks.prisma.$transaction.mockResolvedValueOnce(mockGrdResult);
      mocks.prisma.whatsAppGatewayConfig.findUnique.mockResolvedValueOnce({
        id: "default",
        gatewayUrl: null,
        autoNotifyAcervo: false,
      });

      const grd = await createAcervoGrd({
        projectId: "proj-1",
        recipientName: "Construtora Alfa",
        recipientEmail: "obra@alfa.com.br",
        subject: "Remessa Executiva",
        revisionIds: ["rev-1"],
      });

      expect(grd.code).toBe("GRD-2026-0001");
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "obra@alfa.com.br",
          entityType: "AcervoGrd",
          entityId: "grd-1",
        })
      );

      // 2. Booking (/api/booking)
      vi.clearAllMocks();
      process.env.ADMIN_ALERT_EMAIL = "eduardo.marques.arq@gmail.com";
      mocks.prisma.bookingSlotConfig.findUnique.mockResolvedValueOnce({
        dayOfWeek: 4,
        isEnabled: true,
        startTime: "09:00",
        endTime: "18:00",
        slotMinutes: 45,
      });
      mocks.prisma.clientBooking.create.mockResolvedValueOnce({
        id: "book-1",
        clientName: "Pedro",
        clientEmail: "pedro@example.com",
        clientPhone: null,
        topic: "Alinhamento Estrutural",
        meetingType: "ONLINE",
        notes: null,
      });

      const bookRes = await bookingPost(
        new Request("http://localhost/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: "Pedro",
            clientEmail: "pedro@example.com",
            topic: "Alinhamento Estrutural",
            meetingType: "ONLINE",
            date: "2026-12-10",
            time: "14:00",
          }),
        })
      );
      expect(bookRes.status).toBe(200);
      expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "pedro@example.com", entityType: "ClientBooking" })
      );
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "eduardo.marques.arq@gmail.com", entityType: "ClientBooking" })
      );
    });
  });
});
