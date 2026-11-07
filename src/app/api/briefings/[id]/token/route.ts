import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { generateSecureToken } from "@/server/services/briefing-link-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const origin = request.headers.get("origin");
    const result = await generateSecureToken(id, origin);

    return NextResponse.json({
      ok: true,
      token: result.token,
      publicUrl: result.publicUrl,
      briefingId: result.briefing.id,
      projectId: result.briefing.projectId,
    });
  } catch (error) {
    console.error("[API Briefings Token] Erro ao gerar token:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao gerar token seguro do briefing.",
      },
      { status: 500 }
    );
  }
}

