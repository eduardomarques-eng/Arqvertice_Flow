import { redirect } from "next/navigation";
import {
  canUserAccessProject,
  currentUser,
  getUserFeatureVisibility,
} from "@/server/auth";
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
  title: "3D Viewer Workspace — Céu/Chão Procedural, Câmera Livre & RFIs | ArqVértice Flow",
};
export const dynamic = "force-dynamic";

export default async function Viewer3DWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string; returnTo?: string }>;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const { projectId, returnTo } = await searchParams;
  const governance = await getUserFeatureVisibility(user.id, user.role);

  const defaultReturnHref =
    user.role === "ADMIN" ? "/admin/3d-viewer" : "/equipe/3d-viewer";

  const safeReturnHref =
    returnTo &&
    (returnTo.startsWith("/admin/3d-viewer") ||
      returnTo.startsWith("/equipe/3d-viewer") ||
      returnTo.startsWith("/admin/acervo") ||
      returnTo.startsWith("/equipe/acervo"))
      ? returnTo
      : defaultReturnHref;

  if (projectId && projectId !== "ALL") {
    const allowed = await canUserAccessProject(user, projectId);
    if (!allowed) {
      redirect(defaultReturnHref);
    }
  }

  let resolvedAsset: Studio3DAssetInput | null = null;
  let projectAssets: Studio3DAssetInput[] = [];

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (isUuid) {
    const dbAsset = await prisma.project3DAsset.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });

    if (dbAsset) {
      const allowed = await canUserAccessProject(user, dbAsset.projectId);
      if (!allowed) {
        redirect(defaultReturnHref);
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

  const targetProjectId =
    resolvedAsset?.projectId || (projectId && projectId !== "ALL" ? projectId : undefined);
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

  if (!resolvedAsset) {
    const tpl =
      findTemplate3DModel(id) || DEFAULT_3D_TEMPLATES_MANIFEST.models[0];
    resolvedAsset = {
      id: tpl.id,
      projectId: targetProjectId ?? null,
      projectName: "3D Viewer Workspace",
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
    <main className="h-dvh w-screen overflow-hidden bg-[#09090B]">
      <Studio3DFullscreenLoader
        initialAsset={resolvedAsset}
        availableAssets={projectAssets}
        returnHref={safeReturnHref}
        returnLabel="Voltar ao 3D Viewer"
        pipelineHref={user.role === "ADMIN" ? "/admin/3d-viewer" : "/equipe/3d-viewer"}
        userRole={user.role}
        governance={governance}
      />
    </main>
  );
}
