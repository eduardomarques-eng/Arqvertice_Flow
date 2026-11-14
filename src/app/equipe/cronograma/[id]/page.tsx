import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { KanbanBoardView } from "@/components/schedule/kanban-board";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { requirePageProjectAccess, requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
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
  await requireModuleAccess("cronograma");
  await requirePageProjectAccess(id);
  const board = await kanbanBoard(id);

  return (
    <AppShell eyebrow="Cronograma operacional" role={user.role}>
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        <Link href="/equipe/cronograma" className="text-blue-600 hover:text-blue-700">
          ← Voltar ao cronograma
        </Link>
        <Link href={`/equipe/projetos/${id}`} className="text-slate-600 hover:text-slate-900">
          Ficha técnica →
        </Link>
      </div>

      <SectionHeading
        title={`Kanban — ${board?.project?.name ?? "Projeto"}`}
        description="Arraste os cards entre colunas e ajuste o avanço físico das etapas da sua responsabilidade. Alterações refletidas em tempo real no banco."
      />

      {(board?.totals?.stages ?? 0) === 0 ? (
        <div className="mt-8">
          <p className="text-sm text-slate-500">
            Este projeto ainda não tem etapas no cronograma.
          </p>
        </div>
      ) : (
        <ErrorBoundary fallbackTitle="Erro ao carregar quadro Kanban" backHref="/equipe/cronograma">
          <KanbanBoardView projectId={id} board={board} />
        </ErrorBoundary>
      )}
    </AppShell>
  );
}
