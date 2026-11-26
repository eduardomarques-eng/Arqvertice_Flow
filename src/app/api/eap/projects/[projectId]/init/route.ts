import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { ensureBaseEapItems } from "@/server/eap/base-items";
import { applyPreliminary13MonthFill } from "@/server/eap/preliminary-fill";
import {
  calibrateRoofLaborProportional,
  convertConcreteItemByMethod,
  isStructuralConcreteItem,
  type ConcreteMethod,
  type ConstructionStandard,
} from "@/server/eap/regional-standards-catalog";
import { ensureDefaultTeamsAndPackages } from "@/server/eap/teams-and-packages";
import { cascadeSyncEapProject } from "@/server/eap/cascade-sync";
import {
  DEFAULT_EAP_ZONES,
  DEFAULT_PROPOSAL_EXCLUSIONS,
  DEFAULT_PROPOSAL_PREMISES,
  MASTER_EAP_STAGES,
  MASTER_LOB_PACKAGES,
} from "@/server/eap/templates/residential-master";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const initSchema = z.object({
  cityId: z.string().uuid(),
  title: z.string().min(2).max(200).optional(),
  builtAreaM2: z.number().positive(),
  bdiPercent: z.number().min(0).max(100).default(22),
  plannedStartDate: z.string().optional().nullable(),
  constructionStandard: z
    .enum(["BAIXO_PADRAO", "MEDIO_PADRAO", "ALTO_PADRAO"])
    .default("MEDIO_PADRAO"),
  concreteMethod: z.enum(["USINADO", "IN_LOCO_BETONEIRA"]).default("USINADO"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = initSchema.parse(body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Projeto não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const existing = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Este projeto já possui uma EAP inicializada.", eapProjectId: existing.id },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const plannedDate = parsed.plannedStartDate
      ? new Date(`${parsed.plannedStartDate.slice(0, 10)}T00:00:00.000Z`)
      : null;

    const eap = await prisma.$transaction(async (tx) => {
      const cityInfo = await tx.cityCatalog.findUnique({
        where: { id: parsed.cityId },
        select: { name: true, state: true },
      });

      const created = await tx.eapProject.create({
        data: {
          projectId,
          cityId: parsed.cityId,
          title: parsed.title?.trim() || `EAP & Orçamento Executivo — ${project.name}`,
          builtAreaM2: parsed.builtAreaM2,
          bdiPercent: parsed.bdiPercent,
          constructionStandard: parsed.constructionStandard,
          concreteMethod: parsed.concreteMethod,
          cityName: cityInfo?.name || "Fortaleza",
          stateCode: cityInfo?.state || "CE",
          plannedStartDate: plannedDate,
          status: "RASCUNHO",
          premisesJson: DEFAULT_PROPOSAL_PREMISES,
          exclusionsJson: DEFAULT_PROPOSAL_EXCLUSIONS,
        },
      });

      await tx.eapZone.createMany({
        data: DEFAULT_EAP_ZONES.map((zItem) => ({
          eapProjectId: created.id,
          code: zItem.code,
          name: zItem.name,
          orderIndex: zItem.orderIndex,
        })),
      });

      for (const stage of MASTER_EAP_STAGES) {
        await tx.eapStage.create({
          data: {
            eapProjectId: created.id,
            code: stage.code,
            name: stage.name,
            orderIndex: stage.orderIndex,
            groups: {
              create: stage.groups.map((g) => ({
                code: g.code,
                name: g.name,
                orderIndex: g.orderIndex,
              })),
            },
          },
        });
      }

      await tx.schedulePackage.createMany({
        data: MASTER_LOB_PACKAGES.map((pkg, idx) => ({
          eapProjectId: created.id,
          packageNumber: pkg.packageNumber,
          name: pkg.name,
          waveName: pkg.waveName,
          linkedStageCodesJson: pkg.linkedStageCodes,
          predecessorNumbersJson: pkg.predecessorNumbers,
          durationWorkingDays: pkg.defaultDurationWorkingDays,
          teamsCount: pkg.defaultTeamsCount,
          orderIndex: idx + 1,
        })),
      });

      const baseItemsResult = await ensureBaseEapItems(tx, created.id, parsed.cityId);

      return { created, baseItemsInserted: baseItemsResult.inserted };
    });

    const preliminaryFill = await applyPreliminary13MonthFill({
      eapProjectId: eap.created.id,
      startDate: parsed.plannedStartDate?.slice(0, 10) || undefined,
    });

    await ensureDefaultTeamsAndPackages(
      eap.created.id,
      parsed.constructionStandard as ConstructionStandard
    );

    // Calibra concreto (Usinado vs In Loco Betoneira) e carpintaria de coberta (MO proporcional)
    const seededStages = await prisma.eapStage.findMany({
      where: { eapProjectId: eap.created.id, code: { in: ["03", "04", "06"] } },
      include: { groups: { include: { items: true } } },
    });

    if (parsed.concreteMethod === "IN_LOCO_BETONEIRA") {
      const converted = convertConcreteItemByMethod({
        concreteMethod: parsed.concreteMethod as ConcreteMethod,
        standard: parsed.constructionStandard as ConstructionStandard,
      });
      const concreteItems = seededStages.flatMap((st) =>
        st.groups.flatMap((g) =>
          g.items.filter((it) => isStructuralConcreteItem(st.code, it.description))
        )
      );
      if (concreteItems.length > 0) {
        await prisma.$transaction(
          concreteItems.map((it) =>
            prisma.eapItem.update({
              where: { id: it.id },
              data: {
                description: converted.description,
                materialUnitCost: converted.materialUnitCost,
                laborUnitCost: converted.laborUnitCost,
              },
            })
          )
        );
      }
    }

    const stage06 = seededStages.find((st) => st.code === "06");
    if (stage06) {
      const roofItems = stage06.groups.flatMap((g) => g.items);
      const calibratedRoof = calibrateRoofLaborProportional(
        roofItems,
        parsed.constructionStandard as ConstructionStandard
      );
      for (let i = 0; i < roofItems.length; i++) {
        const orig = roofItems[i];
        const next = calibratedRoof[i];
        if (
          next.materialUnitCost !== orig.materialUnitCost ||
          next.laborUnitCost !== orig.laborUnitCost
        ) {
          await prisma.eapItem.update({
            where: { id: orig.id },
            data: {
              materialUnitCost: next.materialUnitCost,
              laborUnitCost: next.laborUnitCost,
            },
          });
        }
      }
    }

    await cascadeSyncEapProject(projectId);

    return NextResponse.json(
      {
        ok: true,
        eapProject: eap.created,
        instantiated: {
          zones: DEFAULT_EAP_ZONES.length,
          stages: MASTER_EAP_STAGES.length,
          packages: MASTER_LOB_PACKAGES.length,
          baseItems: eap.baseItemsInserted,
          preliminaryFilledItems: preliminaryFill.filledEapItemsCount,
          preliminaryLobAllocations: preliminaryFill.lobAllocationsCount,
          preliminaryWorkingDaysSpan: preliminaryFill.workingDaysSpan,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao inicializar EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
