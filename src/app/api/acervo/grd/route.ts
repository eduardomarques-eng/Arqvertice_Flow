import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { createAcervoGrd } from "@/server/services/acervo-cde-service";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      recipientName,
      recipientEmail,
      recipientOrg,
      subject,
      notes,
      revisionIds,
    } = body;

    if (!projectId || !recipientName || !revisionIds || revisionIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Parâmetros incompletos. Empreendimento, Destinatário e ao menos 1 prancha são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const grd = await createAcervoGrd({
      projectId,
      recipientName,
      recipientEmail,
      recipientOrg,
      subject: subject || `Remessa de Pranchas e Documentos — ${new Date().toLocaleDateString("pt-BR")}`,
      notes,
      revisionIds,
      createdById: user.id,
    });

    return NextResponse.json({ success: true, grd });
  } catch (err: unknown) {
    console.error("[ACERVO_GRD_POST_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao gerar Guia de Remessa de Documentos (GRD)." },
      { status: 500 }
    );
  }
}
