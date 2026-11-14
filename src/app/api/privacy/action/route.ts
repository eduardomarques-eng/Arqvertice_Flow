import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { handleDataSubjectRight } from "@/server/services/privacy-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  const body = await request.json().catch(() => ({}));

  const subjectId = body.subjectId ?? null;
  const right = body.right;

  if (!subjectId || !right) {
    return NextResponse.json(
      { error: "subjectId e right são obrigatórios." },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Apenas ADMIN pode actuar sobre outro utilizador; o próprio utilizador pode
  // actuar sobre si próprio.
  if (user.role !== "ADMIN" && user.id !== subjectId) {
    return NextResponse.json(
      { error: "Acesso negado." },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    const result = await handleDataSubjectRight(right as any, user);
    return NextResponse.json(
      {
        ok: true,
        requestId,
        right,
        data: result.data ?? result.note ?? null,
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400, headers: { "X-Request-Id": requestId } },
      );
    }
    return NextResponse.json(
      { error: "Falha ao executar ação." },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}

function createRequestContext(request: Request) {
  return { requestId: request.headers.get("x-request-id") ?? cryptoRandom(12) };
}

function cryptoRandom(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i += 1) out += chars[buf[i] % chars.length];
  return out;
}
