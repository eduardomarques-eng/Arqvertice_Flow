import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { putStoredObject, s3Config } from "@/server/storage";
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

    const revisionNoteRaw = formData.get("revisionNote");
    const revisionNote =
      typeof revisionNoteRaw === "string" && revisionNoteRaw.trim()
        ? revisionNoteRaw.trim().slice(0, 240)
        : null;
    const supersedesIdRaw = formData.get("supersedesId");
    const supersedesId =
      typeof supersedesIdRaw === "string" && supersedesIdRaw.trim()
        ? supersedesIdRaw.trim()
        : null;

    const bytes = Buffer.from(await file.arrayBuffer());
    const maxBytes = 15 * 1024 * 1024;
    if (bytes.byteLength > maxBytes) {
      return NextResponse.json(
        { ok: false, error: "Arquivo excede o limite de 15 MB para upload na EAP." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const newSourceId = randomUUID();
    const hash = computeSha256(bytes).slice(0, 16);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const externalKey = `eap/${projectId}/${Date.now()}-${hash}-${safeName}`;
    const mimeType = isHtml ? "text/html" : "application/pdf";

    let storageKey = externalKey;
    let rawTextContent: string | null = null;
    let rawBinaryBase64: string | null = null;

    let storedExternally = false;
    if (s3Config() || process.env.NODE_ENV !== "production") {
      try {
        await putStoredObject(externalKey, bytes, mimeType);
        storedExternally = true;
      } catch {
        storedExternally = false;
      }
    }

    if (!storedExternally) {
      storageKey = `db://${newSourceId}`;
      if (isHtml) {
        const utf8 = bytes.toString("utf8");
        rawTextContent = utf8.includes("\uFFFD") ? bytes.toString("latin1") : utf8;
      } else {
        rawBinaryBase64 = bytes.toString("base64");
      }
    }

    const source = await prisma.$transaction(async (tx) => {
      let nextVersionNumber = 0;
      let nextVersionCode = revisionLabel || "R00";
      let resolvedDiscipline = discipline;

      if (supersedesId) {
        const prev = await tx.eapSourceFile.findFirst({
          where: { id: supersedesId, eapProjectId: eap.id },
        });
        if (prev) {
          resolvedDiscipline = prev.discipline;
          const maxExisting = await tx.eapSourceFile.aggregate({
            where: { eapProjectId: eap.id, discipline: prev.discipline },
            _max: { versionNumber: true },
          });
          nextVersionNumber = (maxExisting._max.versionNumber ?? prev.versionNumber ?? 0) + 1;
          nextVersionCode = `R${String(nextVersionNumber).padStart(2, "0")}`;

          await tx.eapSourceFile.updateMany({
            where: {
              eapProjectId: eap.id,
              discipline: prev.discipline,
              isActive: true,
            },
            data: {
              isActive: false,
              includedInMining: false,
            },
          });
        }
      }

      return tx.eapSourceFile.create({
        data: {
          id: newSourceId,
          eapProjectId: eap.id,
          acervoDocumentId: null,
          fileName: file.name,
          storageKey,
          url: storageKey,
          rawTextContent,
          rawBinaryBase64,
          sourceSoftware,
          discipline: resolvedDiscipline,
          revisionLabel: nextVersionCode,
          versionCode: nextVersionCode,
          versionNumber: nextVersionNumber,
          isActive: true,
          revisionNote,
          supersedesId,
          includedInMining: true,
          status: "PENDENTE",
        },
        select: {
          id: true,
          eapProjectId: true,
          acervoDocumentId: true,
          fileName: true,
          storageKey: true,
          url: true,
          sourceSoftware: true,
          discipline: true,
          revisionLabel: true,
          versionCode: true,
          versionNumber: true,
          isActive: true,
          revisionNote: true,
          supersedesId: true,
          includedInMining: true,
          status: true,
          extractedSummaryJson: true,
          processedAt: true,
          createdAt: true,
        },
      });
    });

    return NextResponse.json({ ok: true, source }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao enviar PDF para a EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
