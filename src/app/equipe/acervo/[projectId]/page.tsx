import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageTeamRole } from "@/server/auth";
import { getEffectivePermissions } from "@/lib/rbac";
import { getAcervoProjectWorkspaceData } from "@/server/services/acervo-cde-service";
import { AcervoProjectDetailView } from "@/components/acervo/acervo-project-detail-view";

export const dynamic = "force-dynamic";

export default async function EquipeAcervoProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requirePageTeamRole();
  if (user.role !== "ADMIN" && !getEffectivePermissions(user).includes("acervo")) {
    redirect("/equipe");
  }
  const { projectId } = await params;

  const project = await getAcervoProjectWorkspaceData(projectId);
  if (!project) {
    notFound();
  }

  return (
    <AppShell eyebrow="Acervo Manager CDE" role={user.role}>
      <AcervoProjectDetailView project={project} basePath="/equipe" userRole={user.role} />
    </AppShell>
  );
}
