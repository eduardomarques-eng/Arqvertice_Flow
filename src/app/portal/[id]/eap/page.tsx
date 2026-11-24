import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { EapExecutiveReportView } from "@/components/eap/eap-executive-report-view";
import { EapExecutionTracker } from "@/components/eap/eap-execution-tracker";
import { requirePageClientPortal, requirePageProjectAccess } from "@/server/auth";
import { prisma } from "@/server/db";

export const metadata = { title: "Relatório Executivo & Evolução da Obra — Portal do Cliente" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientPortalEapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePageClientPortal();
  const user = await requirePageProjectAccess(id);

  const eap = await prisma.eapProject.findUnique({
    where: { projectId: id },
    select: { status: true },
  });

  const showExecutionEvolution =
    eap?.status === "EM_EXECUCAO" || eap?.status === "CONCLUIDA";

  return (
    <AppShell eyebrow="Portal do Cliente · EAP" environment="client" role={user.role}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <SectionHeading
          title="Orçamento Executivo EAP & Acompanhamento da Obra"
          description="Apresentação consolidada de investimento, Curva ABC, fluxo de desembolso mensal, plantas oficiais e evolução física/financeira."
        />
        <Link
          href={`/portal/${id}`}
          className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          ← Voltar ao Meu Projeto
        </Link>
      </div>

      <div className="space-y-8">
        {showExecutionEvolution && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
              Evolução Periódica da Obra (Previsto × Realizado)
            </h2>
            <EapExecutionTracker projectId={id} isAdmin={false} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
            Relatório Executivo & Linha de Base
          </h2>
          <EapExecutiveReportView projectId={id} isAdmin={false} initialAudience="CLIENT" />
        </section>
      </div>
    </AppShell>
  );
}
