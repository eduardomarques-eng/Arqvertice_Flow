import { AppShell } from "@/components/app-shell";
import { SketchfabViewer } from "@/components/3d/sketchfab-viewer";
import { requirePageTeamRole } from "@/server/auth";
import { prisma } from "@/server/db";

export const metadata = {
  title: "Visualizador 3D — Equipe ArqVértice Flow",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Equipe3DViewerPage({
  searchParams,
}: {
  searchParams: Promise<{
    assetId?: string;
    projectId?: string;
    file?: string;
    title?: string;
  }>;
}) {
  const user = await requirePageTeamRole();
  const { assetId, projectId, file, title } = await searchParams;

  const projectAccessFilter =
    user.role === "ADMIN"
      ? undefined
      : {
          OR: [
            ...(user.clientId ? [{ clientId: user.clientId }] : []),
            { access: { some: { userId: user.id } } },
          ],
        };

  const assets = await prisma.project3DAsset.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(projectAccessFilter ? { project: projectAccessFilter } : {}),
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      glbUrl: true,
      project: { select: { name: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    take: 40,
  });

  return (
    <AppShell eyebrow="Visualizador 3D" role={user.role}>
      <SketchfabViewer
        initialAssets={assets.map((a) => ({
          id: a.id,
          title: a.title,
          projectId: a.projectId,
          projectName: a.project?.name || "Projeto",
          glbUrl: a.glbUrl,
        }))}
        initialAssetId={assetId}
        initialProjectId={projectId}
        initialFileUrl={file}
        initialTitle={title}
      />
    </AppShell>
  );
}
