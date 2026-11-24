import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { EapExecutiveReportView } from "@/components/eap/eap-executive-report-view";
import { requirePageClientPortal, requirePageProjectAccess } from "@/server/auth";

export const metadata = { title: "Relatório Executivo EAP — Portal do Cliente" };
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

  return (
    <AppShell eyebrow="Portal do Cliente · EAP" environment="client" role={user.role}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <SectionHeading
          title="Orçamento Executivo EAP & Cronograma da Obra"
          description="Apresentação consolidada de investimento, Curva ABC, fluxo de desembolso mensal, plantas oficiais e premissas."
        />
        <Link
          href={`/portal/${id}`}
          className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          ← Voltar ao Meu Projeto
        </Link>
      </div>
      <EapExecutiveReportView projectId={id} isAdmin={false} initialAudience="CLIENT" />
    </AppShell>
  );
}
