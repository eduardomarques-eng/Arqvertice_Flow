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

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePageClientPortal();
  const user = await requirePageProjectAccess(id);

  const [bundle, projectDb, deliverableMatrix, rawDeliverables] = await Promise.all([
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
    </AppShell>
  );
}
