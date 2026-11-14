import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { listOperationProjects } from "@/server/services/operation-service";

export const metadata = { title: "Cronograma & Operação — Equipe ArqVértice" };
export const dynamic = "force-dynamic";

export default async function EquipeCronogramaIndexPage() {
  const user = await requirePageTeamRole();
  await requireModuleAccess("cronograma");

  const role = user.role === "ADMIN" ? "ADMIN" : user.role === "EQUIPE" ? "EQUIPE" : "OPERADOR";
  const projects = (await listOperationProjects(user.id, role)) || [];

  return (
    <AppShell eyebrow="Operação Técnica" role={user.role}>
      <SectionHeading
        title="Cronograma & Operação"
        description="Projetos sob sua responsabilidade técnica. Abra o Kanban para gerenciar etapas e entregas operacionais."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto atribuído"
          description="Quando a diretoria atribuir um projeto a você, ele aparecerá aqui com acesso direto ao quadro Kanban."
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const stagesCount = project.stages?.length ?? 0;
            const progress = project.progress ?? 0;
            const overdue = project.overdue ?? 0;

            return (
              <Card key={project.id} className="border-slate-200 bg-white/95">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/equipe/cronograma/${project.id}`}
                      className="font-bold text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {project.name || "Projeto"}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      Cliente: {project.clientName || project.client?.name || "Não informado"}
                    </p>
                  </div>

                  <Badge tone={overdue > 0 ? "red" : progress === 100 ? "green" : "blue"}>
                    {overdue > 0 ? `${overdue} atrasada(s)` : progress === 100 ? "Concluído" : "Em andamento"}
                  </Badge>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>Avanço físico</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500 font-medium">
                    {stagesCount} {stagesCount === 1 ? "etapa" : "etapas"}
                  </span>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/equipe/projetos/${project.id}`}
                      className="font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Ficha técnica →
                    </Link>
                    <Link
                      href={`/equipe/cronograma/${project.id}`}
                      className="font-bold text-blue-600 hover:text-blue-800"
                    >
                      Abrir Kanban →
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
