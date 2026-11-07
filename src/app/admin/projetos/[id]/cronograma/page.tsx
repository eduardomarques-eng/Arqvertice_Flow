import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { ScheduleStageCreateForm } from "@/components/schedule/schedule-stage-create-form";
import { KanbanBoardView } from "@/components/schedule/kanban-board";
import { requirePageProjectAccess } from "@/server/auth";
import { kanbanBoard } from "@/server/services/schedule-service";
import { DUE_SOON_DAYS } from "@/lib/schedule-alerts";

export const dynamic = "force-dynamic";

const DISCIPLINE_LABEL: Record<string, string> = {
  Arquitetura: "Arquitetura (Eduardo)",
  "3D": "Projeto 3D (Eduardo)",
  Estrutura: "Estrutura (Luan)",
  Complementares: "Complementares (Eduardo)",
  Obras: "Execução da Obra (Erick)",
};

export default async function CronogramaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageProjectAccess(id);
  const board = await kanbanBoard(id);
  const allCards = board.columns.flatMap((column) => column.cards);
  const disciplineRows = Object.entries(
    allCards.reduce<Record<string, { total: number; completed: number; progress: number }>>((result, card) => {
      const key = card.discipline ?? "Geral";
      const row = result[key] ?? { total: 0, completed: 0, progress: 0 };
      row.total += 1;
      row.completed += card.completion === 100 ? 1 : 0;
      row.progress += card.completion;
      result[key] = row;
      return result;
    }, {}),
  );
  return (
    <AppShell eyebrow="Cronograma" role={user.role}>
      <Link
        href={user.role === "ADMIN" ? `/projetos/${id}` : "/operacao"}
        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        {user.role === "ADMIN" ? "← Voltar ao projeto" : "← Voltar à operação"}
      </Link>

      <SectionHeading
        title={`Cronograma — ${board.project.name}`}
        description="Cada etapa aparece numa única coluna, pelo seu estado real. O aviso vem da regra única de alertas."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={board.totals.overdue > 0 ? "red" : "green"}>
              {board.totals.overdue > 0 ? `${board.totals.overdue} atrasada(s)` : "Sem atrasos"}
            </Badge>
            {board.alerts.blocked > 0 ? <Badge tone="amber">{board.alerts.blocked} bloqueada(s)</Badge> : null}
            {board.alerts.dueSoon > 0 ? (
              <Badge tone="amber">
                {board.alerts.dueSoon} com prazo ≤ {DUE_SOON_DAYS} dias
              </Badge>
            ) : null}
            <Badge tone="blue">{board.totals.completion}%</Badge>
            <Badge tone="neutral">{board.totals.stages - (board.columns.find((column) => column.id === "COMPLETED")?.cards.length ?? 0)} pendente(s)</Badge>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>{board.totals.stages} marcos</span>
        <span>{board.columns.find((column) => column.id === "COMPLETED")?.cards.length ?? 0} concluído(s)</span>
        <span>{board.totals.attention} em atenção</span>
        <a href={`/api/projects/${id}/cronograma/relatorio/pdf`} className="font-semibold text-blue-600 hover:text-blue-700">
          Exportar relatório PDF
        </a>
        <ScheduleStageCreateForm projectId={id} />
        {user.role === "ADMIN" ? (
          <Link href={`/admin/projetos/${id}/relatorio`} className="font-semibold text-blue-600 hover:text-blue-700">
            Relatório do cronograma →
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-slate-900 bg-slate-950 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Geral</p>
          <p className="mt-2 text-2xl font-bold">{board.totals.completion}%</p>
          <p className="text-xs text-slate-300">{allCards.filter((card) => card.completion === 100).length}/{allCards.length} concluídas</p>
        </Card>
        {disciplineRows.map(([discipline, row]) => (
          <Card key={discipline}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{DISCIPLINE_LABEL[discipline] ?? discipline}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{Math.round(row.progress / row.total)}%</p>
            <p className="text-xs text-slate-500">{row.completed}/{row.total} concluídas</p>
          </Card>
        ))}
      </div>

      {board.totals.stages === 0 ? (
        <Card className="mt-6 border-dashed text-center">
          <p className="py-8 text-sm text-slate-500">Este projeto ainda não tem etapas no cronograma.</p>
        </Card>
      ) : <KanbanBoardView projectId={id} board={board} />}
    </AppShell>
  );
}