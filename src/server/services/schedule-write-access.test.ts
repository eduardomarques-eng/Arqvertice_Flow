import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/server/errors";
import { createScheduleStage, updateScheduleStage, updateScheduleStageStatus } from "./schedule-service";

/**
 * Protecção de escrita do cronograma (regressão do IDOR corrigido em 0f59d07).
 *
 * O PAPEL (ADMIN/OPERADOR) é provado por `requireScheduleRole`; o PROJECTO é
 * provado por `requireScheduleWrite` contra `ProjectAccess`. Estes testes vivem
 * no ponto de escrita — o serviço — porque é aí que a garantia tem de existir:
 * a interface só desenha botões e a página filtra a leitura, mas qualquer
 * chamada directa ao serviço tem de passar pelas duas provas.
 *
 * `@/server/auth` e `@/server/db` são substituídos: sem sessão real nem base de
 * dados estes testes são determinísticos e correm em qualquer ambiente.
 */
const mocks = vi.hoisted(() => ({
  requireScheduleRole: vi.fn(),
  projectFindUnique: vi.fn(),
  stageFindUnique: vi.fn(),
  stageFindMany: vi.fn(),
  stageCreate: vi.fn(),
  stageUpdate: vi.fn(),
  accessFindUnique: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
  requireScheduleRole: () => mocks.requireScheduleRole(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    project: { findUnique: () => mocks.projectFindUnique() },
    scheduleStage: {
      findUnique: () => mocks.stageFindUnique(),
      findMany: () => mocks.stageFindMany(),
      create: (args: unknown) => mocks.stageCreate(args),
      update: (args: unknown) => mocks.stageUpdate(args),
    },
    projectAccess: { findUnique: (args: unknown) => mocks.accessFindUnique(args) },
    user: { findMany: () => mocks.userFindMany() },
  },
}));

const OPERADOR = { id: "00000000-0000-4000-8000-0000000000aa", role: "OPERADOR" };
const ADMIN = { id: "00000000-0000-4000-8000-0000000000ad", role: "ADMIN" };
const PROJECT_ID = "00000000-0000-4000-8000-0000000000bb";
const STAGE_ID = "00000000-0000-4000-8000-0000000000cc";

/** Etapa realista devolvida por `scheduleStage.findUnique` nos testes de estado. */
const stageRow = {
  id: STAGE_ID,
  projectId: PROJECT_ID,
  status: "NOT_STARTED" as const,
  completion: 0,
  dependency: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("escrita do cronograma exige acesso ao projecto (IDOR)", () => {
  it("OPERADOR sem atribuição não cria etapa, mesmo com projectId válido", async () => {
    mocks.requireScheduleRole.mockResolvedValue(OPERADOR);
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID });
    mocks.accessFindUnique.mockResolvedValue(null);

    await expect(
      createScheduleStage({ projectId: PROJECT_ID, name: "Etapa alheia", order: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Projeto não encontrado." });

    // O PROJECTO é provado antes de qualquer escrita.
    expect(mocks.accessFindUnique).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT_ID, userId: OPERADOR.id } },
      select: { id: true },
    });
    expect(mocks.stageCreate).not.toHaveBeenCalled();
  });

  it("OPERADOR sem atribuição não edita etapa de outro projecto", async () => {
    mocks.requireScheduleRole.mockResolvedValue(OPERADOR);
    mocks.stageFindUnique.mockResolvedValue({ projectId: PROJECT_ID });
    mocks.accessFindUnique.mockResolvedValue(null);

    await expect(updateScheduleStage(STAGE_ID, { name: "Hackeada" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Etapa não encontrado.",
    });
    expect(mocks.stageUpdate).not.toHaveBeenCalled();
  });

  it("OPERADOR sem atribuição não move o estado da etapa", async () => {
    mocks.requireScheduleRole.mockResolvedValue(OPERADOR);
    mocks.stageFindUnique.mockResolvedValue(stageRow);
    mocks.accessFindUnique.mockResolvedValue(null);

    await expect(updateScheduleStageStatus(STAGE_ID, "IN_PROGRESS")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Etapa não encontrado.",
    });
    expect(mocks.stageUpdate).not.toHaveBeenCalled();
  });

  it("a recusa é indistinguível de uma etapa inexistente", async () => {
    // Quem tem o PAPEL mas não o PROJECTO recebe exactamente a mesma resposta
    // de quem pediu um id que não existe: um id alheio não revela nada.
    mocks.requireScheduleRole.mockResolvedValue(OPERADOR);
    mocks.stageFindUnique.mockResolvedValue(null);
    const semExistencia = await updateScheduleStage(STAGE_ID, { name: "X" }).catch((e: unknown) => e);

    mocks.stageFindUnique.mockResolvedValue({ projectId: PROJECT_ID });
    mocks.accessFindUnique.mockResolvedValue(null);
    const semAcesso = await updateScheduleStage(STAGE_ID, { name: "X" }).catch((e: unknown) => e);

    expect(semExistencia).toBeInstanceOf(DomainError);
    expect(semAcesso).toBeInstanceOf(DomainError);
    expect((semAcesso as DomainError).message).toBe((semExistencia as DomainError).message);
    expect((semAcesso as DomainError).code).toBe((semExistencia as DomainError).code);
  });

  it("OPERADOR atribuído escreve nas etapas do projecto atribuído", async () => {
    mocks.requireScheduleRole.mockResolvedValue(OPERADOR);
    mocks.stageFindUnique.mockResolvedValue(stageRow);
    mocks.accessFindUnique.mockResolvedValue({ id: "00000000-0000-4000-8000-0000000000ee" });
    mocks.stageUpdate.mockResolvedValue({ ...stageRow, status: "IN_PROGRESS", completion: 1 });

    await expect(updateScheduleStageStatus(STAGE_ID, "IN_PROGRESS")).resolves.toMatchObject({
      status: "IN_PROGRESS",
    });
    expect(mocks.stageUpdate).toHaveBeenCalledTimes(1);
  });

  it("ADMIN escreve sem ProjectAccess — o dono não precisa de atribuição", async () => {
    mocks.requireScheduleRole.mockResolvedValue(ADMIN);
    mocks.stageFindUnique.mockResolvedValue(stageRow);
    mocks.stageUpdate.mockResolvedValue({ ...stageRow, status: "IN_PROGRESS", completion: 1 });

    await expect(updateScheduleStageStatus(STAGE_ID, "IN_PROGRESS")).resolves.toBeTruthy();
    // Bypass do dono: `ProjectAccess` nem é consultado para ADMIN.
    expect(mocks.accessFindUnique).not.toHaveBeenCalled();
    expect(mocks.stageUpdate).toHaveBeenCalledTimes(1);
  });
});
