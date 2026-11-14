import { NextResponse } from "next/server";
import { signIn } from "@/server/auth";
import { createRequestContext, logError } from "@/server/observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/server/errors";

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido.", requestId },
        { status: 400, headers: { "X-Request-Id": requestId } },
      );
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Informe o e-mail e a senha para entrar.", requestId },
        { status: 400, headers: { "X-Request-Id": requestId } },
      );
    }

    // Limita tentativas por IP e por e-mail com folga para uso legítimo.
    const limit = checkRateLimit(`login:${ip}:${email}`, { limit: 25, windowMs: 5 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas de acesso. Tente novamente em alguns minutos.", requestId },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "X-Request-Id": requestId } },
      );
    }

    return NextResponse.json(
      { user: await signIn(email, password) },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (error) {
    logError("login_failed", error, { requestId });
    const message = error instanceof DomainError ? error.message : "E-mail ou senha inválidos.";
    const status = error instanceof DomainError && error.code === "INTEGRITY" ? 403 : 401;
    return NextResponse.json(
      { error: message, requestId },
      { status, headers: { "X-Request-Id": requestId } },
    );
  }
}
