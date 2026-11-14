import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/server/auth";
import { getAcervoProjectWorkspaceData } from "@/server/services/acervo-cde-service";
import { AcervoProjectDetailView } from "@/components/acervo/acervo-project-detail-view";

export const dynamic = "force-dynamic";

export default async function AdminAcervoProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requirePageRole("ADMIN");
  const { projectId } = await params;

  const project = await getAcervoProjectWorkspaceData(projectId);
  if (!project) {
    notFound();
  }

  return (
    <AppShell eyebrow="Acervo Manager CDE">
      <AcervoProjectDetailView project={project} basePath="/admin" userRole="ADMIN" />
    </AppShell>
  );
}
