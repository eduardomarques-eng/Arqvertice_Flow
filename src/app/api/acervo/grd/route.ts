import { NextResponse } from "next/server";
import { canUserAccessProject, currentUser } from "@/server/auth";
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

    if (user.role === "CLIENTE" || user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Apenas a equipe técnica pode emitir GRD." },
        { status: 403 }
      );
    }

    const hasAccess = await canUserAccessProject(user, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Sem permissão para emitir GRD neste empreendimento." },
        { status: 403 }
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
