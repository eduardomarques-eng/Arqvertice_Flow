import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { getUserFeatureVisibility, requirePageTeamRole } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  Viewer3DHub,
  type Viewer3DProjectOption,
} from "@/components/viewer-3d/viewer-3d-hub";

export const metadata = {
  title: "3D Viewer — Equipe & Clientes | ArqVértice Flow",
};
export const dynamic = "force-dynamic";

export default async function Equipe3DViewerPage() {
  const user = await requirePageTeamRole();

  const projectAccessFilter =
    user.role === "ADMIN"
      ? undefined
      : {
          OR: [
            ...(user.clientId ? [{ clientId: user.clientId }] : []),
            { access: { some: { userId: user.id } } },
          ],
        };

  const [rawProjects, governance] = await Promise.all([
    prisma.project.findMany({
      where: projectAccessFilter,
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    getUserFeatureVisibility(user.id, user.role),
  ]);

  const projects: Viewer3DProjectOption[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || "Cliente",
  }));

  return (
    <AppShell eyebrow="3D Viewer" role={user.role}>
      <SectionHeading
        title="3D Viewer — Visualização & Colaboração Técnica"
        description="Ambiente unificado de visualização 3D governado por ProjectAccess e FeatureVisibility: navegação livre, inspeção de objetos, RFIs em 3D e ajustes procedurais conforme sua permissão."
      />
      <div className="mt-6">
        <Viewer3DHub
          basePath="/equipe"
          projects={projects}
          governance={governance}
          userRole={user.role}
        />
      </div>
    </AppShell>
  );
}
