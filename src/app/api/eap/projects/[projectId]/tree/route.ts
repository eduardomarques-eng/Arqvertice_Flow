import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { buildEapTreePayload } from "@/server/eap/workbench";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: { select: { id: true, name: true, state: true } },
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: {
                items: { orderBy: { orderIndex: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!eap) {
      return NextResponse.json(
        { ok: false, error: "EAP não inicializada para este projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const tree = buildEapTreePayload({
      id: eap.id,
      projectId: eap.projectId,
      cityId: eap.cityId,
      cityLabel: `${eap.city.name}/${eap.city.state}`,
      title: eap.title,
      builtAreaM2: eap.builtAreaM2,
      bdiPercent: eap.bdiPercent,
      plannedStartDate: eap.plannedStartDate,
      status: eap.status,
      currentRevision: eap.currentRevision,
      premisesJson: eap.premisesJson,
      exclusionsJson: eap.exclusionsJson,
      zones: eap.zones,
      stages: eap.stages,
      conflicts: eap.conflictLogs,
    });

    return NextResponse.json({ ok: true, tree }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao carregar árvore da EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
