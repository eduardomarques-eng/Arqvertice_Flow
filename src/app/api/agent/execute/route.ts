import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/server/agent-bridge/auth";
import { executeAgentAction, type AgentSource } from "@/server/agent-bridge/capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_SOURCES: readonly AgentSource[] = ["OPENBOT", "OLLAMA_LOCAL", "WHATSAPP_GATEWAY"];

export async function POST(request: NextRequest) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado. Informe x-agent-key válida ou sessão ADMIN." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corpo JSON inválido." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) {
    return NextResponse.json(
      { ok: false, error: "Campo 'action' é obrigatório." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawSource = typeof body.source === "string" ? body.source : "OPENBOT";
  const source: AgentSource = ALLOWED_SOURCES.includes(rawSource as AgentSource)
    ? (rawSource as AgentSource)
    : "OPENBOT";

  try {
    const result = await executeAgentAction({
      action,
      params:
        body.params && typeof body.params === "object" && !Array.isArray(body.params)
          ? (body.params as Record<string, unknown>)
          : {},
      dryRun: Boolean(body.dryRun),
      confirmationToken: typeof body.confirmationToken === "string" ? body.confirmationToken : undefined,
      source,
      actorEmail: auth.user?.email ?? null,
    });

    if (result.ok && "revalidatePaths" in result && Array.isArray(result.revalidatePaths)) {
      for (const path of result.revalidatePaths) {
        revalidatePath(path);
      }
    }

    const httpStatus = result.ok
      ? 200
      : result.status === "PENDING_CONFIRMATION"
        ? 409
        : 400;

    return NextResponse.json(result, {
      status: httpStatus,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar ação do agente.";
    const httpStatus = message.startsWith("Ação desconhecida") ? 404 : 400;
    return NextResponse.json(
      { ok: false, status: "ERROR", action, message },
      { status: httpStatus, headers: { "Cache-Control": "no-store" } }
    );
  }
}
