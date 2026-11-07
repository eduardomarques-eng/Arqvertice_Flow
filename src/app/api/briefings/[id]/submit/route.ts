import { NextResponse } from "next/server";
import { DomainError } from "@/server/errors";
import { finishBriefingByToken } from "@/server/services/briefing-service";
import { resolveBriefingToken } from "@/server/services/briefing-link-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token !== "string" || !body.token) {
      return NextResponse.json({ error: "Token do briefing é obrigatório." }, { status: 422 });
    }

    const link = await resolveBriefingToken(body.token);
    if (link.briefing.id !== id) {
      return NextResponse.json({ error: "O token não pertence a este briefing." }, { status: 404 });
    }

    const briefing = await finishBriefingByToken(body.token);
    return NextResponse.json({ ok: true, briefingId: briefing.id, status: briefing.status });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    }
    return NextResponse.json({ error: "Não foi possível finalizar o briefing." }, { status: 500 });
  }
}
