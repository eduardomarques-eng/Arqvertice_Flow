import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";
import { generateWhatsAppLink, sanitizePhoneNumber } from "@/lib/whatsapp";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function safeEqualStrings(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr, "utf8");
  const b = Buffer.from(bStr, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseTimestampMs(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return trimmed.length <= 10 ? num * 1000 : num;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Autenticação fail-closed do webhook WhatsApp com suporte a HMAC-SHA256 e janela anti-replay (5 min).
 */
export function verifyWhatsAppWebhookAuth(params: {
  rawBody: string;
  headers: Headers;
  secret?: string;
  nowMs?: number;
  parsedTimestamp?: string | null;
}): { ok: boolean; error?: string } {
  const expected = (params.secret ?? process.env.WA_AKG_WEBHOOK_SECRET ?? "").trim();
  if (!expected) {
    return { ok: false, error: "WA_AKG_WEBHOOK_SECRET não configurado (fail-closed)." };
  }

  const headerTs = params.headers.get("x-webhook-timestamp");
  const effectiveTsRaw = headerTs ?? params.parsedTimestamp ?? null;
  if (effectiveTsRaw) {
    const tsMs = parseTimestampMs(effectiveTsRaw);
    if (tsMs === null) {
      return { ok: false, error: "Timestamp de webhook inválido." };
    }
    const now = params.nowMs ?? Date.now();
    if (Math.abs(now - tsMs) > REPLAY_WINDOW_MS) {
      return { ok: false, error: "Timestamp de webhook expirado (anti-replay 5 min)." };
    }
  }

  const sigHeader =
    params.headers.get("x-arqvertice-signature") ||
    params.headers.get("x-hub-signature-256") ||
    "";

  if (sigHeader.trim()) {
    if (!effectiveTsRaw) {
      return { ok: false, error: "Timestamp obrigatório para assinatura HMAC." };
    }
    const providedHex = sigHeader.trim().replace(/^sha256=/i, "").toLowerCase();
    const signedPayload = `${effectiveTsRaw.trim()}.${params.rawBody}`;
    const expectedWithTs = createHmac("sha256", expected).update(signedPayload, "utf8").digest("hex");
    if (safeEqualStrings(providedHex, expectedWithTs)) {
      return { ok: true };
    }
    return { ok: false, error: "Assinatura HMAC inválida." };
  }

  const secretHeader = params.headers.get("x-webhook-secret")?.trim() || "";
  if (secretHeader && safeEqualStrings(secretHeader, expected)) {
    return { ok: true };
  }

  return { ok: false, error: "Webhook não autorizado." };
}

export type GatewayUrlValidationResult =
  | { ok: true; normalizedUrl: string }
  | { ok: false; error: string };

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
  "0.0.0.0",
]);

function isPrivateOrDisallowedHost(hostnameRaw: string, isProd: boolean): string | null {
  const host = hostnameRaw.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (!host) return "Host inválido na URL do gateway.";
  if (METADATA_HOSTS.has(host)) return "Host bloqueado por política anti-SSRF.";

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host.startsWith("127.")
  ) {
    return isProd || host.endsWith(".localhost")
      ? "Loopback não é permitido."
      : null;
  }

  // IPv4 private / link-local / zero / CGNAT ranges
  if (/^0\./.test(host)) return "Faixa 0.0.0.0/8 bloqueada (anti-SSRF).";
  if (/^10\./.test(host)) return "Faixa privada 10.0.0.0/8 bloqueada (anti-SSRF).";
  if (/^192\.168\./.test(host)) return "Faixa privada 192.168.0.0/16 bloqueada (anti-SSRF).";
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return "Faixa privada 172.16.0.0/12 bloqueada (anti-SSRF).";
  }
  if (/^169\.254\./.test(host)) return "Endereço link-local 169.254.0.0/16 bloqueado (anti-SSRF).";
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) {
    return "Faixa CGNAT 100.64.0.0/10 bloqueada (anti-SSRF).";
  }

  // IPv6 loopback, ULA (fc00::/7), link-local (fe80::/10), IPv4-mapped/compatible
  if (
    host.includes(":") &&
    (host === "::1" ||
      host === "::" ||
      /^f[cd][0-9a-f]{0,2}:/i.test(host) ||
      /^fe[89ab][0-9a-f]:/i.test(host) ||
      host.startsWith("::ffff:") ||
      host.startsWith("::"))
  ) {
    return "Endereço IPv6 privado/local bloqueado (anti-SSRF).";
  }

  if (host.endsWith(".internal") || host.endsWith(".local")) {
    return "Domínio interno bloqueado por política anti-SSRF.";
  }

  return null;
}

/**
 * Valida URL do gateway oficial WhatsApp (`wa-akg-service`) contra SSRF.
 * Produção exige `https:`; desenvolvimento permite `http://localhost` / `http://127.0.0.1`.
 */
