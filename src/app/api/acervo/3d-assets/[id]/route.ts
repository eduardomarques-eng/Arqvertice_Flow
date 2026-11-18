import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { mapProject3DAssetToDTO as mapAssetToDTO } from "@/server/services/acervo-cde-service";

const AnnotationUpdateSchema = z.object({
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

const CameraPresetUpdateSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  fov: z.number().min(15).max(110).default(42),
});

const PatchAssetSchema = z.object({
  title: z.string().min(2).max(180).optional(),
  description: z.string().max(1000).optional().nullable(),
  glbUrl: z.string().min(1).optional(),
  posterUrl: z.string().optional().nullable(),
  cameraPreset: CameraPresetUpdateSchema.optional(),
  annotations: z.array(AnnotationUpdateSchema).optional(),
  isFeatured: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const found = await prisma.project3DAsset.findUnique({
      where: { id },
    });

    if (!found) {
      return NextResponse.json({ error: "Ativo 3D não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      asset: mapAssetToDTO(found),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar ativo 3D." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
      return NextResponse.json({ error: "Permissão insuficiente para editar ativo 3D." }, { status: 403 });
    }

    const { id } = await params;
    const rawBody = await request.json().catch(() => ({}));
    const parsed = PatchAssetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload inválido.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updated = await prisma.project3DAsset.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.glbUrl !== undefined ? { glbUrl: data.glbUrl } : {}),
        ...(data.posterUrl !== undefined ? { posterUrl: data.posterUrl } : {}),
        ...(data.cameraPreset !== undefined
          ? { cameraPreset: data.cameraPreset as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.annotations !== undefined
          ? { annotations: data.annotations as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      },
    });

    revalidatePath("/admin/3d-viewer");
    revalidatePath("/equipe/3d-viewer");

    return NextResponse.json({
      success: true,
      asset: mapAssetToDTO(updated),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar ativo 3D." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem remover ativos 3D." }, { status: 403 });
    }

    const { id } = await params;
    await prisma.project3DAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao remover ativo 3D." },
      { status: 500 }
    );
  }
}
