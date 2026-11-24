import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleSignatureWebhookPayload } from "@/server/services/signature-service";
import { SIGNATURE_STATUS, type SignatureStatusName } from "@/lib/signature";
import { DomainError } from "@/server/errors";
import { createRequestContext, logError } from "@/server/observability";

export const dynamic = "force-dynamic";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isAuthorizedWebhook(request: Request, rawBody: string): boolean {
  const expected = (process.env.CONTRACT_WEBHOOK_SECRET || process.env.SIGNATURE_WEBHOOK_SECRET || "").trim();
  // Fail-closed: sem segredo configurado, recusa qualquer requisição.
  if (!expected) return false;

  const directSecret = request.headers.get("x-webhook-secret")?.trim();
  if (directSecret && safeCompare(directSecret, expected)) {
    return true;
  }

  const signatureHeader = request.headers.get("x-signature")?.trim();
  if (signatureHeader) {
    const computed = createHmac("sha256", expected).update(rawBody).digest("hex");
    const cleanHeader = signatureHeader.replace(/^sha256=/i, "");
    if (safeCompare(cleanHeader, computed)) {
      return true;
    }
  }

  return false;
}

function normalizeStatus(raw: unknown): SignatureStatusName | null {
  const value = typeof raw === "string" ? raw.toUpperCase() : "";
  const values = Object.values(SIGNATURE_STATUS) as SignatureStatusName[];
  return values.find((v) => v === value) ?? null;
}

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  try {
    const rawBody = await request.text();
    if (!isAuthorizedWebhook(request, rawBody)) {
      return NextResponse.json(
        { error: "Unauthorized: assinatura de webhook inválida ou segredo não configurado.", requestId },
        { status: 401, headers: { "X-Request-Id": requestId } },
      );
    }

    const payload = JSON.parse(rawBody) as {
      contractId?: string;
      externalId?: string;
      status?: unknown;
      evidence?: Record<string, unknown>;
    };

    const status = normalizeStatus(payload.status);
    if (!status) {
      return NextResponse.json(
        { error: "Status de assinatura inválido.", requestId },
        { status: 400, headers: { "X-Request-Id": requestId } },
      );
    }

    if (!payload.contractId && !payload.externalId) {
      return NextResponse.json(
        { error: "Informe contractId ou externalId.", requestId },
        { status: 400, headers: { "X-Request-Id": requestId } },
      );
    }

    const updated = await handleSignatureWebhookPayload({
      contractId: payload.contractId,
      externalId: payload.externalId,
      status,
      evidence: payload.evidence,
    });

    return NextResponse.json(
      { ok: true, signatureId: updated.id, status: updated.status, requestId },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message, requestId }, { status: 404, headers: { "X-Request-Id": requestId } });
    }
    logError("contract_webhook_failed", error, { requestId });
    return NextResponse.json(
      { error: "Falha ao processar webhook de assinatura.", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }
}
