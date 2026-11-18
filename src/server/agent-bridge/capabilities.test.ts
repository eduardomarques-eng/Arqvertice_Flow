import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetStudioSettings } = vi.hoisted(() => ({
  mockPrisma: {
    agentActionLog: {
      create: vi.fn(),
    },
    project: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    client: {
      count: vi.fn(),
    },
    projectInstallment: {
      aggregate: vi.fn(),
    },
    acervoRfiMarkup: {
      count: vi.fn(),
    },
    emailThread: {
      count: vi.fn(),
    },
    whatsAppUserSession: {
      count: vi.fn(),
    },
  },
  mockGetStudioSettings: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/server/services/settings-service", () => ({
  getStudioSettings: mockGetStudioSettings,
}));

vi.mock("@/lib/email/email-infra", () => ({
  sendEmailViaResendApi: vi.fn(),
  ensureEmailBootstrap: vi.fn(),
}));

import { isValidAgentKey } from "@/server/agent-bridge/auth";
import { executeAgentAction, getAgentManifest } from "@/server/agent-bridge/capabilities";

describe("agent-bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.agentActionLog.create.mockResolvedValue({ id: "log_1" });
    mockPrisma.project.count.mockResolvedValue(4);
    mockPrisma.client.count.mockResolvedValue(8);
    mockPrisma.projectInstallment.aggregate.mockResolvedValue({
      _count: 2,
      _sum: { amount: 15000 },
    });
    mockPrisma.acervoRfiMarkup.count.mockResolvedValue(1);
    mockPrisma.emailThread.count.mockResolvedValue(3);
    mockPrisma.whatsAppUserSession.count.mockResolvedValue(1);
    mockGetStudioSettings.mockResolvedValue({
      studioName: "ArqVértice Studio",
      pixKeyType: "CPF",
      pixKey: "021.502.003-09",
    });
  });

  it("expõe o manifesto completo com ações por módulo", () => {
    const manifest = getAgentManifest();
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.authHeader).toBe("x-agent-key");

    const actionNames = manifest.capabilities.map((a) => a.name);
    expect(actionNames).toContain("system.overview");
    expect(actionNames).toContain("projects.list");
    expect(actionNames).toContain("finance.markInstallmentPaid");
    expect(actionNames).toContain("whatsapp.sendMessage");
  });

  it("valida x-agent-key em tempo constante contra OPENBOT_AGENT_KEY", () => {
    const previous = process.env.OPENBOT_AGENT_KEY;
    process.env.OPENBOT_AGENT_KEY = "test-secret-agent-key-123";

    expect(isValidAgentKey("test-secret-agent-key-123")).toBe(true);
    expect(isValidAgentKey("  test-secret-agent-key-123  ")).toBe(true);
    expect(isValidAgentKey("wrong-secret-agent-key-12")).toBe(false);
    expect(isValidAgentKey("short")).toBe(false);
    expect(isValidAgentKey(null)).toBe(false);

    process.env.OPENBOT_AGENT_KEY = previous;
  });

  it("lança erro explícito para ação inexistente", async () => {
    await expect(
      executeAgentAction({
        action: "unknown.action",
        source: "OPENBOT",
      })
    ).rejects.toThrow("Ação desconhecida");
  });

  it("suporta dryRun sem executar mutação destrutiva", async () => {
    const res = await executeAgentAction({
      action: "finance.markInstallmentPaid",
      params: {
        projectId: "22222222-2222-4222-8222-222222222222",
        installmentId: "11111111-1111-4111-8111-111111111111",
      },
      dryRun: true,
      source: "OPENBOT",
    });

    expect(res.ok).toBe(true);
    expect(res.dryRun).toBe(true);
  });

  it("exige confirmationToken CONFIRMED para finance.markInstallmentPaid", async () => {
    const res = await executeAgentAction({
      action: "finance.markInstallmentPaid",
      params: {
        projectId: "22222222-2222-4222-8222-222222222222",
        installmentId: "11111111-1111-4111-8111-111111111111",
      },
      source: "OPENBOT",
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe("PENDING_CONFIRMATION");
    expect(mockPrisma.agentActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionName: "finance.markInstallmentPaid",
          status: "PENDING_CONFIRMATION",
        }),
      })
    );
  });

  it("executa system.overview e grava log SUCCESS", async () => {
    const res = await executeAgentAction({
      action: "system.overview",
      source: "OLLAMA_LOCAL",
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe("SUCCESS");
    expect(res.data).toEqual({
      studioName: "ArqVértice Studio",
      officialPixKey: "CPF: 021.502.003-09",
      projectsCount: 4,
      clientsCount: 8,
      pendingInstallmentsCount: 2,
      pendingInstallmentsTotal: 15000,
      openRfis: 1,
      unreadEmails: 3,
      whatsappSessionsOnline: 1,
    });
    expect(mockPrisma.agentActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionName: "system.overview",
          status: "SUCCESS",
          source: "OLLAMA_LOCAL",
        }),
      })
    );
  });
});
