import { describe, expect, it, vi } from "vitest";
import {
  calculateFinancialSummary,
  calculatePaidAmount,
  calculatePaidPercentage,
  calculatePendingAmount,
  calculateRemainingBalance,
  paymentStatusLabels,
  paymentStatuses,
} from "./finance";
import { parseCurrencyBRL } from "./formatters";

describe("calculateFinancialSummary", () => {
  it("calcula totais financeiros a partir dos pagamentos registrados", () => {
    const result = calculateFinancialSummary(1000, [
      { amount: 250, status: paymentStatuses.PAID },
      { amount: 300, status: paymentStatuses.PENDING },
      { amount: 450, status: paymentStatuses.AWAITING_COMPLETION },
    ]);

    expect(result).toMatchObject({
      contractedValue: 1000,
      totalInstallments: 1000,
      totalPaid: 250,
      totalPending: 750,
      remainingBalance: 750,
      paidPercentage: 25,
    });
  });

  it("preserva ausência de orçamento contratado", () => {
    expect(calculateFinancialSummary(null, [])).toMatchObject({
      contractedValue: null,
      remainingBalance: null,
      paidPercentage: null,
    });
  });

  it("rejeita valores inválidos", () => {
    expect(() => calculateFinancialSummary(-1, [])).toThrow("Valor financeiro inválido.");
  });

  it("expõe os cálculos financeiros centralizados", () => {
    const payments = [
      { amount: 250, status: paymentStatuses.PAID },
      { amount: 300, status: paymentStatuses.PENDING },
    ];
    expect(calculatePaidAmount(payments)).toBe(250);
    expect(calculatePendingAmount(payments)).toBe(300);
    expect(calculateRemainingBalance(1000, payments)).toBe(750);
    expect(calculatePaidPercentage(1000, payments)).toBe(25);
  });
});

describe("paymentStatusLabels", () => {
  it("traduz os estados para a apresentação", () => {
    expect(paymentStatusLabels[paymentStatuses.AWAITING_COMPLETION]).toBe("Aguardando conclusão");
  });
});

describe("parseCurrencyBRL", () => {
  it("converte strings BRL, decimais e números para centavos exatos", () => {
    expect(parseCurrencyBRL("R$ 2.440,00")).toBe(2440);
    expect(parseCurrencyBRL("2.440,50")).toBe(2440.5);
    expect(parseCurrencyBRL("2440.5")).toBe(2440.5);
    expect(parseCurrencyBRL("2.440")).toBe(2440);
    expect(parseCurrencyBRL(1234.567)).toBe(1234.57);
  });

  it("bloqueia entradas vazias, inválidas ou negativas", () => {
    expect(parseCurrencyBRL("")).toBeNull();
    expect(parseCurrencyBRL("   ")).toBeNull();
    expect(parseCurrencyBRL("abc")).toBeNull();
    expect(parseCurrencyBRL(-10)).toBeNull();
    expect(parseCurrencyBRL(Number.NaN)).toBeNull();
    expect(parseCurrencyBRL(undefined)).toBeNull();
  });

  it("recalcula KPIs financeiros imediatamente após edição de parcela", () => {
    const initial = [
      { amount: 1000, status: paymentStatuses.PAID },
      { amount: 2000, status: paymentStatuses.PENDING },
    ];
    const editedAmount = parseCurrencyBRL("R$ 2.440,50")!;
    const updated = [
      initial[0],
      { amount: editedAmount, status: paymentStatuses.PENDING },
    ];
    const summary = calculateFinancialSummary(3440.5, updated);
    expect(summary.totalInstallments).toBe(3440.5);
    expect(summary.totalPaid).toBe(1000);
    expect(summary.totalPending).toBe(2440.5);
  });
});

