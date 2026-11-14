import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authenticatePluginRequest } from "@/lib/acervo/plugin-auth";

function incrementRevisionCode(currentRev?: string | null): string {
  if (!currentRev) return "R00";
  const match = currentRev.toUpperCase().match(/^R(\d+)$/);
  if (!match) return "R01";
  const nextNum = parseInt(match[1], 10) + 1;
  return `R${nextNum.toString().padStart(2, "0")}`;
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatePluginRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = (body.projectId as string | undefined) || auth.ctx.tokenProjectId;

    // Aceita tanto codes: string[] quanto sheets: Array<{ code: string } | string>
    let rawCodes: string[] = [];
    if (Array.isArray(body.codes)) {
      rawCodes = body.codes.map((c: unknown) => String(c || ""));
    } else if (Array.isArray(body.sheets)) {
      rawCodes = body.sheets.map((s: unknown) => {
        if (typeof s === "string") return s;
        if (s && typeof s === "object" && "code" in s) return String((s as { code: unknown }).code || "");
        return "";
      });
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId obrigatório." }, { status: 400 });
    }

    const normalizedCodes = Array.from(
      new Set(rawCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))
    );

    if (normalizedCodes.length === 0) {
      return NextResponse.json({ success: true, projectId, items: [] });
    }

    const existingDocs = await prisma.acervoDocument.findMany({
      where: {
        projectId,
        code: { in: normalizedCodes },
      },
      include: {
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, revisionNumber: true, status: true, createdAt: true },
        },
      },
    });

    const docMap = new Map(existingDocs.map((d) => [d.code.toUpperCase(), d]));

    const items = normalizedCodes.map((code) => {
      const found = docMap.get(code);
      if (!found || found.revisions.length === 0) {
        return {
          code,
          exists: false,
          currentRevision: null,
          nextRevision: "R00",
          status: "NOVA_PRANCHA",
        };
      }
      const latest = found.revisions[0];
      return {
        code,
        exists: true,
        documentId: found.id,
        title: found.title,
        currentRevision: latest.revisionNumber,
        nextRevision: incrementRevisionCode(latest.revisionNumber),
        status: latest.status,
      };
    });

    return NextResponse.json({ success: true, projectId, items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao verificar revisões." },
      { status: 500 }
    );
  }
}
