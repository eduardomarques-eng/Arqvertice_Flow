import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { getUserFeatureVisibility, requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { seedAcervoManagerDemo } from "@/server/services/acervo-seed";
import {
  Viewer3DHub,
  type Viewer3DProjectOption,
} from "@/components/viewer-3d/viewer-3d-hub";

export const metadata = {
  title: "3D Viewer — Workflow Hierárquico (Importação, Tratamento, Workspace & Exportação)",
};
export const dynamic = "force-dynamic";

export default async function Admin3DViewerPage() {
  const user = await requirePageRole("ADMIN");
  await seedAcervoManagerDemo();

  const [rawProjects, governance] = await Promise.all([
    prisma.project.findMany({
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
    <AppShell eyebrow="3D Viewer">
      <SectionHeading
        title="3D Viewer — Hub de Ingestão, Tratamento, Visualização & Exportação"
        description="Ambiente dedicado e desacoplado do Acervo Manager para importação de modelos (.glb, .usdz, .fbx), otimização PBR/Meshopt com Mini-Preview (dpr=0.5), montagem de cena procedural e geração de renders."
      />
      <div className="mt-6">
        <Viewer3DHub
          basePath="/admin"
          projects={projects}
          governance={governance}
          userRole={user.role}
        />
      </div>
    </AppShell>
  );
}
