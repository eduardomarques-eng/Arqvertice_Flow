import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { CentralAcervoView, type AcervoProjectOption, type AcervoDeliverableItem } from "@/components/acervo/central-acervo-view";

export const metadata = { title: "Empreendimentos & Acervo — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminAcervoPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  await requirePageRole("ADMIN");
  const { projectId } = await searchParams;

  const [rawProjects, rawDeliverables] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.projectDeliverable.findMany({
      select: {
        id: true,
        projectId: true,
        sheetCode: true,
        title: true,
        discipline: true,
        phaseFolder: true,
        version: true,
        fileUrl: true,
        fileSize: true,
        status: true,
        isClientView: true,
        createdAt: true,
        project: {
          select: {
            name: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const projects: AcervoProjectOption[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || "Cliente",
  }));

  const deliverables: AcervoDeliverableItem[] = rawDeliverables.map((d) => ({
    id: d.id,
    projectId: d.projectId,
    projectName: d.project.name,
    clientName: d.project.client?.name || "Cliente",
    sheetCode: d.sheetCode || "DOC",
    title: d.title,
    discipline: d.discipline,
    phaseFolder: d.phaseFolder,
    version: d.version,
    fileUrl: d.fileUrl,
    fileSize: d.fileSize,
    status: d.status,
    isClientView: d.isClientView,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <AppShell eyebrow="Acervo Técnico">
      <SectionHeading
        title="Empreendimentos & Acervo Técnico"
        description="Repositório centralizado de pranchas, plantas e arquivos técnicos com filtros por empreendimento, disciplina, fase e controle de liberação."
      />
      <div className="mt-6">
        <CentralAcervoView
          projects={projects}
          deliverables={deliverables}
          basePath="/admin"
          initialProjectId={projectId}
        />
      </div>
    </AppShell>
  );
}
