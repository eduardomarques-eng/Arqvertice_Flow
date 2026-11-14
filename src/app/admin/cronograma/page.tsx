import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { requirePageAdminRole } from "@/server/auth";
import { listOperationProjects } from "@/server/services/operation-service";

export const metadata = { title: "Cronograma & Operação — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminCronogramaPage() {
  const user = await requirePageAdminRole();
  const projects = (await listOperationProjects(user.id, "ADMIN")) || [];

  return (
    <AppShell eyebrow="Operação Executiva" role={user.role}>
      <SectionHeading
        title="Cronograma & Operação"
        description="Visão consolidada de todas as etapas, prazos e entregas dos projetos ativos do estúdio."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto ativo"
          description="Assim que criar um projeto com etapas de cronograma, ele aparecerá aqui para operação."
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
                      href={`/admin/projetos/${project.id}/cronograma`}
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
                    {stagesCount} {stagesCount === 1 ? "etapa" : "etapas"} mapeadas
                  </span>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/projetos/${project.id}/relatorio`}
                      className="font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Relatório →
                    </Link>
                    <Link
                      href={`/admin/projetos/${project.id}/cronograma`}
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
