import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { canUserAccessProject, requirePageTeamRole } from "@/server/auth";
import { getAcervoProjectWorkspaceData } from "@/server/services/acervo-cde-service";
import { AcervoProjectDetailView } from "@/components/acervo/acervo-project-detail-view";

export const dynamic = "force-dynamic";

export default async function EquipeAcervoProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requirePageTeamRole();
  const { projectId } = await params;

  const allowed = await canUserAccessProject(user, projectId);
  if (!allowed) {
    redirect("/equipe/acervo");
  }

  const project = await getAcervoProjectWorkspaceData(projectId);
  if (!project) {
    notFound();
  }

  return (
    <AppShell eyebrow="Acervo Manager CDE">
      <AcervoProjectDetailView
        project={project}
        basePath="/equipe"
        userRole={user.role === "ADMIN" ? "ADMIN" : "EQUIPE"}
      />
    </AppShell>
  );
}
