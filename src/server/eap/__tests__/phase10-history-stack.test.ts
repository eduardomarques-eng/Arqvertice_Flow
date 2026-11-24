import { describe, expect, it } from "vitest";
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/lib/history-stack";

describe("EAP Fase 4 — Pilha de Desfazer/Refazer (History Stack)", () => {
  it("empilha snapshots, desfaz, refaz e descarta o futuro após nova edição", () => {
    let stack = createHistoryState<number>();
    expect(stack.past).toHaveLength(0);
    expect(stack.future).toHaveLength(0);

    // Simula edições 0 -> 1 -> 2 -> 3
    stack = pushHistory(stack, 0);
    stack = pushHistory(stack, 1);
    stack = pushHistory(stack, 2);

    const u1 = undoHistory(stack, 3);
    expect(u1.restored).toBe(2);
    stack = u1.state;

    const u2 = undoHistory(stack, 2);
    expect(u2.restored).toBe(1);
    stack = u2.state;

    const r1 = redoHistory(stack, 1);
    expect(r1.restored).toBe(2);
    stack = r1.state;

    // Nova edição a partir de 2 deve limpar a pilha future ([3])
    stack = pushHistory(stack, 2);
    expect(stack.future).toHaveLength(0);
    const rEmpty = redoHistory(stack, 99);
    expect(rEmpty.restored).toBeNull();
  });

  it("respeita o limite máximo de histórico configurado", () => {
    let stack = createHistoryState<number>();
    for (let i = 0; i < 15; i++) {
      stack = pushHistory(stack, i, 5);
    }
    expect(stack.past).toEqual([10, 11, 12, 13, 14]);
  });
});
