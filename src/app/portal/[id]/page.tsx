import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import {
  requirePageClientPortal,
  requirePageProjectAccess,
  isClientRole,
} from "@/server/auth";
import { prisma } from "@/server/db";
import { getScheduleReport } from "@/server/services/schedule-report-service";
import { getDeliverableMatrix } from "@/server/services/deliverable-service";
import {
  ClientSimplifiedReport,
  type ClientDeliverable,
} from "@/components/reports/client-simplified-report";
import { BentoHorizontalRanking, BentoKpiStrip } from "@/components/analytics";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePageClientPortal();
  const user = await requirePageProjectAccess(id);

  const [bundle, projectDb, deliverableMatrix, rawDeliverables, publishedEap] = await Promise.all([
    getScheduleReport(id, new Date(), { skipAuth: true }),
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        startDate: true,
        expectedEndDate: true,
        status: true,
        address: true,
        client: { select: { name: true, phone: true, email: true } },
      },
    }),
    getDeliverableMatrix(id, true),
    prisma.projectDeliverable.findMany({
      where: { projectId: id, isClientView: true },
      include: { environment: { select: { name: true } } },
      orderBy: [
        { phaseFolder: "asc" },
        { discipline: "asc" },
        { sheetCode: "asc" },
        { createdAt: "desc" },
      ],
    }),
    prisma.eapProject
      .findFirst({
        where: {
          projectId: id,
          status: { in: ["BASELINE_APROVADA", "EM_EXECUCAO", "CONCLUIDA"] },
        },
        select: { id: true, status: true, builtAreaM2: true },
      })
      .catch(() => null),
  ]);

  if (!projectDb) {
    return (
      <AppShell eyebrow="Portal do cliente" environment="client">
        <EmptyState
          title="Projeto ainda sem dados"
          description="Assim que o estúdio publicar o cronograma, ele aparece aqui."
        />
      </AppShell>
    );
  }

  const report = bundle?.report;
  const isClient = isClientRole(user.role);

  // Mapeamento dos dados de endereço
  const addr = (projectDb.address || {}) as Record<string, string>;
  const addressText = addr.formatted || addr.localizacao || addr.cidade || "Edificação Residencial";

  // Mapeamento dos entregáveis liberados para a visão do cliente
  const deliverablesList: ClientDeliverable[] = (rawDeliverables || []).map((d) => ({
    id: d.id,
    sheetCode: d.sheetCode,
    title: d.title,
    subtitle: d.subtitle,
    subject: d.subject,
    discipline: d.discipline,
    phaseFolder: d.phaseFolder,
    category: d.category,
    version: d.version,
    fileUrl: d.fileUrl,
    fileSize: d.fileSize,
    environmentName: d.environment?.name ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  return (
    <AppShell eyebrow="Portal do Cliente" environment="client" role={user.role}>
      <div className="space-y-6">
        {/* Card Executivo Discreto do Cliente */}
        <section className="space-y-4">
          <BentoKpiStrip
            columns={3}
            items={[
              {
                id: "prog",
                label: "Progresso Geral do Projeto",
                value:
                  report?.stages && report.stages.length > 0
                    ? `${Math.round(
                        report.stages.reduce((s, st) => s + (st.completion ?? 0), 0) /
                          report.stages.length
                      )}%`
                    : "0%",
                featured: true,
              },
              {
                id: "sheets",
                label: "Pranchas Liberadas",
                value: String(deliverablesList.length),
                subtitle: "Acervo técnico disponível",
              },
              {
                id: "next",
                label: "Previsão de Entrega",
                value: projectDb.expectedEndDate
                  ? new Date(projectDb.expectedEndDate).toLocaleDateString("pt-BR")
                  : "Em atualização",
              },
            ]}
          />
          {report?.stages && report.stages.length > 0 && (
            <BentoHorizontalRanking
              title="Avanço por Etapa do Seu Projeto"
              maxScale={100}
              items={report.stages.slice(0, 5).map((st, idx) => ({
                id: `stage-${st.order}-${idx}`,
                label: st.name,
                value: st.completion ?? 0,
                formattedValue: `${st.completion ?? 0}%`,
                highlight: idx === 0,
              }))}
            />
          )}
        </section>

        {publishedEap && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div>
              <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Relatório Executivo EAP & Cronograma Disponível
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Consulte o investimento aprovado, Curva ABC, fluxo de desembolso mensal, plantas e exportação em PDF.
              </p>
            </div>
            <Link
              href={`/portal/${id}/eap`}
              className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-zinc-950"
            >
              Abrir Relatório EAP →
            </Link>
          </div>
        )}

        <ClientSimplifiedReport
          projectId={id}
          projectName={projectDb.name}
          clientName={projectDb.client?.name || "Proprietário"}
          projectType={projectDb.type}
          addressText={addressText}
          startDate={projectDb.startDate}
          expectedEndDate={projectDb.expectedEndDate}
          report={report}
          deliverableMatrix={deliverableMatrix}
          deliverables={deliverablesList}
          isClient={isClient}
        />
      </div>
    </AppShell>
  );
}
