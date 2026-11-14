import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SearchForm } from "@/components/search-form";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { listProjects } from "@/server/services/project-service";

export const metadata = { title: "Empreendimentos & Acervo — Equipe ArqVértice" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "blue" | "green" | "amber" | "neutral"> = {
  PLANNING: "amber",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
};

export default async function EquipeProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");

  const { q = "" } = await searchParams;
  const projects = await listProjects(q);

  return (
    <AppShell eyebrow="Acervo Técnico" role={user.role}>
      <SectionHeading
        title="Empreendimentos & Acervo"
        description="Portfólio de projetos do estúdio com consulta de ficha técnica e cronograma."
      />

      <SearchForm action="/equipe/projetos" query={q} placeholder="Buscar por projeto ou cliente" />

      {projects.length === 0 ? (
        <EmptyState
          title={q ? `Nada encontrado para "${q}"` : "Nenhum projeto encontrado"}
          description={
            q
              ? "Tente outra palavra, ou limpe a busca para ver todos os projetos."
              : "Os projetos disponíveis aparecerão aqui."
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="border-slate-200 bg-white/95">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/equipe/projetos/${project.id}`}
                    className="font-bold text-slate-900 hover:text-blue-700 transition-colors"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{project.type || "Sem tipo definido"}</p>
                  <p className="mt-1 text-sm text-slate-500">Cliente: {project.client.name}</p>
                </div>
                <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>{project.status}</Badge>
              </div>

              <div className="mt-4 flex gap-4 text-xs">
                <Link
                  href={`/equipe/cronograma/${project.id}`}
                  className="font-semibold text-blue-600 hover:text-blue-800"
                >
                  Abrir Kanban →
                </Link>
                <Link
                  href={`/equipe/projetos/${project.id}`}
                  className="font-semibold text-slate-600 hover:text-slate-900"
                >
                  Ficha técnica →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
