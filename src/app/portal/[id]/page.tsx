import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  requirePageClientPortal,
  requirePageProjectAccess,
  isClientRole,
} from "@/server/auth";
import { prisma } from "@/server/db";
import { completionOf, progressByDiscipline } from "@/lib/progress";
import { disciplineColor } from "@/lib/discipline-colors";

export const dynamic = "force-dynamic";

function disciplineLabel(discipline: string | null): string {
  const key = (discipline ?? "").trim();
  const normalized = key
    .replace(/^3D$/i, "Projeto 3D")
    .replace(/^Interiores$/i, "Projeto 3D")
    .replace(/^Estrutural$/i, "Estrutura")
    .replace(/^Obras$/i, "Obra");
  return [
    "Arquitetura",
    "Projeto 3D",
    "Estrutura",
    "Complementares",
    "Obra",
  ].includes(normalized)
    ? normalized
    : key || "Geral";
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePageClientPortal();
  const user = await requirePageProjectAccess(id);
  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      startDate: true,
      expectedEndDate: true,
      status: true,
      client: { select: { name: true } },
      stages: {
        orderBy: { order: "asc" },
        select: {
          name: true,
          discipline: true,
          completion: true,
          dueDate: true,
          status: true,
        },
      },
    },
  });
  if (!project) {
    return (
      <AppShell eyebrow="Portal do cliente" environment="client">
        <EmptyState
          title="Projeto ainda sem dados"
          description="Assim que o estúdio publicar o cronograma, ele aparece aqui."
        />
      </AppShell>
    );
  }
  const progress = completionOf(project.stages);
  const byDiscipline = progressByDiscipline(project.stages).map((row) => ({
    ...row,
    label: disciplineLabel(row.discipline),
    color: disciplineColor(row.discipline),
  }));
  const visibleStages = project.stages.slice(0, 5);
  const isClient = isClientRole(user.role);

  return (
    <AppShell eyebrow="Portal do cliente" environment="client" role={user.role}>
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-medium text-slate-500">
          Olá, {project.client.name}. Acompanhe em tempo real o desenvolvimento
          da sua {project.name}.
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {project.name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Informações operacionais atualizadas em tempo real pela equipe
          ArqVértice.
        </p>

        <Card className="mt-8 border-slate-200 bg-white/90">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Andamento geral</p>
              <h2 className="mt-1 text-3xl font-bold text-slate-950">
                {progress}%
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Fase:{" "}
                <span className="font-medium text-slate-700">
                  {project.status === "IN_PROGRESS"
                    ? "Em execução"
                    : project.status === "PLANNING"
                      ? "Planejamento"
                      : project.status === "COMPLETED"
                        ? "Concluído"
                        : project.status}
                </span>
              </p>
            </div>
            <Badge tone={progress === 100 ? "green" : "blue"}>
              {project.stages.filter((stage) => stage.completion === 100).length} de{" "}
              {project.stages.length} etapas concluídas
            </Badge>
          </div>
          <div className="mt-6"><Progress value={progress} /></div>
          <p className="mt-4 text-sm text-slate-500">
            Previsão contratual:{space()}
            {project.startDate?.toLocaleDateString("pt-BR") ?? "—"} a{" "}
            {project.expectedEndDate?.toLocaleDateString("pt-BR") ?? "—"}
          </p>
        </Card>

        <Card className="mt-5 border-slate-200 bg-white/90">
          <h2 className="font-semibold text-slate-950">Avanço por disciplina</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {byDiscipline.map(({ discipline, progress: value, label, color }) => (
              <div key={discipline}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600">{label}</span>
                  <strong className={color.text}>{value}%</strong>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] ${color.progress}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-5 border-slate-200 bg-white/90">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Próximas etapas</h2>
            <Link href={`/portal/${id}/cronograma`} className="text-sm font-semibold text-blue-600">
              Ver cronograma completo →
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {visibleStages.map((stage) => (
              <div
                key={stage.name}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">{stage.name}</p>
                  <p className="text-xs text-slate-400">
                    {stage.dueDate?.toLocaleDateString("pt-BR") ??
                      "Prazo a definir"}
                  </p>
                </div>
                <Badge
                  tone={
                    stage.completion === 100
                      ? "green"
                      : stage.completion > 0
                        ? "blue"
                        : "neutral"
                  }
                >
                  {stage.completion}%
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {isClient ? (
          <Link
            href={`/portal/${id}/briefing`}
            className="mt-5 block rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-800"
          >
            Editar respostas e adicionar observações ao briefing{" "}
            <span className="float-right">→</span>
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}

function space() {
  return <span> </span>;
}

