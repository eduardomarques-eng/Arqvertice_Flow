import { NextRequest } from "next/server";
import { z } from "zod";
import { CANONICAL_LOB_PACKAGE_RULES } from "@/lib/eap-lob-grid";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { cascadeSyncEapProject } from "@/server/eap/cascade-sync";
import { computeEapLine } from "@/server/eap/calculator";
import { auditEapCoherence } from "@/server/eap/eap-coherence-auditor";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";
import { normalizeZoneQuantities } from "@/server/eap/workbench";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function runProjectAudit(projectId: string) {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      city: true,
      stages: {
        orderBy: { orderIndex: "asc" },
        include: {
          groups: {
            orderBy: { orderIndex: "asc" },
            include: { items: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      lobFloorAllocations: {
        select: { packageNumber: true, teamCode: true },
      },
    },
  });

  if (!eap) return null;

  const auditItems = eap.stages.flatMap((st) =>
    st.groups.flatMap((g) =>
      g.items.map((item) => {
        const zq = normalizeZoneQuantities(item.zoneQuantitiesJson);
        const calc = computeEapLine({
          code: item.code,
          stageCode: st.code,
          description: item.description,
          unit: item.unit,
          zoneQuantities: zq,
          lossPercent: item.lossPercent,
          materialUnitCost: item.materialUnitCost,
          laborUnitCost: item.laborUnitCost,
          thirdPartyUnitCost: item.thirdPartyUnitCost,
          markupMultiplier: item.markupMultiplier,
        });
        return {
          id: item.id,
          stageCode: st.code,
          stageName: st.name,
          code: item.code,
          description: item.description,
          unit: item.unit,
          zoneQuantities: zq,
          totalMaterial: calc.totalMaterialCost,
          totalLabor: calc.totalLaborCost,
          totalThirdParty: calc.totalThirdPartyCost,
          totalDirectCost: calc.totalDirectCost,
        };
      })
    )
  );

  return auditEapCoherence(
    {
      builtAreaM2: eap.builtAreaM2,
      bdiPercent: eap.bdiPercent,
      constructionStandard: eap.constructionStandard,
      concreteMethod: eap.concreteMethod,
      cityLabel: `${eap.city.name}/${eap.city.state}`,
    },
    auditItems,
    eap.lobFloorAllocations
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) {
      throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    }
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    await requireProjectAccess(projectId);

    const audit = await runProjectAudit(projectId);
    if (!audit) {
      return jsonNoStore({ ok: false, error: "EAP não encontrada." }, 404);
    }
    return jsonNoStore({ ok: true, audit });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao auditar coerência da Planilha EAP.");
  }
}

const fixSchema = z.object({
  action: z.enum(["AUTO_FIX_TAXONOMY"]).default("AUTO_FIX_TAXONOMY"),
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
      throw new DomainError("Correção automática restrita à equipe técnica.", "INTEGRITY");
    }

    fixSchema.parse(await request.json().catch(() => ({})));

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "EAP não encontrada." }, 404);
    }

    // Alinha equipes A/B/C nas alocações LOB conforme CANONICAL_LOB_PACKAGE_RULES e Pacote 37
    const pkgsByTeam: Record<"A" | "B" | "C", number[]> = { A: [], B: [], C: [] };
    for (const rule of Object.values(CANONICAL_LOB_PACKAGE_RULES)) {
      pkgsByTeam[rule.defaultTeam].push(rule.packageNumber);
    }

    await prisma.$transaction(async (tx) => {
      for (const teamCode of ["A", "B", "C"] as const) {
        if (pkgsByTeam[teamCode].length > 0) {
          await tx.eapLobFloorAllocation.updateMany({
            where: {
              eapProjectId: eap.id,
              packageNumber: { in: pkgsByTeam[teamCode] },
            },
            data: { teamCode },
          });
        }
      }
      await tx.eapServicePackage.updateMany({
        where: { eapProjectId: eap.id, packageNumber: 37 },
        data: { name: "Guarda-Corpos em Madeira Maciça e Corrimãos" },
      });
    });

    await cascadeSyncEapProject(projectId);
    const audit = await runProjectAudit(projectId);

    return jsonNoStore({ ok: true, audit });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao aplicar correção automática de taxonomia.");
  }
}
