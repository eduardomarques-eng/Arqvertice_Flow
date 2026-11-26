import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";
import {
  convertConcreteItemByMethod,
  isStructuralConcreteItem,
  previewMultiStandardTriage,
  type ConcreteMethod,
  type ConstructionStandard,
  type TriagePreviewItemInput,
} from "@/server/eap/regional-standards-catalog";
import { normalizeZoneQuantities } from "@/server/eap/workbench";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const applyStandardSchema = z.object({
  action: z.enum(["PREVIEW", "APPLY"]),
  targetStandard: z.enum(["BAIXO_PADRAO", "MEDIO_PADRAO", "ALTO_PADRAO"]),
  concreteMethod: z.enum(["USINADO", "IN_LOCO_BETONEIRA"]).optional(),
  updateConcreteMethodOnly: z.boolean().default(false),
  cityName: z.string().trim().min(2).max(120),
  stateCode: z.string().trim().min(2).max(2),
  regionalMaterialFactor: z.number().min(0.5).max(3.0),
  regionalLaborFactor: z.number().min(0.5).max(3.0),
  selectedStageCodes: z.array(z.string()).optional(),
  includeUserEdited: z.boolean().default(false),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) {
      throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    }
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const user = await requireProjectAccess(projectId);
    if (isClientRole(user.role)) {
      throw new DomainError(
        "Alteração de padrão construtivo restrita à equipe técnica.",
        "INTEGRITY"
      );
    }

    const body = applyStandardSchema.parse(await request.json());

    if (body.action === "APPLY" && body.updateConcreteMethodOnly && body.concreteMethod) {
      const eap = await prisma.eapProject.findUnique({
        where: { projectId },
        include: {
          stages: {
            include: {
              groups: { include: { items: true } },
            },
          },
        },
      });
      if (!eap) {
        return jsonNoStore({ ok: false, error: "Planilha EAP não encontrada." }, 404);
      }

      const concreteMethod = body.concreteMethod as ConcreteMethod;
      const standard = body.targetStandard as ConstructionStandard;
      const converted = convertConcreteItemByMethod({ concreteMethod, standard });

      const concreteItems = eap.stages.flatMap((st) =>
        st.groups.flatMap((g) =>
          g.items.filter((it) => isStructuralConcreteItem(st.code, it.description))
        )
      );

      await prisma.$transaction([
        prisma.eapProject.update({
          where: { id: eap.id },
          data: { concreteMethod },
        }),
        ...concreteItems.map((it) =>
          prisma.eapItem.update({
            where: { id: it.id },
            data: {
              description: converted.description,
              materialUnitCost: converted.materialUnitCost,
              laborUnitCost: converted.laborUnitCost,
            },
          })
        ),
      ]);

      return jsonNoStore({
        ok: true,
        concreteMethod,
        updatedCount: concreteItems.length,
      });
    }

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: { items: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
      },
    });

    if (!eap) {
      return jsonNoStore(
        { ok: false, error: "Planilha EAP não encontrada para este projeto." },
        404
      );
    }

    const flatItems: TriagePreviewItemInput[] = eap.stages.flatMap((st) =>
      st.groups.flatMap((grp) =>
        grp.items.map((it) => ({
          id: it.id,
          stageCode: st.code,
          stageName: st.name,
          description: it.description,
          unit: it.unit,
          dataOrigin: it.dataOrigin,
          zoneQuantities: normalizeZoneQuantities(it.zoneQuantitiesJson),
          lossPercent: it.lossPercent,
          materialUnitCost: it.materialUnitCost,
          laborUnitCost: it.laborUnitCost,
          thirdPartyUnitCost: it.thirdPartyUnitCost,
          markupMultiplier: it.markupMultiplier,
        }))
      )
    );

    const currentStd = (eap.constructionStandard as ConstructionStandard) || "MEDIO_PADRAO";
    const triage = previewMultiStandardTriage({
      items: flatItems,
      bdiPercent: eap.bdiPercent,
      currentStandard: currentStd,
      targetStandard: body.targetStandard,
      currentMaterialFactor: eap.regionalMaterialFactor || 1.0,
      currentLaborFactor: eap.regionalLaborFactor || 1.0,
      targetMaterialFactor: body.regionalMaterialFactor,
      targetLaborFactor: body.regionalLaborFactor,
      selectedStageCodes: body.selectedStageCodes,
      includeUserEdited: body.includeUserEdited,
    });

    if (body.action === "PREVIEW") {
      return jsonNoStore({ ok: true, triage });
    }

    await prisma.$transaction(async (tx) => {
      await tx.eapProject.update({
        where: { id: eap.id },
        data: {
          constructionStandard: body.targetStandard,
          cityName: body.cityName,
          stateCode: body.stateCode.toUpperCase(),
          regionalMaterialFactor: body.regionalMaterialFactor,
          regionalLaborFactor: body.regionalLaborFactor,
        },
      });

      for (const upd of triage.itemUpdates) {
        await tx.eapItem.update({
          where: { id: upd.id },
          data: {
            materialUnitCost: upd.materialUnitCost,
            laborUnitCost: upd.laborUnitCost,
            thirdPartyUnitCost: upd.thirdPartyUnitCost,
          },
        });
      }
    });

    return jsonNoStore({
      ok: true,
      applied: true,
      triage,
    });
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao executar triagem multi-padrão na Planilha EAP."
    );
  }
}
