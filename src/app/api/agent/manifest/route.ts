import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/server/agent-bridge/auth";
import { getAgentManifest } from "@/server/agent-bridge/capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado. Informe x-agent-key válida ou sessão ADMIN." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      manifest: getAgentManifest(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
