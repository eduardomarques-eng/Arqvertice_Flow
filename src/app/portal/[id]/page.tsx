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
import { listProjectContractsForPortal } from "@/server/services/contract-service";
import { listProjectInstallments } from "@/server/services/installment-service";
import { formatCurrencyBRL } from "@/lib/contract-template";
import { generateWhatsAppLink, normalizeWhatsAppPhone } from "@/lib/whatsapp";
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

  const [bundle, projectDb, deliverableMatrix, rawDeliverables, publishedEap, portalContracts, portalInstallments, officialWaSession, adminContact] = await Promise.all([
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
    listProjectContractsForPortal(id).catch(() => []),
    listProjectInstallments(id).catch(() => []),
    prisma.whatsAppUserSession
      .findFirst({
        where: { isStudioOfficial: true, connectedPhone: { not: null } },
        select: { connectedPhone: true },
      })
      .catch(() => null),
    prisma.user
      .findFirst({
        where: { role: "ADMIN", isActive: true },
        select: { whatsapp: true, phone: true },
      })
      .catch(() => null),
  ]);

  const studioWhatsAppDigits = normalizeWhatsAppPhone(
    officialWaSession?.connectedPhone ||
      adminContact?.whatsapp ||
      adminContact?.phone ||
      process.env.STUDIO_WHATSAPP_PHONE ||
      ""
  );
  const studioWhatsAppHref = studioWhatsAppDigits
    ? generateWhatsAppLink(
        studioWhatsAppDigits,
        `Olá! Gostaria de falar sobre o andamento do projeto ${projectDb?.name || "no ArqVértice OS"}.`
      )
    : null;

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
          {studioWhatsAppHref && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Canal Direto com o Estúdio
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Dúvidas técnicas, alinhamentos de obra ou envio de comprovantes Pix.
                </p>
              </div>
              <a
                href={studioWhatsAppHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Atendimento via WhatsApp
              </a>
            </div>
          )}
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

        {(portalContracts.length > 0 || portalInstallments.length > 0) && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Contratos &amp; Assinaturas</h2>
              {portalContracts.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum contrato emitido até o momento.</p>
              ) : (
                <div className="space-y-2.5">
                  {portalContracts.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{c.title}</p>
                        <p className="text-slate-500">
                          Status: {c.status} · Assinatura: {c.signature?.status ?? "Pendente"}
                          {c.addendums.length > 0 ? ` · ${c.addendums.length} Aditivo(s)` : ""}
                        </p>
                      </div>
                      <a
                        href={`/api/contracts/${c.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
                      >
                        Baixar PDF
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Parcelas &amp; Investimento</h2>
              {portalInstallments.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma parcela financeira lançada ainda.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {portalInstallments.map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">{inst.description}</p>
                        <p className="text-[11px] text-slate-500">
                          Venc.: {new Date(inst.dueDate).toLocaleDateString("pt-BR")} · {inst.status}
                        </p>
                      </div>
                      <strong className="text-slate-900">{formatCurrencyBRL(Number(inst.amount ?? 0))}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
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
