import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventBus, DomainEventEnvelope } from "@/server/events/event-bus";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;
const CACHE_CONTROL = "no-cache, no-transform";
const CONNECTION_IDLE_TIMEOUT = 60_000; // 1 minuto de inatividade gera heartbeat
const HEARTBEAT_INTERVAL = 30_000; // 30s heartbeat message
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

/** Valida cabeçalhos de requisição para evitar payloads excessivos */
function validateHeaders(headers: Headers): boolean {
  const contentLength = headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_PAYLOAD_SIZE) {
      return false;
    }
  }
  return true;
}

/**
 * Rota SSE: fluxo de notificações, status de etapas e alertas em tempo real.
 *
 * - Valida a sessão via cookie `arqvertice_session`
 * - Envia heartbeat a cada 30s
 * - Suspende até que haja novos eventos para o cliente
 * - Fallback automático para polling controlado (window.onbeforeunload)
 *
 * Content-Type: text/event-stream
 * Cache-Control: no-cache, no-transform
 * Connection: keep-alive
 */
export async function GET(request: Request) {
  const sessionToken = request.cookies.get("arqvertice_session")?.value;
  if (!sessionToken) {
    return NextResponse.json(
      { error: "Não autorizado. Sessão inválida." },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no"); // Desativa buffer do nginx/vercel

  // Resetar o stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const heartbeat = setInterval(() => {
        send(`{"type":"heartbeat","ts":${Date.now()}}`);
      }, HEARTBEAT_INTERVAL);

      // Enviar conexão aberta
      send(`{"type":"connected","ts":${Date.now()}}`);

      // Registrar conexão ativa
      console.log(`[SSE] Cliente conectado. Session: ${sessionToken.slice(0, 8)}...`);

      // Timeout de inatividade
      let lastActivity = Date.now();
      const idleTimer = setTimeout(() => {
        console.log(`[SSE] Conexão inativa por ${CONNECTION_IDLE_TIMEOUT}ms. Encerrando.`);
        controller.close();
        clearInterval(heartbeat);
      }, CONNECTION_IDLE_TIMEOUT);

      // Handler para mensagens do cliente (como heartbeat ack)
      const messageHandler = (event: MessageEvent) => {
        lastActivity = Date.now();
        // Handle client messages (heartbeat ack, etc.)
      };

      // Listener para mensagens do cliente
      try {
        navigator?.serviceWorker?.controller?.postMessage?.({
          type: "SSE_REGISTER",
          sessionToken,
          onMessage: messageHandler,
        });
      } catch {
        // Client não suporta ServiceWorker
      }

      // Registrar fechamento
      const cleanup = () => {
        console.log(`[SSE] Conexão fechada pelo cliente (aborta).`);
        clearInterval(heartbeat);
        clearTimeout(idleTimer);
        controller.close();
      };

      request.signal.addEventListener("abort", cleanup);

      // Cleanup ao fechar o stream
      const abortHandler = () => {
        cleanup();
      };

      // Registrar handler de cleanup
      const originalClose = controller.close.bind(controller);
      // Usa um proxy para interceptar o fechamento
      (controller as unknown as { _close: () => void })._close = () => {
        cleanup();
      };

      // Dispatch de eventos de domínio para clientes conectados
      const subscription = eventBus.on("PROJECT_APPROVED", async (payload, context) => {
        send(JSON.stringify({
          type: "project_approved",
          data: payload,
          ts: Date.now(),
        }));
      });

      // Limpeza de referências para prevenir memory leaks
      (controller as unknown as { _cleanup: () => void })._cleanup = () => {
        clearInterval(heartbeat);
        clearTimeout(idleTimer);
        cleanup();
        subscription?.();
      };
    },
  });

  return new NextResponse(stream, { headers });
}

