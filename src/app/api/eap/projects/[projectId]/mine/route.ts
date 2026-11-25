import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { ensureBaseEapItems, planMiningMerge } from "@/server/eap/base-items";
import { computeSha256, extractPdfFromBuffer, readRawBufferFromSource } from "@/server/eap/pdf-reader";
import { parseTqsPages } from "@/server/eap/parsers/tqs-parser";
import { parseTqsHtml } from "@/server/eap/parsers/tqs-html-parser";
import { parseRevitHtml, parseRevitPages } from "@/server/eap/parsers/revit-parser";
import type { MinedEapCandidate, ZeroSteelAlert } from "@/server/eap/parsers/types";
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
        sourceFiles: { where: { isActive: true, includedInMining: true } },
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
    let totalCarbonKgCo2: number | null = null;
    let zeroSteelAlert: ZeroSteelAlert | null = null;
    const processedFiles: Array<{
      id: string;
      fileName: string;
      discipline: string;
      versionCode: string;
      status: string;
      count: number;
      error?: string;
    }> = [];

    for (const src of eap.sourceFiles) {
      try {
        const rawBytes = await readRawBufferFromSource({
          id: src.id,
          storageKey: src.storageKey || null,
          url: src.url || null,
          rawTextContent: src.rawTextContent,
          rawBinaryBase64: src.rawBinaryBase64,
        });
        const sha256 = computeSha256(rawBytes);
        const lowerName = src.fileName.toLowerCase();
        const headText = rawBytes.subarray(0, 512).toString("utf8").trim().toLowerCase();
        const isHtml =
          lowerName.endsWith(".html") ||
          lowerName.endsWith(".htm") ||
          headText.startsWith("<!doctype") ||
          headText.startsWith("<html") ||
          headText.includes("<table");

        const isTqs = src.sourceSoftware === "TQS" || src.discipline === "ESTRUTURAL";
        let numPages = 1;
        let parsed;

        if (isHtml) {
          const htmlText = rawBytes.toString("latin1").includes("Ã")
            ? rawBytes.toString("utf8")
            : rawBytes.toString("utf8").includes("\uFFFD")
              ? rawBytes.toString("latin1")
              : rawBytes.toString("utf8");
          parsed = isTqs
            ? parseTqsHtml(htmlText, src.id)
            : parseRevitHtml(htmlText, { discipline: src.discipline, sourceFileId: src.id });
          numPages = parsed.pagesAnalyzed;
        } else {
          const pdf = await extractPdfFromBuffer(rawBytes);
          numPages = pdf.numPages;
          parsed = isTqs ? parseTqsPages(pdf.pages, src.id) : parseRevitPages(pdf.pages, src.id);
        }

        if (isTqs) {
          hasTqsSource = true;
        }
        if (typeof parsed.carbonKgCo2 === "number" && parsed.carbonKgCo2 > 0) {
          totalCarbonKgCo2 = (totalCarbonKgCo2 ?? 0) + parsed.carbonKgCo2;
        }
        if (parsed.zeroSteelAlert) {
          zeroSteelAlert = parsed.zeroSteelAlert;
        }

        allCandidates.push(...parsed.candidates);
        await prisma.eapSourceFile.update({
          where: { id: src.id },
          data: {
            status: "PROCESSADO",
            processedAt: new Date(),
            extractedSummaryJson: JSON.parse(
              JSON.stringify({
                sha256,
                numPages,
                extractedItems: parsed.candidates.length,
                notes: parsed.notes,
                carbonKgCo2: parsed.carbonKgCo2 ?? null,
                zeroSteelAlert: parsed.zeroSteelAlert ?? null,
                detectedAreaM2: parsed.detectedAreaM2 ?? null,
              }),
            ),
          },
        });
        processedFiles.push({
          id: src.id,
          fileName: src.fileName,
          discipline: src.discipline,
          versionCode: src.versionCode || src.revisionLabel || "R00",
          status: "PROCESSADO",
          count: parsed.candidates.length,
        });
      } catch (fileErr) {
        const message = fileErr instanceof Error ? fileErr.message : "Erro ao processar arquivo";
        await prisma.eapSourceFile.update({
          where: { id: src.id },
          data: {
            status: "ERRO",
            extractedSummaryJson: { error: message },
          },
        });
        processedFiles.push({
          id: src.id,
          fileName: src.fileName,
          discipline: src.discipline,
          versionCode: src.versionCode || src.revisionLabel || "R00",
          status: "ERRO",
          count: 0,
          error: message,
        });
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
    let preservedManualCount = 0;

    await prisma.$transaction(async (tx) => {
      // Garante a estrutura-base pré-carregada por disciplina antes do preenchimento
      await ensureBaseEapItems(tx, eap.id, eap.cityId);

      const stagesWithItems = await tx.eapStage.findMany({
        where: { eapProjectId: eap.id },
        include: {
          groups: {
            include: { items: true },
          },
        },
      });

      const existingItems = stagesWithItems.flatMap((st) =>
        st.groups.flatMap((g) =>
          g.items.map((it) => ({
            id: it.id,
            groupId: g.id,
            stageCode: st.code,
            code: it.code,
            description: it.description,
            unit: it.unit,
            sourceSoftware: it.sourceSoftware,
            revisionTag: it.revisionTag,
            dataOrigin: it.dataOrigin,
            materialUnitCost: it.materialUnitCost,
            laborUnitCost: it.laborUnitCost,
            thirdPartyUnitCost: it.thirdPartyUnitCost,
          }))
        )
      );

      if (fallbackGroupId) {
        const mergePlan = planMiningMerge({
          existingItems,
          acceptedItems: reconciled.acceptedItems,
          groupByStageCode: stageGroupMap,
          fallbackGroupId,
          defaultMarkup: markupMultiplier,
        });
        preservedManualCount = mergePlan.preservedManualCount;

        for (const upd of mergePlan.updates) {
          await tx.eapItem.update({
            where: { id: upd.id },
            data: {
              materialCatalogId: upd.materialCatalogId,
              laborRoleId: upd.laborRoleId,
              code: upd.code,
              description: upd.description,
              unit: upd.unit,
              zoneQuantitiesJson: upd.zoneQuantities,
              lossPercent: upd.lossPercent,
              materialUnitCost: upd.materialUnitCost,
              laborUnitCost: upd.laborUnitCost,
              thirdPartyUnitCost: upd.thirdPartyUnitCost,
              sourceSoftware: upd.sourceSoftware,
              sourceFileId: upd.sourceFileId,
              sourcePage: upd.sourcePage,
              sanityFlag: upd.sanityFlag,
              dataOrigin: "QUANTITATIVO_IMPORTADO",
            },
          });
        }

        if (mergePlan.resetTemplateIds.length > 0) {
          await tx.eapItem.updateMany({
            where: { id: { in: mergePlan.resetTemplateIds } },
            data: {
              zoneQuantitiesJson: {
                FUND_TERREO: 0,
                PAV_SUPERIOR: 0,
                COBERTURA: 0,
                EXTERNO: 0,
              },
              sourceSoftware: "TEMPLATE",
              sourceFileId: null,
              sourcePage: null,
              sanityFlag: null,
              dataOrigin: "PRELIMINAR_PADRAO",
            },
          });
        }

        if (mergePlan.deleteIds.length > 0) {
          await tx.eapItem.deleteMany({
            where: { id: { in: mergePlan.deleteIds } },
          });
        }

        if (mergePlan.creates.length > 0) {
          await tx.eapItem.createMany({
            data: mergePlan.creates.map((c) => ({
              groupId: c.groupId,
              materialCatalogId: c.materialCatalogId,
              laborRoleId: c.laborRoleId,
              code: c.code,
              description: c.description,
              unit: c.unit,
              zoneQuantitiesJson: c.zoneQuantities,
              lossPercent: c.lossPercent,
              materialUnitCost: c.materialUnitCost,
              laborUnitCost: c.laborUnitCost,
              thirdPartyUnitCost: c.thirdPartyUnitCost,
              markupMultiplier: c.markupMultiplier,
              teamsCount: 1,
              sourceSoftware: c.sourceSoftware,
              sourceFileId: c.sourceFileId,
              sourcePage: c.sourcePage,
              sanityFlag: c.sanityFlag,
              revisionTag: "ORIGINAL",
              dataOrigin: "QUANTITATIVO_IMPORTADO",
              orderIndex: c.orderIndex,
            })),
          });
        }
      }

      // Substitui logs de conflito da mineração anterior
      await tx.eapConflictLog.deleteMany({
        where: { eapProjectId: eap.id },
      });

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
        preservedManualCount,
        conflictsCount: reconciled.conflicts.length,
        sanityWarnings: reconciled.sanityWarnings,
        steelRateKgPerM3: reconciled.steelRateKgPerM3,
        carbonKgCo2: totalCarbonKgCo2,
        zeroSteelAlert,
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
