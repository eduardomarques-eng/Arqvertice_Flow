import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const importSchema = z.object({
  acervoDocumentIds: z.array(z.string().uuid()).min(1),
});

function inferSoftwareFromDiscipline(discipline: string, fileName: string): "TQS" | "REVIT" | "MANUAL" {
  const upper = `${discipline} ${fileName}`.toUpperCase();
  if (/ESTRUT|TQS|FUNDAC|ARMA|CONCRET|FORMA/.test(upper)) return "TQS";
  if (/ARQ|REVIT|INTERIOR|PAISAG|ALVEN|ESQUAD|HIDRO|ELET/.test(upper)) return "REVIT";
  return "MANUAL";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = importSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return NextResponse.json(
        { ok: false, error: "Inicialize a EAP antes de importar documentos do Acervo." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Leitura SOMENTE LEITURA de AcervoDocument
    const docs = await prisma.acervoDocument.findMany({
      where: { id: { in: parsed.acervoDocumentIds }, projectId, isArchived: false },
      include: {
        revisions: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    const imported = [];
    for (const doc of docs) {
      const rev = doc.revisions[0];
      if (!rev) continue;

      const existing = await prisma.eapSourceFile.findFirst({
        where: { eapProjectId: eap.id, acervoDocumentId: doc.id },
      });

      const inferred = inferSoftwareFromDiscipline(String(doc.discipline), rev.fileName);

      if (existing) {
        const updated = await prisma.eapSourceFile.update({
          where: { id: existing.id },
          data: {
            fileName: rev.fileName,
            storageKey: rev.fileKey ?? "",
            url: rev.fileUrl,
            revisionLabel: rev.revisionNumber,
            status: "PENDENTE",
          },
        });
        imported.push(updated);
      } else {
        const created = await prisma.eapSourceFile.create({
          data: {
            eapProjectId: eap.id,
            acervoDocumentId: doc.id,
            fileName: rev.fileName,
            storageKey: rev.fileKey ?? "",
            url: rev.fileUrl,
            sourceSoftware: inferred,
            discipline: String(doc.discipline),
            revisionLabel: rev.revisionNumber,
            includedInMining: true,
            status: "PENDENTE",
          },
        });
        imported.push(created);
      }
    }

    return NextResponse.json(
      { ok: true, importedCount: imported.length, sources: imported },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao importar do Acervo." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
