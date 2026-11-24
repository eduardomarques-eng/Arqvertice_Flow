import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { computeScheduleAnalytics, evaluateScheduleAudit } from "@/server/eap/scheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: { include: { holidays: true } },
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        baselineSnapshots: { select: { id: true } },
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: { items: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        schedulePackages: {
          orderBy: { orderIndex: "asc" },
          include: {
            segments: { orderBy: { segmentOrder: "asc" } },
            procurementGates: { orderBy: { triggerDate: "asc" } },
          },
        },
      },
    });

    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const allowedStatuses = ["CONFERENCIA_OK", "BASELINE_APROVADA", "EM_EXECUCAO"];
    if (!allowedStatuses.includes(eap.status)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Valide primeiro a Conferência da EAP (Aba 2) para atingir o status CONFERENCIA_OK antes de congelar a Baseline.",
        },
        { status: 422, headers: { "Cache-Control": "no-store" } }
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

    const packages = eap.schedulePackages.map((p) => ({
      packageNumber: p.packageNumber,
      name: p.name,
      linkedStageCodes: Array.isArray(p.linkedStageCodesJson)
        ? p.linkedStageCodesJson.map(String)
        : [],
      teamsCount: p.teamsCount,
      segments: p.segments,
      procurementGates: p.procurementGates,
    }));

    const analytics = computeScheduleAnalytics({
      packages,
      stageBudgets: tree.stages.map((st) => ({
        stageCode: st.code,
        totalMaterial: st.totalMaterial,
        totalLabor: st.totalLabor,
        totalThirdParty: st.totalThirdParty,
        totalDirectCost: st.totalDirectCost,
        totalCommercialPrice: st.totalCommercialPrice,
      })),
      holidays: eap.city.holidays.map((h) => h.date),
    });

    const activeStageCodesWithQty = tree.stages
      .filter((st) => st.groups.some((g) => g.items.some((i) => i.totalQtyWithLoss > 0)))
      .map((st) => st.code);

    const audit = evaluateScheduleAudit({
      packages,
      activeStageCodesWithQty,
      plannedStartDate: tree.plannedStartDate,
      weeklyHistogram: analytics.weeklyHistogram,
    });

    if (!audit.approved) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bloqueios críticos detectados na auditoria lógica do cronograma.",
          criticalBlockers: audit.criticalBlockers,
          warnings: audit.warnings,
        },
        { status: 422, headers: { "Cache-Control": "no-store" } }
      );
    }

    const nextVersionNumber = eap.baselineSnapshots.length + 1;
    const versionLabel = `v${nextVersionNumber}.0`;

    const snapshot = await prisma.$transaction(async (tx) => {
      const created = await tx.eapBaselineSnapshot.create({
        data: {
          eapProjectId: eap.id,
          versionLabel,
          totalDirectCost: tree.indicators.totalDirectCost,
          totalCommercialPrice: tree.indicators.totalCommercialPrice,
          costPerM2: tree.indicators.costPerM2,
          approvedById: admin.id,
          snapshotJson: JSON.parse(
            JSON.stringify({
              versionLabel,
              indicators: tree.indicators,
              analytics,
              stagesSummary: tree.stages.map((s) => ({
                code: s.code,
                name: s.name,
                totalCommercialPrice: s.totalCommercialPrice,
                weightPercent: s.weightPercent,
              })),
            })
          ),
        },
      });

      await tx.eapProject.update({
        where: { id: eap.id },
        data: {
          status: "BASELINE_APROVADA",
          currentRevision: nextVersionNumber,
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        ok: true,
        snapshot: {
          id: snapshot.id,
          versionLabel: snapshot.versionLabel,
          totalCommercialPrice: snapshot.totalCommercialPrice,
          costPerM2: snapshot.costPerM2,
          approvedAt: snapshot.approvedAt.toISOString(),
        },
        warnings: audit.warnings,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao aprovar Baseline." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
