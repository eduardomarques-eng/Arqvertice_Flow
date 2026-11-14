import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const format = searchParams.get("format") || "json";

    const whereClause: Record<string, unknown> = {
      isArchived: false,
      ...(user.role !== "ADMIN"
        ? { project: { access: { some: { userId: user.id } } } }
        : {}),
    };
    if (projectId && projectId !== "ALL") {
      whereClause.projectId = projectId;
    }

    const documents = await prisma.acervoDocument.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ discipline: "asc" }, { code: "asc" }],
    });

    if (format === "csv") {
      const header = "Código;Empreendimento;Título;Disciplina;Fase;Revisão Vigente;Status;Arquivo;Última Atualização\n";
      const rows = documents.map((doc) => {
        const rev = doc.revisions[0];
        return [
          `"${doc.code}"`,
          `"${doc.project.name}"`,
          `"${doc.title}"`,
          `"${doc.discipline}"`,
          `"${doc.phase}"`,
          `"${rev?.revisionNumber || 'R00'}"`,
          `"${rev?.status || 'EM_ELABORACAO'}"`,
          `"${rev?.fileName || ''}"`,
          `"${rev?.updatedAt ? new Date(rev.updatedAt).toLocaleDateString("pt-BR") : ''}"`,
        ].join(";");
      }).join("\n");

      return new NextResponse(header + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="lista-mestra-acervo-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, count: documents.length, documents });
  } catch (err: unknown) {
    console.error("[ACERVO_MASTER_LIST_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao gerar Lista Mestra de Documentos." },
      { status: 500 }
    );
  }
}
