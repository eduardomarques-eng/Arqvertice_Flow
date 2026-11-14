import { prisma } from "@/server/db";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Esquema para validar o header Idempotency-Key (opcional, mas recomendado) */
export const IdempotencyKeySchema = z
  .string()
  .min(8, "Idempotency-Key deve ter no mínimo 8 caracteres")
  .max(128, "Idempotency-Key deve ter no máximo 128 caracteres")
  .regex(/^[A-Za-z0-9_\-.]+$/, "Idempotency-Key contém caracteres inválidos");

export type IdempotencyKey = string;

/** Registro interno para idempotência (não depende do cliente) */
export type IdempotencyRecord = {
  id: string;
  key: string;
  route: string;
  method: string;
  payloadHash: string;
  responseJson: unknown;
  statusCode: number;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
};

/** Valida e recupera um registro de idempotência. Se o registro existir e não tiver sido consumido, retorna a resposta original. */
export async function getCachedResponse(
  key: string,
  route: string,
  method: string,
  payloadHash: string
): Promise<{ record: IdempotencyRecord; response: Response } | null> {
  const record = await prisma.idempotencyRecord.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      route: true,
      method: true,
      payloadHash: true,
      responseJson: true,
      statusCode: true,
      createdAt: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  if (!record) return null;

  if (record.route !== route || record.method !== method || record.payloadHash !== payloadHash) {
    return null;
  }

  if (record.consumedAt) {
    return null;
  }

  // Verifica se o registro expirou
  if (new Date(record.expiresAt) < new Date()) {
    await prisma.idempotencyRecord.delete({ where: { key } });
    return null;
  }

  const json = record.responseJson as Record<string, unknown>;
  return {
    record,
    response: new NextResponse(JSON.stringify(json), {
      status: record.statusCode,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

/** Marca o registro de idempotência como consumido */
export async function markAsConsumed(key: string): Promise<void> {
  await prisma.idempotencyRecord.update({
    where: { key },
    data: { consumedAt: new Date() },
  });
}

/** Cria um novo registro de idempotência e retorna a resposta a ser enviada */
export async function createIdempotencyRecord(
  key: string,
  route: string,
  method: string,
  payloadHash: string,
  response: Response
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.idempotencyRecord.create({
    data: {
      key,
      route,
      method,
      payloadHash,
      responseJson: await response.clone().json().catch(() => ({ message: "OK" })),
      statusCode: response.status,
      expiresAt,
    },
  });
}

/** Gera um payload hash para idempotência */
export function hashPayload(payload: unknown): string {
  const data = JSON.stringify(payload);
  const buf = new TextEncoder().encode(data);
  let hash = 0;
  for (let i = 0; i < buf.length; i++) {
    hash = ((hash << 5) - hash + buf[i]) | 0;
  }
  return `${Math.abs(hash)}.${Date.now().toString(36)}`;
}

/** Garante que o payload nao exceda o limite maximo de tamanho */
export async function validatePayloadSize(body: unknown, maxBytes = 10 * 1024 * 1024): Promise<void> {
  const serialized = JSON.stringify(body);
  const byteLength = new Blob([serialized]).size;
  if (byteLength > maxBytes) {
    throw new Error(`Payload excedeu o limite de ${maxBytes / 1024 / 1024}MB`);
  }
}

/**
 * Middleware de idempotência para Next.js App Router
 * Aplica validação do header Idempotency-Key nas rotas críticas de criação.
 */
export function withIdempotency(
  route: string,
  method: string,
  handler: (req: Request, key: string, payloadHash: string) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    const idempotencyKey = req.headers.get("Idempotency-Key");

    let payloadHash = "";
    if (idempotencyKey) {
      const validated = IdempotencyKeySchema.safeParse(idempotencyKey);
      if (!validated.success) {
        return NextResponse.json(
          { error: "Idempotency-Key inválido", details: validated.error.issues },
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      payloadHash = hashPayload(await req.json().catch(() => ({})));
      const cached = await getCachedResponse(validated.data, route, method, payloadHash);
      if (cached) {
        return cached.response;
      }
    }

    const response = await handler(req, idempotencyKey ?? "", payloadHash ?? "");

    if (idempotencyKey && (response.status >= 200 && response.status < 300)) {
      // SSTream/SSE não possuem body; ignoramos gravação de registros para esses tipos de resposta.
      if (response.status !== 200 || response.headers.get("Content-Type")?.includes("text/event-stream")) {
        return response;
      }
      try {
        const body = await response.clone().text();
        if (body) {
          const payloadHash = hashPayload({});
          await createIdempotencyRecord(idempotencyKey, route, method, payloadHash, new Response(body, {
            status: response.status,
            headers: response.headers,
          }));
        }
      } catch {
        // Ignora erros de leitura de body
      }
    }

    return response;
  };
}

/**
 * Hook de idempotência para Server Actions do Next.js
 */
import { useState, useEffect } from "react";

export function useIdempotencyKey(route: string, method: string): string {
  const [key, setKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`idempotency_${route}_${method}`);
      if (stored) return stored;
    }
    return "";
  });

  useEffect(() => {
    if (key && typeof window !== "undefined") {
      sessionStorage.setItem(`idempotency_${route}_${method}`, key);
    }
  }, [key, route, method]);

  return key;
}
