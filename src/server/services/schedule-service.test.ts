import { describe, expect, it } from "vitest";
import { columnFor, KANBAN_COLUMNS, type KanbanColumnId } from "./schedule-service";

const AGORA = new Date("2026-10-10T00:00:00.000Z");
const ONTEM = new Date("2026-10-05T00:00:00.000Z");
const AMANHA = new Date("2026-10-15T00:00:00.000Z");

describe("colunas do quadro", () => {
  it("classifica pela percentagem quando não há prazo", () => {
    expect(columnFor({ status: "NOT_STARTED", completion: 0, dueDate: null }, AGORA)).toBe("NOT_STARTED");
    expect(columnFor({ status: "IN_PROGRESS", completion: 50, dueDate: null }, AGORA)).toBe("IN_PROGRESS");
    expect(columnFor({ status: "COMPLETED", completion: 100, dueDate: null }, AGORA)).toBe("COMPLETED");
  });

  it("prazo vencido mantém a fase e sinaliza o alerta no card", () => {
    expect(columnFor({ status: "NOT_STARTED", completion: 0, dueDate: ONTEM }, AGORA)).toBe("NOT_STARTED");
    expect(columnFor({ status: "IN_PROGRESS", completion: 40, dueDate: ONTEM }, AGORA)).toBe("IN_PROGRESS");
  });

  it("prazo ainda no futuro nao marca como atrasada", () => {
    expect(columnFor({ status: "IN_PROGRESS", completion: 40, dueDate: AMANHA }, AGORA)).toBe("IN_PROGRESS");
  });

  it("usa os limites visuais de 0-5, 6-98 e 99-100", () => {
    expect(columnFor({ status: "IN_PROGRESS", completion: 5, dueDate: null }, AGORA)).toBe("NOT_STARTED");
    expect(columnFor({ status: "NOT_STARTED", completion: 6, dueDate: null }, AGORA)).toBe("IN_PROGRESS");
    expect(columnFor({ status: "IN_PROGRESS", completion: 98, dueDate: null }, AGORA)).toBe("IN_PROGRESS");
    expect(columnFor({ status: "IN_PROGRESS", completion: 99, dueDate: null }, AGORA)).toBe("COMPLETED");
  });

  it("etapa concluída permanece concluída, mesmo com prazo antigo", () => {
    expect(columnFor({ status: "COMPLETED", completion: 100, dueDate: ONTEM }, AGORA)).toBe("COMPLETED");
  });

  it("todas as colunas são estados que o modelo conhece", () => {
    const ids = KANBAN_COLUMNS.map((column) => column.id);
    expect(ids).toEqual(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED"]);
    const doModelo: KanbanColumnId[] = ["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED"];
    expect(ids).toEqual(doModelo);
  });
});