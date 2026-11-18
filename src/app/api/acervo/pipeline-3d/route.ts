import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  DEFAULT_3D_TEMPLATES_MANIFEST,
  type Pipeline3DAssetItem,
  type Pipeline3DStatus,
  type Pipeline3DStepId,
  type Templates3DManifest,
} from "@/lib/acervo/scene-compiler";

export const runtime = "nodejs";

function loadManifest(): Templates3DManifest {
  try {
    const manifestPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "3d-templates",
      "manifest.json"
    );
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, "utf8");
      return JSON.parse(raw) as Templates3DManifest;
    }
  } catch {
    // Fallback para manifesto embarcado
  }
  return DEFAULT_3D_TEMPLATES_MANIFEST;
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const manifest = loadManifest();
    const baseItems: Pipeline3DAssetItem[] = manifest.verificationItems?.length
      ? manifest.verificationItems
      : [
          ...manifest.models.map((m) => ({
            id: m.id,
            name: m.title,
            category: "MODEL" as const,
            sourcePath: m.sourcePath,
            sourceFormat: m.sourceFormat,
            outputUrl: m.glbUrl,
            pipelineStatus: (m.pipelineStatus || (m.glbUrl ? "READY" : "ERROR")) as Pipeline3DStatus,
            stepCompleted: (m.glbUrl ? "BUILD_MESHOPT" : null) as Pipeline3DStepId | null,
            fileSizeBytes: m.fileSizeBytes || 0,
            sourceSizeMB: m.sourceSizeMB || 0,
            triangleCount: m.optimizationStats?.vertexCount
              ? Math.round(m.optimizationStats.vertexCount / 3)
              : 0,
            textureCount: 0,
            diagnostics:
              m.diagnostics ||
              (m.glbUrl
                ? ["Ativo compilado e pronto para Studio 3D."]
                : ["Aguardando exportação aberta (.glb/.usdz/.fbx)."]),
          })),
          ...(manifest.avatars || []).map((a) => ({
            id: a.id,
            name: a.name,
            category: "AVATAR" as const,
            sourcePath: a.sourcePath,
            sourceFormat: a.sourceFormat,
            outputUrl: a.glbUrl,
            pipelineStatus: (a.pipelineStatus || (a.glbUrl ? "READY" : "ERROR")) as Pipeline3DStatus,
            stepCompleted: (a.glbUrl ? "BUILD_MESHOPT" : null) as Pipeline3DStepId | null,
            fileSizeBytes: a.fileSizeBytes || 0,
            sourceSizeMB: a.sourceSizeMB || 0,
            triangleCount: a.triangleCount || 0,
            textureCount: a.previewUrl ? 1 : 0,
            diagnostics: a.diagnostics || [],
          })),
        ];

    const dbStates = await prisma.pipeline3DAssetState
      .findMany({
        select: {
          id: true,
          name: true,
          category: true,
          sourcePath: true,
          sourceFormat: true,
          pipelineStatus: true,
          stepCompleted: true,
          outputUrl: true,
          fileSizeBytes: true,
          diagnostics: true,
          logs: true,
          updatedAt: true,
        },
      })
      .catch(() => []);
    const stateMap = new Map(dbStates.map((s) => [s.id, s]));

    const items: (Pipeline3DAssetItem & { logs?: string[]; updatedAt?: string })[] = baseItems.map(
      (item) => {
        const override = stateMap.get(item.id);
        if (!override) return item;
        return {
          ...item,
          sourceFormat: override.sourceFormat || item.sourceFormat,
          outputUrl: override.outputUrl ?? item.outputUrl,
          pipelineStatus: (override.pipelineStatus as Pipeline3DStatus) || item.pipelineStatus,
          stepCompleted: (override.stepCompleted as Pipeline3DStepId | null) ?? item.stepCompleted,
          fileSizeBytes: override.fileSizeBytes || item.fileSizeBytes,
          diagnostics: Array.isArray(override.diagnostics)
            ? (override.diagnostics as string[])
            : item.diagnostics,
          logs: Array.isArray(override.logs) ? (override.logs as string[]) : undefined,
          updatedAt: override.updatedAt.toISOString(),
        };
      }
    );

    // Inclui uploads customizados criados via Pipeline que ainda não estão no manifest.json
    for (const st of dbStates) {
      if (!items.some((i) => i.id === st.id)) {
        items.push({
          id: st.id,
          name: st.name,
          category: (st.category as Pipeline3DAssetItem["category"]) || "MODEL",
          sourcePath: st.sourcePath,
          sourceFormat: st.sourceFormat,
          outputUrl: st.outputUrl,
          pipelineStatus: (st.pipelineStatus as Pipeline3DStatus) || "WARNING",
          stepCompleted: (st.stepCompleted as Pipeline3DStepId | null) || null,
          fileSizeBytes: st.fileSizeBytes,
          sourceSizeMB: Number((st.fileSizeBytes / (1024 * 1024)).toFixed(2)),
          triangleCount: 0,
          textureCount: 0,
          diagnostics: Array.isArray(st.diagnostics) ? (st.diagnostics as string[]) : [],
          logs: Array.isArray(st.logs) ? (st.logs as string[]) : undefined,
          updatedAt: st.updatedAt.toISOString(),
        });
      }
    }

    const summary = {
      total: items.length,
      ready: items.filter((i) => i.pipelineStatus === "READY").length,
      warning: items.filter((i) => i.pipelineStatus === "WARNING").length,
      error: items.filter((i) => i.pipelineStatus === "ERROR").length,
    };

    const localArquivosAvailable = fs.existsSync(
      path.resolve(process.cwd(), "..", "Arquivos")
    );

    const mergedAvatars = (manifest.avatars || []).map((av) => {
      const override = stateMap.get(av.id);
      if (!override) return av;
      return {
        ...av,
        sourceFormat: override.sourceFormat || av.sourceFormat,
        glbUrl: override.outputUrl ?? av.glbUrl,
        pipelineStatus: (override.pipelineStatus as Pipeline3DStatus) || av.pipelineStatus,
        status: (override.pipelineStatus === "READY" ? "READY" : "NEEDS_EXPORT") as "READY" | "NEEDS_EXPORT",
        fileSizeBytes: override.fileSizeBytes || av.fileSizeBytes,
        diagnostics: Array.isArray(override.diagnostics)
          ? (override.diagnostics as string[])
          : av.diagnostics,
      };
    });

    return NextResponse.json({
      success: true,
      manifestVersion: manifest.version,
      generatedAt: manifest.generatedAt,
      localArquivosAvailable,
      summary,
      items,
      avatars: mergedAvatars,
      hdris: manifest.hdris || [],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erro ao consultar inventário do Pipeline Pré-Build 3D.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
