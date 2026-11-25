import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DomainError } from "@/server/errors";

export const uuidParamSchema = z.string().uuid("Identificador inválido.");

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export function handleEapRouteError(
  err: unknown,
  fallbackMessage: string,
  conflictMessage = "Registro duplicado neste projeto."
) {
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 401
        : err.code === "INTEGRITY"
          ? 403
          : 400;
    return jsonNoStore({ ok: false, error: err.message }, status);
  }

  if (err instanceof z.ZodError) {
    const firstIssue = err.issues[0]?.message || "Dados de entrada inválidos.";
    return jsonNoStore({ ok: false, error: firstIssue }, 400);
  }

  if (err instanceof SyntaxError) {
    return jsonNoStore({ ok: false, error: "Corpo JSON inválido." }, 400);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return jsonNoStore({ ok: false, error: conflictMessage }, 409);
    }
    if (err.code === "P2025") {
      return jsonNoStore({ ok: false, error: "Registro não encontrado." }, 404);
    }
    if (err.code === "P2023") {
      return jsonNoStore({ ok: false, error: "Identificador inválido." }, 400);
    }
  }

  console.error("[EAP Route Error]", err);
  return jsonNoStore({ ok: false, error: fallbackMessage }, 500);
}
