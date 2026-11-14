import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SearchForm } from "@/components/search-form";
import { requirePageRole } from "@/server/auth";
import { listProjects } from "@/server/services/project-service";
import { ProjectsExecutiveGrid, type ProjectCardData } from "@/components/projects/projects-executive-grid";

export const metadata = { title: "Projetos Ativos — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageRole("ADMIN");
  const { q = "" } = await searchParams;
  const rawProjects = await listProjects(q);

  const projects: ProjectCardData[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    status: p.status,
    startDate: p.startDate,
    expectedEndDate: p.expectedEndDate,
    client: {
      name: p.client.name,
      phone: p.client.phone,
      email: p.client.email,
    },
    stages: (p.stages || []).map((s) => ({
      id: s.id,
      completion: s.completion,
      status: s.status,
      dueDate: s.dueDate,
    })),
    team: (p.access || []).map((a) => ({
      id: a.user.id,
      name: a.user.name,
      role: a.user.role,
    })),
  }));

  return (
    <AppShell eyebrow="Gestão Executiva">
      <SectionHeading
        title="Projetos & Empreendimentos"
        description="Gestão operacional e executiva dos projetos em andamento, avanço físico e equipe técnica alocada."
      />

      <div className="mb-6">
        <SearchForm action="/admin/projetos" query={q} placeholder="Buscar por projeto ou cliente..." />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={q ? `Nada encontrado para "${q}"` : "Nenhum projeto cadastrado"}
          description={
            q
              ? "Tente outra palavra ou limpe a busca para visualizar todos os projetos."
              : "Assim que cadastrar um novo projeto no estúdio, ele será exibido aqui."
          }
        />
      ) : (
        <ProjectsExecutiveGrid projects={projects} basePath="/admin" />
      )}
    </AppShell>
  );
}
