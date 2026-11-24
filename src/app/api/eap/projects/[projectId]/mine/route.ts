import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { readPdfFromSource } from "@/server/eap/pdf-reader";
import { parseTqsPages } from "@/server/eap/parsers/tqs-parser";
import { parseRevitPages } from "@/server/eap/parsers/revit-parser";
import type { MinedEapCandidate } from "@/server/eap/parsers/types";
import { reconcileMinedCandidates } from "@/server/eap/reconciler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        sourceFiles: { where: { includedInMining: true } },
        stages: {
          include: { groups: { orderBy: { orderIndex: "asc" } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    if (eap.sourceFiles.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecione pelo menos um PDF (TQS ou Revit) para mineração." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const [materialsRaw, laborRaw] = await Promise.all([
      prisma.materialCatalogItem.findMany({
        where: { active: true },
        include: { cityPrices: { where: { cityId: eap.cityId }, take: 1 } },
      }),
      prisma.laborRoleCatalog.findMany({
        where: { active: true },
        include: { cityPrices: { where: { cityId: eap.cityId }, take: 1 } },
      }),
    ]);

    const cityMaterials = materialsRaw.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      category: m.category,
      unit: m.unit,
      defaultLossPercent: m.defaultLossPercent,
      eapStageCode: m.eapStageCode,
      materialUnitCost: m.cityPrices[0]?.materialUnitCost ?? 0,
      thirdPartyUnitCost: m.cityPrices[0]?.thirdPartyUnitCost ?? 0,
    }));

    const cityLabor = laborRaw.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      unit: l.unit,
      laborUnitCost: l.cityPrices[0]?.laborUnitCost ?? 0,
    }));

    const allCandidates: MinedEapCandidate[] = [];
    let hasTqsSource = false;
    const processedFiles: Array<{ id: string; status: string; count: number; error?: string }> = [];

    for (const src of eap.sourceFiles) {
      try {
        const pdf = await readPdfFromSource({ storageKey: src.storageKey || null, url: src.url || null });
        const parsed =
          src.sourceSoftware === "TQS"
            ? parseTqsPages(pdf.pages, src.id)
            : parseRevitPages(pdf.pages, src.id);

        if (src.sourceSoftware === "TQS") {
          hasTqsSource = true;
        }

        allCandidates.push(...parsed.candidates);
        await prisma.eapSourceFile.update({
          where: { id: src.id },
          data: {
            status: "PROCESSADO",
            processedAt: new Date(),
            extractedSummaryJson: {
              sha256: pdf.sha256,
              numPages: pdf.numPages,
              extractedItems: parsed.candidates.length,
              notes: parsed.notes,
            },
          },
        });
        processedFiles.push({ id: src.id, status: "PROCESSADO", count: parsed.candidates.length });
      } catch (fileErr) {
        const message = fileErr instanceof Error ? fileErr.message : "Erro ao processar PDF";
        await prisma.eapSourceFile.update({
          where: { id: src.id },
          data: {
            status: "ERRO",
            extractedSummaryJson: { error: message },
          },
        });
        processedFiles.push({ id: src.id, status: "ERRO", count: 0, error: message });
      }
    }

    const reconciled = reconcileMinedCandidates({
      candidates: allCandidates,
      hasTqsSource,
      builtAreaM2: eap.builtAreaM2,
      cityMaterials,
      cityLabor,
    });

    const stageGroupMap = new Map<string, string>();
    for (const stage of eap.stages) {
      const firstGroup = stage.groups[0];
      if (firstGroup) {
        stageGroupMap.set(stage.code, firstGroup.id);
      }
    }
    const fallbackGroupId = eap.stages[0]?.groups[0]?.id;

    const markupMultiplier = 1 + (eap.bdiPercent || 0) / 100;

    await prisma.$transaction(async (tx) => {
      // Remove itens minerados anteriormente (preservando itens adicionados manualmente)
      const allGroupIds = eap.stages.flatMap((s) => s.groups.map((g) => g.id));
      if (allGroupIds.length > 0) {
        await tx.eapItem.deleteMany({
          where: {
            groupId: { in: allGroupIds },
            sourceSoftware: { in: ["TQS", "REVIT"] },
          },
        });
      }

      // Substitui logs de conflito da mineração anterior
      await tx.eapConflictLog.deleteMany({
        where: { eapProjectId: eap.id },
      });

      if (reconciled.acceptedItems.length > 0 && fallbackGroupId) {
        await tx.eapItem.createMany({
          data: reconciled.acceptedItems.map((item, idx) => ({
            groupId: stageGroupMap.get(item.eapStageCode) ?? fallbackGroupId,
            materialCatalogId: item.materialCatalogId,
            laborRoleId: item.laborRoleId,
            code: item.code,
            description: item.description,
            unit: item.unit,
            zoneQuantitiesJson: item.zoneQuantities,
            lossPercent: item.lossPercent,
            materialUnitCost: item.materialUnitCost,
            laborUnitCost: item.laborUnitCost,
            thirdPartyUnitCost: item.thirdPartyUnitCost,
            markupMultiplier,
            teamsCount: 1,
            sourceSoftware: item.sourceSoftware,
            sourceFileId: item.sourceFileId,
            sourcePage: item.sourcePage,
            sanityFlag: item.sanityFlag,
            revisionTag: "ORIGINAL",
            orderIndex: idx + 1,
          })),
        });
      }

      if (reconciled.conflicts.length > 0) {
        await tx.eapConflictLog.createMany({
          data: reconciled.conflicts.map((c) => ({
            eapProjectId: eap.id,
            category: c.category,
            itemDescription: c.itemDescription,
            winningSource: c.winningSource,
            discardedSource: c.discardedSource,
            winningQty: c.winningQty,
            discardedQty: c.discardedQty,
            unit: c.unit,
            reason: c.reason,
            status: c.status,
          })),
        });
      }

      await tx.eapProject.update({
        where: { id: eap.id },
        data: { status: "EM_CONFERENCIA" },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        processedFiles,
        acceptedItemsCount: reconciled.acceptedItems.length,
        conflictsCount: reconciled.conflicts.length,
        sanityWarnings: reconciled.sanityWarnings,
        steelRateKgPerM3: reconciled.steelRateKgPerM3,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao minerar arquivos da EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
