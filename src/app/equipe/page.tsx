import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { listOperationProjects } from "@/server/services/operation-service";
import { completionOf } from "@/lib/progress";

export const dynamic = "force-dynamic";

type AddressLike = {
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  lote?: string | null;
  quadra?: string | null;
  areaConstruida?: number | null;
  areaTerreno?: number | null;
} | null;

function asAddress(value: unknown): AddressLike {
  if (!value || typeof value !== "object") return null;
  return value as AddressLike;
}

function formatAddress(project: { address: unknown; client: { city?: string | null; state?: string | null } }) {
  const addr = asAddress(project.address);
  const parts = [
    addr?.lote ? `Lote ${addr.lote}` : null,
    addr?.quadra ? `Quadra ${addr.quadra}` : null,
    addr?.neighborhood ?? project.client.city,
    addr?.city ?? project.client.state,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Endereço não informado";
}

function formatAreas(project: { address: unknown }) {
  const addr = asAddress(project.address);
  const construida = addr?.areaConstruida != null ? `${addr.areaConstruida.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² construídos` : null;
  const terreno = addr?.areaTerreno != null ? `Terreno de ${addr.areaTerreno.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : null;
  const parts = [construida, terreno].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Áreas não informadas";
}

export default async function TeamPortalPage() {
  const user = await requirePageTeamRole();
  // ENGENHEIRO e ARQUITETO têm acesso equivalente ao OPERADOR no contexto de equipe
  const role: "ADMIN" | "EQUIPE" | "OPERADOR" =
    user.role === "ADMIN" ? "ADMIN" : user.role === "EQUIPE" ? "EQUIPE" : "OPERADOR";
  const projects = await listOperationProjects(user.id, role);

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);

  let totalStages = 0;
  let dueInSevenDays = 0;
  const completedByDiscipline = new Map<string, number>();

  for (const project of projects) {
    totalStages += project.stages.length;
    for (const stage of project.stages) {
      if (stage.status === "COMPLETED" || stage.completion === 100) {
        const key = (stage.discipline ?? "Geral").trim() || "Geral";
        completedByDiscipline.set(key, (completedByDiscipline.get(key) ?? 0) + 1);
        continue;
      }
      if (!stage.dueDate) continue;
      const due = new Date(stage.dueDate);
      if (due >= now && due <= sevenDaysLater) dueInSevenDays += 1;
    }
  }

  const activeProjects = projects.filter((project) => project.status === "IN_PROGRESS" || project.status === "PLANNING");

  return (
    <AppShell eyebrow="Equipe técnica" role={user.role}>
      <SectionHeading title={`Olá, ${user.name}`} description="Acompanhe os projetos atribuídos à equipe, o avanço operacional por disciplina e os prazos de entrega. Sem dados comerciais." />

      {projects.length === 0 ? (
        <EmptyState title="Nenhum projeto atribuído" description="Os projetos liberados pelo administrador aparecerão aqui." />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Etapas atribuídas</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{totalStages}</p>
            </Card>
            <Card className="border-slate-200 bg-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entregas nos próximos 7 dias</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{dueInSevenDays}</p>
            </Card>
            <Card className="border-slate-200 bg-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projetos ativos</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{activeProjects.length}</p>
            </Card>
            <Card className="border-slate-200 bg-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Andamento médio</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{Math.round(completionOf(projects.flatMap((p) => p.stages)))}</p>
            </Card>
          </div>

          {completedByDiscipline.size > 0 && (
            <Card className="mt-6 border-slate-200 bg-white/90">
              <h2 className="font-semibold text-slate-950">Etapas concluídas por disciplina</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[...completedByDiscipline.entries()].map(([discipline, count]) => (
                  <div key={discipline} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <span className="text-sm text-slate-600">{discipline}</span>
                    <span className="text-sm font-semibold text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <SectionHeading title="Projetos da equipe" description="Clique em um projeto para ver a ficha técnica, dados do cliente e abrir o kanban operacional." />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <Card key={project.id} className="border-slate-200 bg-white/90">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/equipe/projetos/${project.id}`} className="text-lg font-semibold text-slate-950 hover:text-blue-700">
                      {project.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {project.clientName}{project.clientName ? " · " : ""}
                      {project.status === "IN_PROGRESS" ? "Em execução" : "Planejamento"}
                    </p>
                  </div>
                  <Badge tone={project.overdue ? "red" : "green"}>
                    {project.overdue ? `${project.overdue} atrasada(s)` : "Em dia"}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Localização</span>
                    <span className="font-medium text-slate-800">{formatAddress(project)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Áreas</span>
                    <span className="font-medium text-slate-800">{formatAreas(project)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contato do cliente</span>
                    <span className="font-medium text-slate-800">{project.clientName}</span>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${project.progress}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm font-semibold">
                  <Link href={`/equipe/projetos/${project.id}`} className="text-slate-700 hover:text-slate-950">Ficha técnica</Link>
                  <Link href={`/equipe/cronograma/${project.id}`} className="text-blue-600 hover:text-blue-700">Abrir kanban →</Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
