import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { putStoredObject } from "@/server/storage";
import { computeSha256 } from "@/server/eap/pdf-reader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_DISCIPLINES = new Set([
  "ARQUITETONICO",
  "ESTRUTURAL",
  "ELETRICO",
  "HIDRO_ABASTECIMENTO",
  "HIDRO_ESGOTAMENTO",
  "HIDRO_DRENAGEM",
  "LUMINOTECNICO",
  "PAISAGISMO",
  "GERAL",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return NextResponse.json(
        { ok: false, error: "Inicialize a EAP antes de enviar arquivos." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rawDiscipline = String(formData.get("discipline") || "ARQUITETONICO").toUpperCase();
    const discipline = ALLOWED_DISCIPLINES.has(rawDiscipline) ? rawDiscipline : "ARQUITETONICO";
    const sourceSoftwareRaw = String(
      formData.get("sourceSoftware") || (discipline === "ESTRUTURAL" ? "TQS" : "REVIT")
    ).toUpperCase();
    const revisionLabel = String(formData.get("revisionLabel") || "R00").toUpperCase();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo obrigatório (.pdf, .html ou .htm) no campo 'file'." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const lowerName = file.name.toLowerCase();
    const isHtml = lowerName.endsWith(".html") || lowerName.endsWith(".htm") || file.type === "text/html";
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";
    if (!isHtml && !isPdf) {
      return NextResponse.json(
        { ok: false, error: "Formato inválido. Envie arquivos PDF, HTML ou HTM do TQS/Revit." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sourceSoftware: "TQS" | "REVIT" | "MANUAL" =
      sourceSoftwareRaw === "TQS" || sourceSoftwareRaw === "REVIT" ? sourceSoftwareRaw : "MANUAL";

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = computeSha256(bytes).slice(0, 16);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `eap/${projectId}/${Date.now()}-${hash}-${safeName}`;
    const mimeType = isHtml ? "text/html" : "application/pdf";

    await putStoredObject(storageKey, bytes, mimeType);

    const source = await prisma.eapSourceFile.create({
      data: {
        eapProjectId: eap.id,
        acervoDocumentId: null,
        fileName: file.name,
        storageKey,
        url: storageKey,
        sourceSoftware,
        discipline,
        revisionLabel,
        includedInMining: true,
        status: "PENDENTE",
      },
    });

    return NextResponse.json({ ok: true, source }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao enviar PDF para a EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
