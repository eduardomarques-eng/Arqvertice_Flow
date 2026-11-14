import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import {
  DEFAULT_SHOWCASE_ANNOTATIONS,
  DEFAULT_SHOWCASE_CAMERA_PRESET,
  DEFAULT_SHOWCASE_OPTIMIZATION_STATS,
} from "@/lib/acervo/showcase-3d-defaults";
import { optimizeGlbBuffer } from "@/lib/acervo/glb-optimizer";
import {
  ensureProject3DShowcase,
  mapProject3DAssetToDTO,
} from "@/server/services/acervo-cde-service";

const AnnotationSchema = z.object({
  id: z.string(),
  index: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  normal: z.tuple([z.number(), z.number(), z.number()]).optional(),
  cameraPosition: z.tuple([z.number(), z.number(), z.number()]),
  cameraTarget: z.tuple([z.number(), z.number(), z.number()]),
  title: z.string().min(1),
  description: z.string().default(""),
  materialSpec: z.string().optional(),
  dimensions: z.string().optional(),
});

const CameraPresetSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  fov: z.number().min(15).max(110).default(42),
});

const CreateAssetSchema = z.object({
  projectId: z.string().uuid(),
  documentId: z.string().uuid().optional().nullable(),
  revisionId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(180),
  description: z.string().max(1000).optional().nullable(),
  glbUrl: z.string().min(1).default("/models/arqvertice-showcase.glb"),
  posterUrl: z.string().optional().nullable(),
  fileSizeBytes: z.number().int().nonnegative().optional().nullable(),
  cameraPreset: CameraPresetSchema.optional(),
  annotations: z.array(AnnotationSchema).optional(),
  isFeatured: z.boolean().optional().default(true),
  base64Glb: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const documentId = searchParams.get("documentId");

    if (!projectId) {
      return NextResponse.json({ error: "Parâmetro projectId é obrigatório." }, { status: 400 });
    }

    const assets = await ensureProject3DShowcase(projectId);
    const filtered = documentId
      ? assets.filter((a) => !a.documentId || a.documentId === documentId)
      : assets;

    return NextResponse.json({ success: true, assets: filtered });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar ativos 3D." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
      return NextResponse.json({ error: "Permissão insuficiente para cadastrar ativo 3D." }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => ({}));

    if (rawBody.action === "presign") {
      const fileName = String(rawBody.fileName || "modelo-otimizado.glb").replace(/[^a-zA-Z0-9._-]/g, "_");
      return NextResponse.json({
        success: true,
        uploadStrategy: process.env.R2_BUCKET_NAME ? "CLOUDFLARE_R2" : "LOCAL_OPTIMIZED_FALLBACK",
        publicUrl: "/models/arqvertice-showcase.glb",
        posterUrl: "/models/arqvertice-showcase-poster.svg",
        fileKey: `3d-assets/${Date.now()}_${fileName}`,
      });
    }

    const parsed = CreateAssetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos para criação do ativo 3D.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    let optimizationStats = DEFAULT_SHOWCASE_OPTIMIZATION_STATS;
    let finalBytes = payload.fileSizeBytes ?? 23352;

    if (payload.base64Glb) {
      try {
        const rawBuf = Buffer.from(payload.base64Glb, "base64");
        const optimized = await optimizeGlbBuffer(new Uint8Array(rawBuf));
        optimizationStats = optimized.stats;
        finalBytes = optimized.stats.optimizedBytes;
      } catch {
        // Fallback seguro
      }
    }

    const created = await prisma.project3DAsset.create({
      data: {
        projectId: payload.projectId,
        documentId: payload.documentId || null,
        revisionId: payload.revisionId || null,
        title: payload.title,
        description: payload.description || null,
        glbUrl: payload.glbUrl || "/models/arqvertice-showcase.glb",
        posterUrl: payload.posterUrl || "/models/arqvertice-showcase-poster.svg",
        fileSizeBytes: finalBytes,
        optimizationStats: optimizationStats as unknown as Prisma.InputJsonValue,
        cameraPreset: (payload.cameraPreset || DEFAULT_SHOWCASE_CAMERA_PRESET) as unknown as Prisma.InputJsonValue,
        annotations: (payload.annotations || DEFAULT_SHOWCASE_ANNOTATIONS) as unknown as Prisma.InputJsonValue,
        isFeatured: payload.isFeatured ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      asset: mapProject3DAssetToDTO(created),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao salvar ativo 3D." },
      { status: 500 }
    );
  }
}
