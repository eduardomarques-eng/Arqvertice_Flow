import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/server/db";
import { requirePageRole } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminRelatoriosPage() {
  await requirePageRole("ADMIN");

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      stages: { select: { id: true, completion: true, status: true } },
      deliverables: { select: { id: true, isClientView: true, status: true } },
    },
  });

  return (
    <AppShell eyebrow="Gestão Executiva">
      <div className="mx-auto max-w-6xl px-4 py-6 font-sans">
        <div className="border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Dossiês Técnicos
            </span>
            <span className="text-xs font-semibold text-slate-400">· ArqVértice Studio</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Relatórios Técnicos de Acompanhamento Físico
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Acesse a síntese executiva consolidada, parecer técnico dinâmico e matriz de pranchas por projeto.
          </p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const totalStages = project.stages.length;
            const completedStages = project.stages.filter((s) => s.completion === 100).length;
            const avgProgress =
              totalStages > 0
                ? Math.round(
                    project.stages.reduce((acc, s) => acc + s.completion, 0) / totalStages
                  )
                : 0;
            const totalPranchas = project.deliverables.length;
            const pranchasLiberadas = project.deliverables.filter(
              (d) => d.status === "APROVADO_CLIENTE" || d.status === "LIBERADO_OBRA" || d.isClientView
            ).length;

            return (
              <Card
                key={project.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 line-clamp-1">{project.name}</h3>
                      <p className="text-xs text-slate-500">
                        Cliente: <strong className="text-slate-700">{project.client?.name || "Não informado"}</strong>
                      </p>
                    </div>
                    <Badge tone={avgProgress === 100 ? "green" : "blue"}>
                      {avgProgress}%
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Etapas Concluídas:</span>
                      <strong className="text-slate-900">{completedStages}/{totalStages}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Pranchas Liberadas:</span>
                      <strong className="text-emerald-700">{pranchasLiberadas}/{totalPranchas}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                  <a
                    href={`/api/projects/${project.id}/cronograma/relatorio/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    PDF Oficial
                  </a>
                  <Link
                    href={`/admin/projetos/${project.id}/relatorio`}
                    className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    Ver Relatório →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