export function validateGatewayUrl(
  rawUrl: string,
  options?: { isProd?: boolean }
): GatewayUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "URL do gateway vazia." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL do gateway malformada." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Credenciais embutidas na URL não são permitidas." };
  }

  const isProd = options?.isProd ?? process.env.NODE_ENV === "production";
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1";

  if (parsed.protocol !== "https:") {
    if (isProd || parsed.protocol !== "http:" || !isLoopback) {
      return {
        ok: false,
        error: isProd
          ? "Em produção o gateway WhatsApp deve usar protocolo HTTPS."
          : "Protocolo inválido. Use HTTPS ou http://localhost / http://127.0.0.1 em desenvolvimento.",
      };
    }
  }

  const blockedReason = isPrivateOrDisallowedHost(host, isProd);
  if (blockedReason) {
    return { ok: false, error: blockedReason };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  return {
    ok: true,
    normalizedUrl: `${parsed.origin}${cleanPath}`,
  };
}

export async function resolveOfficialGatewayConfig(): Promise<{
  gatewayUrl: string | null;
  apiKey: string;
  autoNotifyAcervo: boolean;
  autoNotifyFinance: boolean;
  autoNotifyBooking: boolean;
}> {
  const dbConfig = await prisma.whatsAppGatewayConfig
    .findUnique({ where: { id: "default" } })
    .catch(() => null);

  const rawUrl =
    dbConfig?.gatewayUrl?.trim() ||
    process.env.WA_AKG_GATEWAY_URL?.trim() ||
    process.env.WA_AKG_URL?.trim() ||
    "";

  const validated = rawUrl ? validateGatewayUrl(rawUrl) : null;
  const gatewayUrl = validated && validated.ok ? validated.normalizedUrl : null;

  return {
    gatewayUrl,
    apiKey: process.env.WA_AKG_API_KEY?.trim() || "",
    autoNotifyAcervo: dbConfig?.autoNotifyAcervo ?? true,
    autoNotifyFinance: dbConfig?.autoNotifyFinance ?? true,
    autoNotifyBooking: dbConfig?.autoNotifyBooking ?? true,
  };
}

export interface OfficialGatewaySendResult {
  ok: boolean;
  method: "WA_AKG_GATEWAY" | "WHATSAPP_DEEP_LINK";
  messageId?: string;
  deepLink: string;
  sessionName?: string;
  gatewayOffline: boolean;
  error?: string;
}

/**
 * Roteador único oficial de disparo ativo de WhatsApp via `wa-akg-service`.
 * Quando o gateway ou sessão conectada estiverem indisponíveis, retorna deepLink seguro.
 */
export async function sendViaOfficialGateway(params: {
  phone: string;
  message: string;
  sessionName?: string;
  delayMs?: number;
}): Promise<OfficialGatewaySendResult> {
  const digits = sanitizePhoneNumber(params.phone);
  const deepLink = generateWhatsAppLink(digits, params.message);

  const cfg = await resolveOfficialGatewayConfig();
  if (!cfg.gatewayUrl || !cfg.apiKey) {
    return {
      ok: false,
      method: "WHATSAPP_DEEP_LINK",
      deepLink,
      gatewayOffline: true,
      error: "Gateway WA-AKG offline ou credencial WA_AKG_API_KEY não configurada.",
    };
  }

  let targetSessionName = params.sessionName?.trim() || "";
  if (!targetSessionName) {
    const activeSession = await prisma.whatsAppUserSession
      .findFirst({
        where: { connectionStatus: "CONNECTED" },
        orderBy: [{ isStudioOfficial: "desc" }, { lastConnectedAt: "desc" }],
        select: { sessionName: true },
      })
      .catch(() => null);
    targetSessionName = activeSession?.sessionName || "";
  }

  if (!targetSessionName) {
    return {
      ok: false,
      method: "WHATSAPP_DEEP_LINK",
      deepLink,
      gatewayOffline: true,
      error: "Nenhuma sessão WhatsApp conectada no gateway oficial.",
    };
  }

  try {
    const res = await fetch(
      `${cfg.gatewayUrl}/sessions/${encodeURIComponent(targetSessionName)}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey,
        },
        body: JSON.stringify({
          to: digits,
          text: params.message.trim(),
          ...(typeof params.delayMs === "number" ? { delayMs: params.delayMs } : {}),
        }),
        signal: AbortSignal.timeout(4000),
        redirect: "error",
      }
    );

    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { messageId?: string | null };
      return {
        ok: true,
        method: "WA_AKG_GATEWAY",
        messageId: json.messageId || undefined,
        deepLink,
        sessionName: targetSessionName,
        gatewayOffline: false,
      };
    }

    return {
      ok: false,
      method: "WHATSAPP_DEEP_LINK",
      deepLink,
      sessionName: targetSessionName,
      gatewayOffline: res.status >= 500,
      error: `Gateway WA-AKG respondeu HTTP ${res.status}.`,
    };
  } catch (err) {
    return {
      ok: false,
      method: "WHATSAPP_DEEP_LINK",
      deepLink,
      sessionName: targetSessionName,
      gatewayOffline: true,
      error: err instanceof Error ? err.message : "Falha de comunicação com gateway WA-AKG.",
    };
  }
}
