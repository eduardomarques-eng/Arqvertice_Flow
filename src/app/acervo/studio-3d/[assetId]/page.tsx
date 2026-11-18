import { redirect } from "next/navigation";
import { canUserAccessProject, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  DEFAULT_3D_TEMPLATES_MANIFEST,
  findTemplate3DModel,
} from "@/lib/acervo/scene-compiler";
import {
  ensureProject3DShowcase,
  mapProject3DAssetToDTO,
} from "@/server/services/acervo-cde-service";
import { Studio3DFullscreenLoader } from "@/components/acervo/studio-3d-fullscreen-loader";
import type { Studio3DAssetInput } from "@/engines/studio-3d/Studio3DFullscreenEngine";

export const metadata = {
  title: "Ambiente 3D Isolado — Acervo Manager | ArqVértice Flow",
};
export const dynamic = "force-dynamic";

export default async function AcervoStudio3DFullscreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ projectId?: string; returnTo?: string }>;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/login");
  }

  const { assetId } = await params;
  const { projectId, returnTo } = await searchParams;

  const defaultReturnHref =
    user.role === "ADMIN"
      ? projectId
        ? `/admin/acervo/${projectId}`
        : "/admin/acervo"
      : projectId
      ? `/equipe/acervo/${projectId}`
      : "/equipe/acervo";

  const safeReturnHref =
    returnTo && (returnTo.startsWith("/admin/acervo") || returnTo.startsWith("/equipe/acervo"))
      ? returnTo
      : defaultReturnHref;

  // Se houver projectId, verifica permissão estrita por empreendimento (ProjectAccess)
  if (projectId) {
    const allowed = await canUserAccessProject(user, projectId);
    if (!allowed) {
      redirect(user.role === "ADMIN" ? "/admin/acervo" : "/equipe/acervo");
    }
  }

  let resolvedAsset: Studio3DAssetInput | null = null;
  let projectAssets: Studio3DAssetInput[] = [];

  // 1. Verifica se assetId corresponde a um registro Project3DAsset no banco
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    assetId
  );

  if (isUuid) {
    const dbAsset = await prisma.project3DAsset.findUnique({
      where: { id: assetId },
      include: { project: { select: { id: true, name: true } } },
    });

    if (dbAsset) {
      const allowed = await canUserAccessProject(user, dbAsset.projectId);
      if (!allowed) {
        redirect(user.role === "ADMIN" ? "/admin/acervo" : "/equipe/acervo");
      }
      const dto = mapProject3DAssetToDTO(dbAsset);
      const matchedTpl = findTemplate3DModel(dto.glbUrl);
      resolvedAsset = {
        id: dto.id,
        projectId: dto.projectId,
        projectName: dbAsset.project.name,
        title: dto.title,
        description: dto.description,
        category: matchedTpl?.category || "ARQUITETURA & BIM 3D",
        sourcePath: matchedTpl?.sourcePath || dto.glbUrl,
        glbUrl: dto.glbUrl,
        posterUrl: dto.posterUrl,
        defaultHdriId: matchedTpl?.defaultHdriId || "dia-claro",
        firstPersonCamera: matchedTpl?.normalization.firstPersonCamera,
        thirdPersonCamera: matchedTpl?.normalization.thirdPersonCamera || {
          position: dto.cameraPreset.position,
          target: dto.cameraPreset.target,
          fov: dto.cameraPreset.fov,
        },
        annotations: dto.annotations,
        stats: {
          originalBytes: dto.optimizationStats?.originalBytes,
          optimizedBytes: dto.optimizationStats?.optimizedBytes,
          drawCalls: dto.optimizationStats?.drawCalls,
          triangles: dto.optimizationStats?.vertexCount
            ? Math.round(dto.optimizationStats.vertexCount / 3)
            : undefined,
        },
      };
    }
  }

  // 2. Se houver projectId, carrega os demais ativos 3D do projeto para troca rápida no Studio
  const targetProjectId = resolvedAsset?.projectId || projectId;
  if (targetProjectId && /^[0-9a-f-]{36}$/i.test(targetProjectId)) {
    const allowed = await canUserAccessProject(user, targetProjectId);
    if (allowed) {
      const ensured = await ensureProject3DShowcase(targetProjectId);
      projectAssets = ensured.map((dto) => {
        const matchedTpl = findTemplate3DModel(dto.glbUrl);
        return {
          id: dto.id,
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description,
          category: matchedTpl?.category || "MODELO 3D DO PROJETO",
          sourcePath: matchedTpl?.sourcePath || dto.glbUrl,
          glbUrl: dto.glbUrl,
          posterUrl: dto.posterUrl,
          defaultHdriId: matchedTpl?.defaultHdriId || "dia-claro",
          firstPersonCamera: matchedTpl?.normalization.firstPersonCamera,
          thirdPersonCamera: matchedTpl?.normalization.thirdPersonCamera || {
            position: dto.cameraPreset.position,
            target: dto.cameraPreset.target,
            fov: dto.cameraPreset.fov,
          },
          annotations: dto.annotations,
          stats: {
            originalBytes: dto.optimizationStats?.originalBytes,
            optimizedBytes: dto.optimizationStats?.optimizedBytes,
            drawCalls: dto.optimizationStats?.drawCalls,
            triangles: dto.optimizationStats?.vertexCount
              ? Math.round(dto.optimizationStats.vertexCount / 3)
              : undefined,
          },
        };
      });
    }
  }

  // 3. Caso assetId seja um slug/id de template compilado (ex: cozinha-interna, tpl-cozinha-interna, etc.)
  if (!resolvedAsset) {
    const tpl =
      findTemplate3DModel(assetId) || DEFAULT_3D_TEMPLATES_MANIFEST.models[0];
    resolvedAsset = {
      id: tpl.id,
      projectId: targetProjectId ?? null,
      projectName: "Acervo Manager CDE",
      title: tpl.title,
      description: tpl.subtitle,
      category: tpl.category,
      sourcePath: tpl.sourcePath,
      glbUrl: tpl.glbUrl,
      usdzUrl: tpl.usdzUrl ?? null,
      status: tpl.status ?? (tpl.glbUrl ? "READY" : "NEEDS_EXPORT"),
      diagnostics: tpl.diagnostics,
      posterUrl: tpl.posterUrl,
      defaultHdriId: tpl.defaultHdriId,
      firstPersonCamera: tpl.normalization.firstPersonCamera,
      thirdPersonCamera: tpl.normalization.thirdPersonCamera,
      annotations: tpl.annotations,
      stats: {
        originalBytes: tpl.optimizationStats.originalBytes,
        optimizedBytes: tpl.optimizationStats.optimizedBytes,
        drawCalls: tpl.optimizationStats.drawCalls,
        triangles: Math.round(tpl.optimizationStats.vertexCount / 3),
      },
    };
  }

  return (
    <main className="h-dvh w-screen overflow-hidden bg-[#111215]">
      <Studio3DFullscreenLoader
        initialAsset={resolvedAsset}
        availableAssets={projectAssets}
        returnHref={safeReturnHref}
        returnLabel="Voltar ao Acervo"
        pipelineHref={user.role === "ADMIN" ? "/admin/acervo/pipeline-3d" : "/equipe/acervo/pipeline-3d"}
        userRole={user.role}
      />
    </main>
  );
}