describe("updateProjectInstallment persistence", () => {
  it("persiste amount, description e status no Prisma update", async () => {
    const updateMock = vi.fn().mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      projectId: "22222222-2222-4222-8222-222222222222",
      description: "2ª Parcela Atualizada",
      amount: 2440.5,
      status: "PENDING",
      dueDate: new Date("2026-12-01T00:00:00.000Z"),
      version: 2,
    });

    vi.doMock("@/server/db", () => ({
      prisma: {
        projectInstallment: {
          findFirst: vi.fn().mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
            status: "PENDING",
            dueDate: new Date("2026-12-01T00:00:00.000Z"),
            paidDate: null,
            version: 1,
          }),
          findUnique: vi.fn().mockResolvedValue({
            version: 1,
            dueDate: new Date("2026-12-01T00:00:00.000Z"),
          }),
          update: updateMock,
        },
      },
    }));

    vi.doMock("@/lib/distributed-lock", () => ({
      withDistributedLock: async (_k: string, fn: () => Promise<unknown>) => fn(),
    }));

    const { updateProjectInstallment } = await import("@/server/services/installment-service");
    const saved = await updateProjectInstallment(
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
      {
        amount: 2440.5,
        description: "2ª Parcela Atualizada",
      }
    );

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 2440.5,
          description: "2ª Parcela Atualizada",
        }),
      })
    );
    expect(saved.amount).toBe(2440.5);
  });

  it("simula ciclo completo POST -> PATCH x2 (version++) -> GET mantendo consistência", async () => {
    const dbStore: Array<{
      id: string;
      projectId: string;
      description: string;
      amount: number;
      dueDate: Date;
      paidDate: Date | null;
      status: string;
      linkedStageId: string | null;
      order: number;
      version: number;
    }> = [];

    vi.resetModules();
    vi.doMock("@/server/db", () => ({
      prisma: {
        project: {
          findUnique: vi.fn().mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" }),
        },
        projectInstallment: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            const rec = {
              id: "11111111-1111-4111-8111-111111111111",
              projectId: String(data.projectId),
              description: String(data.description),
              amount: Number(data.amount),
              dueDate: new Date(String(data.dueDate)),
              paidDate: null,
              status: String(data.status || "PENDING"),
              linkedStageId: null,
              order: Number(data.order || 1),
              version: 1,
            };
            dbStore.push(rec);
            return rec;
          }),
          findFirst: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
            return dbStore.find((r) => r.id === where.id) ?? null;
          }),
          findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
            return dbStore.find((r) => r.id === where.id) ?? null;
          }),
          findMany: vi.fn().mockImplementation(async ({ where }: { where: { projectId: string } }) => {
            return dbStore.filter((r) => r.projectId === where.projectId);
          }),
          update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const idx = dbStore.findIndex((r) => r.id === where.id);
            const curr = dbStore[idx];
            const next = {
              ...curr,
              ...(data.amount !== undefined ? { amount: Number(data.amount) } : {}),
              ...(data.description !== undefined ? { description: String(data.description) } : {}),
              ...(data.status !== undefined ? { status: String(data.status) } : {}),
              version: curr.version + 1,
            };
            dbStore[idx] = next;
            return next;
          }),
        },
      },
    }));
    vi.doMock("@/lib/distributed-lock", () => ({
      withDistributedLock: async (_k: string, fn: () => Promise<unknown>) => fn(),
    }));

    const {
      createProjectInstallment,
      updateProjectInstallment,
      listProjectInstallments,
    } = await import("@/server/services/installment-service");

    const projectId = "22222222-2222-4222-8222-222222222222";
    const created = await createProjectInstallment({
      projectId,
      description: "1ª Parcela — Projeto",
      amount: 1500,
      dueDate: "2026-12-10",
      status: "PENDING",
      order: 1,
    });
    expect(created.version).toBe(1);

    const edit1 = await updateProjectInstallment(projectId, created.id, {
      amount: 2440.5,
      version: created.version,
    });
    expect(edit1.amount).toBe(2440.5);
    expect(edit1.version).toBe(2);

    const edit2 = await updateProjectInstallment(projectId, created.id, {
      amount: 3120.75,
      version: edit1.version,
    });
    expect(edit2.amount).toBe(3120.75);
    expect(edit2.version).toBe(3);

    const listed = await listProjectInstallments(projectId);
    expect(listed).toHaveLength(1);
    expect(listed[0].amount).toBe(3120.75);
    expect(listed[0].version).toBe(3);
  });
});
