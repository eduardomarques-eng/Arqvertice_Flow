import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/server/agent-bridge/auth";
import { executeAgentAction, getAgentManifest } from "@/server/agent-bridge/capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface OllamaIntentPayload {
  action?: string | null;
  params?: Record<string, unknown>;
  explanation?: string;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeAgentRequest(request, { allowStaffCookie: true });
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
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

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "Informe o comando em linguagem natural no campo 'prompt'." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const ollamaUrl = (
    (typeof body.ollamaUrl === "string" && body.ollamaUrl.trim()) ||
    process.env.OLLAMA_URL ||
    "http://127.0.0.1:11434"
  ).replace(/\/+$/, "");
  const model =
    (typeof body.model === "string" && body.model.trim()) ||
    process.env.OLLAMA_MODEL ||
    "qwen2.5:1.5b";

  const manifest = getAgentManifest();
  const compactActions = manifest.capabilities.map((item) => ({
    name: item.name,
    module: item.module,
    riskLevel: item.riskLevel,
    description: item.description,
  }));

  const systemPrompt = [
    "Você é o roteador de comandos do sistema ArqVértice Flow.",
    "Converta o pedido do usuário em JSON estrito no formato:",
    '{"action": "<nome_da_acao_ou_null>", "params": {}, "explanation": "<resumo curto em pt-BR>"}',
    "Use apenas ações presentes na lista oficial:",
    JSON.stringify(compactActions),
  ].join("\n");

  let suggestion: OllamaIntentPayload;
  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Ollama retornou HTTP ${response.status}.` },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "{}";
    suggestion = JSON.parse(content) as OllamaIntentPayload;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ollama local indisponível ou resposta inválida.",
        detail: err instanceof Error ? err.message : "Erro de conexão",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let execution: Awaited<ReturnType<typeof executeAgentAction>> | null = null;
  if (body.execute === true && typeof suggestion.action === "string" && suggestion.action.trim()) {
    execution = await executeAgentAction({
      action: suggestion.action.trim(),
      params:
        suggestion.params && typeof suggestion.params === "object" && !Array.isArray(suggestion.params)
          ? suggestion.params
          : {},
      dryRun: Boolean(body.dryRun),
      confirmationToken:
        typeof body.confirmationToken === "string" ? body.confirmationToken : undefined,
      source: "OLLAMA_LOCAL",
      actorEmail: auth.user?.email ?? null,
    });

    if (execution.ok && execution.revalidatePaths?.length) {
      for (const path of execution.revalidatePaths) {
        revalidatePath(path);
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      model,
      suggestion,
      execution,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
