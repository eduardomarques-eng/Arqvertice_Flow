import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { applyDigitalStampAndApprove } from "@/server/services/acervo-stamp-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: revisionId } = await params;
    const body = await request.json();
    const { decision, notes } = body;

    if (!decision || !["APROVADO_OBRA", "APROVADO_RESSALVAS", "REPROVADO"].includes(decision)) {
      return NextResponse.json({ error: "Decisão técnica inválida." }, { status: 400 });
    }

    // Regra de segurança: liberação para obra exige perfil de liderança técnica
    if (
      decision === "APROVADO_OBRA" &&
      user.role !== "ADMIN" &&
      user.role !== "ENGENHEIRO" &&
      user.role !== "ARQUITETO"
    ) {
      return NextResponse.json(
        { error: "Apenas a coordenação técnica e administradores podem liberar para obra com carimbo digital." },
        { status: 403 }
      );
    }

    const updated = await applyDigitalStampAndApprove({
      revisionId,
      decision,
      notes,
      performedById: user.id,
      performedByName: user.name,
      performedByRole: user.role,
    });

    return NextResponse.json({
      success: true,
      revision: updated,
      message: `Carimbo digital aplicado com sucesso: ${decision}`,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_STAMP_POST_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao aplicar parecer e carimbo digital." },
      { status: 500 }
    );
  }
}
