import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SearchForm } from "@/components/search-form";
import { requirePageRole } from "@/server/auth";
import { listProjects } from "@/server/services/project-service";
import { ProjectsExecutiveGrid, type ProjectCardData } from "@/components/projects/projects-executive-grid";
import { ProjectsBentoDashboard } from "@/components/analytics/ProjectsBentoDashboard";

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
        <>
          <ProjectsBentoDashboard
            projectsOnTime={projects.filter((p) => p.status !== "PAUSED" && p.status !== "CANCELLED").length}
            completedStages={projects.reduce(
              (acc, p) => acc + (p.stages ?? []).filter((s) => s.completion === 100 || s.status === "COMPLETED").length,
              0
            )}
            criticalMilestones7d={projects.reduce((acc, p) => {
              const now = Date.now();
              const in7 = now + 7 * 86_400_000;
              return (
                acc +
                (p.stages ?? []).filter((s) => {
                  if (s.completion === 100 || !s.dueDate) return false;
                  const t = new Date(s.dueDate).getTime();
                  return t >= now && t <= in7;
                }).length
              );
            }, 0)}
            avgDelayDays={0}
            sCurvePoints={[
              { label: "M-3", planned: 25, executed: 22 },
              { label: "M-2", planned: 50, executed: 48 },
              { label: "M-1", planned: 75, executed: 71 },
              {
                label: "Atual",
                planned: 90,
                executed:
                  projects.length > 0
                    ? Math.round(
                      projects.reduce((acc, p) => {
                        const stages = p.stages ?? [];
                        const avg = stages.length
                          ? stages.reduce((s, st) => s + st.completion, 0) / stages.length
                          : 0;
                        return acc + avg;
                      }, 0) / projects.length
                    )
                    : 0,
              },
            ]}
            progressRanking={projects.map((p) => {
              const stages = p.stages ?? [];
              return {
                id: p.id,
                name: p.name,
                clientName: p.client.name,
                progressPct: stages.length
                  ? Math.round(stages.reduce((s, st) => s + st.completion, 0) / stages.length)
                  : 0,
              };
            })}
            stageStatusSlices={[
              {
                id: "done",
                label: "Concluídas",
                value: projects.reduce(
                  (a, p) => a + (p.stages ?? []).filter((s) => s.completion === 100 || s.status === "COMPLETED").length,
                  0
                ),
              },
              {
                id: "inprog",
                label: "Em Andamento",
                value: projects.reduce(
                  (a, p) => a + (p.stages ?? []).filter((s) => s.completion > 0 && s.completion < 100).length,
                  0
                ),
              },
              {
                id: "todo",
                label: "A Iniciar",
                value: projects.reduce(
                  (a, p) => a + (p.stages ?? []).filter((s) => s.completion === 0).length,
                  0
                ),
              },
            ]}
          />
          <ProjectsExecutiveGrid projects={projects} basePath="/admin" />
        </>
      )}
    </AppShell>
  );
}
