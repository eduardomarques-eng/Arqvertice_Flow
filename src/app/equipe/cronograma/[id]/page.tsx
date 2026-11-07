import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { KanbanBoardView } from "@/components/schedule/kanban-board";
import { requirePageProjectAccess, requirePageTeamRole } from "@/server/auth";
import { kanbanBoard } from "@/server/services/schedule-service";

export const dynamic = "force-dynamic";

/**
 * Kanban operacional da equipe técnica (100% interativo).
 *
 * Apenas EQUIPE e ADMIN entram, e o acesso ao projeto é provado por
 * `requireProjectAccess` (ProjectAccess para EQUIPE, tudo para ADMIN).
 * O componente `KanbanBoardView` já é o quadro Trello-style com drag-and-drop
 * entre colunas e ajuste de avanço físico (0% a 100%); a escrita é feita no
 * servidor via `editScheduleStageAction` / `updateScheduleStageStatus`, que
 * exigem `requireScheduleRole` (ACEITA EQUIPE) e `requireScheduleWrite`
 * (ProjectAccess do projeto). Nenhum dado financeiro é carregado aqui.
 */
export default async function EquipeCronogramaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageTeamRole();
  await requirePageProjectAccess(id);
  const board = await kanbanBoard(id);

  return (
    <AppShell eyebrow="Cronograma operacional" role={user.role}>
      <Link href="/equipe" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
        ← Voltar à equipe
      </Link>

      <SectionHeading
        title={`Kanban — ${board.project.name}`}
        description="Arraste os cards entre colunas e ajuste o avanço físico das etapas da sua responsabilidade. Alterações refletidas em tempo real no banco."
      />

      {board.totals.stages === 0 ? (
        <div className="mt-8">
          <p className="text-sm text-slate-500">
            Este projeto ainda não tem etapas no cronograma.
          </p>
        </div>
      ) : (
        <KanbanBoardView projectId={id} board={board} />
      )}
    </AppShell>
  );
}
