import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePageClientPortal, requirePageProjectAccess } from "@/server/auth";
import { kanbanBoard } from "@/server/services/schedule-service";

export const dynamic = "force-dynamic";

export default async function ClientSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageClientPortal();
  const user = await requirePageProjectAccess(id);
  const board = await kanbanBoard(id);
  return (
    <AppShell eyebrow="Cronograma em tempo real" environment="client" role={user.role}>
      <div className="mx-auto max-w-6xl">
        <Link href={`/portal/${id}`} className="text-sm font-semibold text-blue-600">← Voltar ao projeto</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-950">{board.project.name}</h1><p className="mt-2 text-sm text-slate-500">Visualização em tempo real sincronizada com a equipe técnica.</p></div><Badge tone="neutral">Somente leitura</Badge></div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {board.columns.map((column) => (
            <section key={column.id} className="rounded-3xl bg-slate-100/70 p-4">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-800">{column.label}</h2><span className="text-xs text-slate-400">{column.cards.length}</span></div>
              <div className="mt-4 space-y-3">{column.cards.map((card) => <Card key={card.id} className="bg-white"><p className="font-semibold text-slate-900">{card.name}</p><p className="mt-1 text-xs text-slate-500">{card.discipline ?? "Geral"} {card.designer ? `· ${card.designer}` : ""}</p><div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-400">{card.dueDate ? new Date(card.dueDate).toLocaleDateString("pt-BR") : "Prazo a definir"}</span><strong className="text-slate-700">{card.completion}%</strong></div></Card>)}</div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
