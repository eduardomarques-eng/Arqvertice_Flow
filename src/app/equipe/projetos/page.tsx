import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SearchForm } from "@/components/search-form";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { listProjects } from "@/server/services/project-service";
import { ProjectsExecutiveGrid, type ProjectCardData } from "@/components/projects/projects-executive-grid";

export const metadata = { title: "Projetos Ativos — Equipe ArqVértice" };
export const dynamic = "force-dynamic";

export default async function EquipeProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");

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
    <AppShell eyebrow="Operação Técnica" role={user.role}>
      <SectionHeading
        title="Projetos & Empreendimentos"
        description="Gestão operacional dos projetos com acesso direto à ficha técnica, quadro Kanban e acervo técnico."
      />

      <div className="mb-6">
        <SearchForm action="/equipe/projetos" query={q} placeholder="Buscar por projeto ou cliente..." />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={q ? `Nada encontrado para "${q}"` : "Nenhum projeto atribuído"}
          description={
            q
              ? "Tente outra palavra ou limpe a busca para visualizar outros projetos."
              : "Os projetos atribuídos à equipe técnica aparecerão aqui."
          }
        />
      ) : (
        <ProjectsExecutiveGrid projects={projects} basePath="/equipe" />
      )}
    </AppShell>
  );
}
