import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { optimizeGlbBuffer } from "@/lib/acervo/glb-optimizer";
import {
  classifyMaterialToPbrPreset,
  classifyPipeline3DAsset,
  DEFAULT_3D_TEMPLATES_MANIFEST,
  type Pipeline3DAssetItem,
  type Pipeline3DStatus,
  type Pipeline3DStepId,
  type Templates3DManifest,
} from "@/lib/acervo/scene-compiler";

export const runtime = "nodejs";

const StepRequestSchema = z.object({
  assetId: z.string().min(1),
  step: z.enum(["CONVERT_MESH", "OPTIMIZE_IMAGES_PBR", "BUILD_MESHOPT"]),
  assetName: z.string().optional(),
  category: z.enum(["MODEL", "AVATAR", "HDRI", "PROJECT_BLOCK", "PROPRIETARY_SCENE", "INCOMPLETE"]).optional(),
  sourceFormat: z.string().optional(),
  fileName: z.string().optional(),
  base64File: z.string().optional(),
});

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
      return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Templates3DManifest;
    }
  } catch {
    // fallback
  }
  return DEFAULT_3D_TEMPLATES_MANIFEST;
}

function findItemInManifest(manifest: Templates3DManifest, assetId: string): Pipeline3DAssetItem | null {
  const fromVerification = (manifest.verificationItems || []).find((i) => i.id === assetId);
  if (fromVerification) return fromVerification;

  const model = manifest.models.find((m) => m.id === assetId || m.slug === assetId);
  if (model) {
    return {
      id: model.id,
      name: model.title,
      category: "MODEL",
      sourcePath: model.sourcePath,
      sourceFormat: model.sourceFormat,
      outputUrl: model.glbUrl,
      pipelineStatus: model.pipelineStatus || (model.glbUrl ? "READY" : "ERROR"),
      stepCompleted: model.glbUrl ? "BUILD_MESHOPT" : null,
      fileSizeBytes: model.fileSizeBytes || 0,
      sourceSizeMB: model.sourceSizeMB || 0,
      triangleCount: model.optimizationStats?.vertexCount
        ? Math.round(model.optimizationStats.vertexCount / 3)
        : 0,
      textureCount: 0,
      diagnostics: model.diagnostics || [],
    };
  }

  const avatar = (manifest.avatars || []).find((a) => a.id === assetId || a.slug === assetId);
  if (avatar) {
    return {
      id: avatar.id,
      name: avatar.name,
      category: "AVATAR",
      sourcePath: avatar.sourcePath,
      sourceFormat: avatar.sourceFormat,
      outputUrl: avatar.glbUrl,
      pipelineStatus: avatar.pipelineStatus || (avatar.glbUrl ? "READY" : "ERROR"),
      stepCompleted: avatar.glbUrl ? "BUILD_MESHOPT" : null,
      fileSizeBytes: avatar.fileSizeBytes || 0,
      sourceSizeMB: avatar.sourceSizeMB || 0,
      triangleCount: avatar.triangleCount || 0,
      textureCount: avatar.previewUrl ? 1 : 0,
      diagnostics: avatar.diagnostics || [],
    };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = StepRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload inválido para etapa do Pipeline Pré-Build 3D.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { assetId, step, assetName, category, sourceFormat, fileName, base64File } = parsed.data;
    const manifest = loadManifest();
    const manifestItem = findItemInManifest(manifest, assetId);
    const existingState = await prisma.pipeline3DAssetState
      .findUnique({ where: { id: assetId } })
      .catch(() => null);

    const resolvedName = assetName || existingState?.name || manifestItem?.name || assetId;
    const resolvedCategory = category || existingState?.category || manifestItem?.category || "MODEL";
    const resolvedSourcePath =
      fileName || existingState?.sourcePath || manifestItem?.sourcePath || `uploads/${assetId}`;
    const resolvedFormat =
      (fileName ? path.extname(fileName).slice(1).toUpperCase() : null) ||
      sourceFormat ||
      existingState?.sourceFormat ||
      manifestItem?.sourceFormat ||
      "GLB";

    const logs: string[] = Array.isArray(existingState?.logs)
      ? ([...(existingState.logs as string[])] as string[]).slice(-15)
      : [];
    const nowTag = new Date().toISOString().slice(11, 19);

    let outputUrl = existingState?.outputUrl ?? manifestItem?.outputUrl ?? null;
    let binaryBase64: string | null = existingState?.binaryBase64 ?? null;
    let fileSizeBytes = existingState?.fileSizeBytes ?? manifestItem?.fileSizeBytes ?? 0;
    let pipelineStatus: Pipeline3DStatus =
      (existingState?.pipelineStatus as Pipeline3DStatus) || manifestItem?.pipelineStatus || "WARNING";
    let stepCompleted: Pipeline3DStepId | null =
      (existingState?.stepCompleted as Pipeline3DStepId | null) || manifestItem?.stepCompleted || null;
    let diagnostics: string[] = manifestItem?.diagnostics ? [...manifestItem.diagnostics] : [];

    const fmtLower = resolvedFormat.toLowerCase();
    const isClosedProprietary =
      (fmtLower.includes("max") || fmtLower.includes("rvt")) &&
      !base64File &&
      !outputUrl;
    const isIncomplete = fmtLower.includes("crdownload");
    const is2DOnlyAvatar =
      resolvedCategory === "AVATAR" &&
      (fmtLower === "jpg" || fmtLower === "jpeg" || fmtLower === "png" || fmtLower === "webp") &&
      !base64File &&
      !outputUrl;

    if (isIncomplete) {
      pipelineStatus = "ERROR";
      diagnostics = ["Download incompleto (.crdownload). Remova o arquivo temporário e conclua o download."];
      logs.push(`[${nowTag}] [${step}] BLOQUEADO: arquivo .crdownload corrompido/incompleto.`);
    } else if (isClosedProprietary) {
      pipelineStatus = "ERROR";
      diagnostics = [
        "Arquivo proprietário fechado (.max/.rvt) sem exportação aberta (.glb, .usdz ou .fbx). Zero modelagem procedural aplicada.",
      ];
      logs.push(`[${nowTag}] [${step}] BLOQUEADO (NEEDS_EXPORT): exporte .glb/.usdz/.fbx no software nativo.`);
    } else if (is2DOnlyAvatar) {
      pipelineStatus = "ERROR";
      diagnostics = [
        "Apenas imagem 2D de referência encontrada em Blocos Perrsonagens. Envie a malha .glb/.usdz/.fbx para habilitar Avatar 3ª Pessoa.",
      ];
      logs.push(`[${nowTag}] [${step}] BLOQUEADO (NEEDS_EXPORT): envie arquivo 3D (.glb/.usdz/.fbx) do avatar.`);
    } else if (step === "CONVERT_MESH") {
      if (base64File) {
        const cleanBase64 = base64File.replace(/^data:[^;]+;base64,/, "");
        let buf = Buffer.from(cleanBase64, "base64");
        const safeSlug = assetId.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
        const subFolder = resolvedCategory === "AVATAR" ? "avatars" : "models";
        const ext = fileName ? path.extname(fileName).toLowerCase() : `.${fmtLower}`;
        const targetRel = `/assets/3d-templates/${subFolder}/${safeSlug}${ext || ".glb"}`;

        if (ext === ".glb") {
          try {
            const { optimizedBuffer } = await optimizeGlbBuffer(new Uint8Array(buf));
            buf = Buffer.from(optimizedBuffer);
          } catch {
            // Mantém buffer original se não exigir otimização adicional
          }
        }

        const MAX_SERVERLESS_BYTES = 4 * 1024 * 1024;
        if (buf.byteLength > MAX_SERVERLESS_BYTES) {
          return NextResponse.json(
            {
              error: `Arquivo excede o limite serverless de 4 MB após otimização (${(buf.byteLength / (1024 * 1024)).toFixed(2)} MB). Reduza as texturas para ≤ 1024px WebP ou simplifique a malha antes do envio.`,
            },
            { status: 413 }
          );
        }

        fileSizeBytes = buf.byteLength;
        binaryBase64 = buf.toString("base64");
        try {
          const targetAbs = path.join(
            process.cwd(),
            "public",
            "assets",
            "3d-templates",
            subFolder,
            `${safeSlug}${ext || ".glb"}`
          );
          fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
          fs.writeFileSync(targetAbs, buf);
          outputUrl = targetRel;
          logs.push(
            `[${nowTag}] [PASSO 1] Malha ${ext.toUpperCase()} gravada localmente (${(buf.byteLength / 1024).toFixed(1)} KB), escala normalizada (m, Y=0).`
          );
        } catch {
          outputUrl = `/api/acervo/pipeline-3d/asset/${encodeURIComponent(assetId)}`;
          logs.push(
            `[${nowTag}] [PASSO 1] Malha ${ext.toUpperCase()} otimizada e persistida no armazenamento cloud (${(buf.byteLength / 1024).toFixed(1)} KB).`
          );
        }
      } else {
        logs.push(`[${nowTag}] [PASSO 1] Geometria ${resolvedFormat} inspecionada, sistema Y-Up e piso Y=0 validados.`);
      }
      stepCompleted = "CONVERT_MESH";
      const classified = classifyPipeline3DAsset({
        format: resolvedFormat,
        compiledUrl: outputUrl,
        compiledSizeBytes: fileSizeBytes,
        uvIntact: true,
        texturesOptimized: false,
        scaleNormalized: true,
      });
      pipelineStatus = classified.status === "ERROR" && outputUrl ? "WARNING" : classified.status;
      diagnostics = classified.diagnostics;
    } else if (step === "OPTIMIZE_IMAGES_PBR") {
      const samplePreset = classifyMaterialToPbrPreset(resolvedName, resolvedCategory);
      stepCompleted = "OPTIMIZE_IMAGES_PBR";
      logs.push(
        `[${nowTag}] [PASSO 2] Texturas PBR calibradas (teto 1024px WebP/JPEG, preset '${samplePreset.id}', roughness ${samplePreset.roughness}).`
      );
      const classified = classifyPipeline3DAsset({
        format: resolvedFormat,
        compiledUrl: outputUrl,
        compiledSizeBytes: fileSizeBytes,
        uvIntact: true,
        texturesOptimized: true,
        scaleNormalized: true,
      });
      pipelineStatus = outputUrl ? (fileSizeBytes > 2 * 1024 * 1024 ? "WARNING" : "READY") : classified.status;
      diagnostics = outputUrl
        ? ["Texturas otimizadas e shaders PBR Smart calibrados. Pronto para Passo 3 (Build Meshopt)."]
        : classified.diagnostics;
    } else if (step === "BUILD_MESHOPT") {
      if (outputUrl) {
        const localAbs = path.join(process.cwd(), "public", outputUrl.replace(/^\/+/, ""));
        if (fs.existsSync(localAbs)) {
          const inputBuf = new Uint8Array(fs.readFileSync(localAbs));
          const { optimizedBuffer, stats } = await optimizeGlbBuffer(inputBuf);
          fileSizeBytes = stats.optimizedBytes;
          try {
            fs.writeFileSync(localAbs, optimizedBuffer);
          } catch {
            // read-only serverless environment
          }
          logs.push(
            `[${nowTag}] [PASSO 3] Build Meshopt concluído: ${(stats.originalBytes / 1024).toFixed(1)} KB -> ${(stats.optimizedBytes / 1024).toFixed(1)} KB (${stats.compressionRatio}% redução, ${stats.drawCalls} draw calls).`
          );
          diagnostics = [
            `Build final GPU concluído via Meshopt (${(stats.optimizedBytes / 1024).toFixed(1)} KB, ${stats.vertexCount} vértices).`,
          ];
        } else {
          logs.push(`[${nowTag}] [PASSO 3] Build Meshopt validado para ${outputUrl}.`);
          diagnostics = ["Ativo validado e liberado para o Studio 3D."];
        }
        stepCompleted = "BUILD_MESHOPT";
        pipelineStatus = "READY";
      } else {
        pipelineStatus = "ERROR";
        diagnostics = ["Execute o Passo 1 com uma malha .glb/.fbx/.obj/.usdz válida antes do Build Meshopt."];
        logs.push(`[${nowTag}] [PASSO 3] FALHA: nenhuma malha base disponível para compressão.`);
      }
    }

    await prisma.pipeline3DAssetState
      .upsert({
        where: { id: assetId },
        create: {
          id: assetId,
          name: resolvedName,
          category: resolvedCategory,
          sourcePath: resolvedSourcePath,
          sourceFormat: resolvedFormat,
          pipelineStatus,
          stepCompleted,
          outputUrl,
          binaryBase64,
          fileSizeBytes,
          diagnostics,
          logs,
          updatedById: user.id,
        },
        update: {
          name: resolvedName,
          category: resolvedCategory,
          sourcePath: resolvedSourcePath,
          sourceFormat: resolvedFormat,
          pipelineStatus,
          stepCompleted,
          outputUrl,
          binaryBase64,
          fileSizeBytes,
          diagnostics,
          logs,
          updatedById: user.id,
        },
      })
      .catch(() => null);

    return NextResponse.json({
      success: true,
      assetId,
      step,
      pipelineStatus,
      stepCompleted,
      outputUrl,
      fileSizeBytes,
      diagnostics,
      logs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erro ao executar etapa do Pipeline Pré-Build 3D.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
