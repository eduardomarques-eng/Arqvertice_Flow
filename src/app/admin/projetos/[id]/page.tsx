import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { getBriefingLinkStatus } from "@/server/services/briefing-link-service";
import { listProjectReports } from "@/server/services/report-visibility-service";
import { listProjectDocuments } from "@/server/services/document-service";
import { listProjectDeliverables, getDeliverableMatrix } from "@/server/services/deliverable-service";
import { getProjectCommercialSummary } from "@/server/services/commercial-service";
import { kanbanBoard } from "@/server/services/schedule-service";
import { listProjectInstallments } from "@/server/services/installment-service";
import { ProjectDetailTabs } from "@/components/projects/project-detail-tabs";
import { ProjectDetailBentoMini } from "@/components/analytics/ProjectDetailBentoMini";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageRole("ADMIN");

  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: { select: { name: true, phone: true, email: true } } },
  });

  if (!project) notFound();

  const linkStatus = await getBriefingLinkStatus(id);
  const [reports, documents, commercial, board, installments, deliverables, deliverableMatrix] = await Promise.all([
    listProjectReports(id),
    listProjectDocuments(id),
    getProjectCommercialSummary(id),
    kanbanBoard(id),
    listProjectInstallments(id),
    listProjectDeliverables(id),
    getDeliverableMatrix(id),
  ]);

  const safeDocuments = (documents ?? []).map((doc) => ({
    ...doc,
    sizeBytes: doc.sizeBytes != null ? Number(doc.sizeBytes) : null,
  }));

  const stages = (board?.columns || []).flatMap((column) => column?.cards || []).map((card) => ({
    id: card.id,
    name: card.name,
    discipline: card.discipline,
  }));

  const installmentsList = (installments || []).map((item) => ({
    id: item.id,
    description: item.description,
    amount: Number(item.amount ?? 0),
    dueDate: item.dueDate,
    paidDate: item.paidDate,
    status: item.status,
    linkedStageId: item.linkedStageId,
    order: item.order,
  }));

  const deliverablesList = deliverables.map((d) => ({
    id: d.id,
    sheetCode: d.sheetCode,
    subject: d.subject,
    title: d.title,
    subtitle: d.subtitle,
    phaseFolder: d.phaseFolder,
    category: d.category,
    discipline: d.discipline,
    type: d.type,
    version: d.version,
    fileSize: d.fileSize,
    fileUrl: d.fileUrl,
    status: d.status,
    isClientView: d.isClientView,
    isRequired: d.isRequired,
    description: d.description,
    stageId: d.stageId,
    environmentId: d.environmentId,
    stage: d.stage ? { id: d.stage.id, name: d.stage.name } : null,
    environment: d.environment ? { id: d.environment.id, name: d.environment.name } : null,
    createdAt: d.createdAt,
  }));

  const projectData = {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    budget: project.budget ? Number(project.budget) : null,
    startDate: project.startDate,
    expectedEndDate: project.expectedEndDate,
    address: (project.address as Record<string, unknown>) || null,
    client: project.client,
  };

  return (
    <AppShell eyebrow="Centro operacional">
      <div className="mx-auto max-w-7xl font-sans space-y-4">
        {/* Breadcrumb e navegação de retorno */}
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/projetos"
            className="font-semibold text-blue-600 hover:text-blue-700 transition flex items-center gap-1"
          >
            ← Voltar para projetos
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-500 truncate max-w-[240px] sm:max-w-none">{project.name}</span>
        </div>

        {/* Mini-Dashboard Bento de Cronograma do Projeto */}
        <ProjectDetailBentoMini
          completionPct={board?.totals?.completion ?? 0}
          daysRemaining={
            project.expectedEndDate
              ? Math.ceil(
                  (new Date(project.expectedEndDate).getTime() - Date.now()) / 86_400_000
                )
              : null
          }
          completedCount={
            (board?.columns || [])
              .flatMap((c) => c?.cards || [])
              .filter((c) => c.completion === 100 || c.status === "COMPLETED").length
          }
          pendingCount={
            (board?.columns || [])
              .flatMap((c) => c?.cards || [])
              .filter((c) => c.completion < 100 && c.status !== "COMPLETED").length
          }
          phaseBreakdown={
            (board?.columns || []).map((col) => {
              const cards = col?.cards || [];
              const avg = cards.length
                ? Math.round(cards.reduce((s, c) => s + (c.completion ?? 0), 0) / cards.length)
                : 0;
              return {
                phase: col.label || String(col.id),
                progressPct: avg,
                countLabel: `${cards.length} etapa(s)`,
              };
            })
          }
          weeklyPace={[
            { label: "Sem 1", planned: 3, done: 2 },
            { label: "Sem 2", planned: 4, done: 4 },
            { label: "Sem 3", planned: 4, done: 3 },
            {
              label: "Atual",
              planned: Math.max(1, stages.length),
              done: (board?.columns || [])
                .flatMap((c) => c?.cards || [])
                .filter((c) => c.completion === 100 || c.status === "COMPLETED").length,
            },
          ]}
        />

        {/* Record Page Header & Acervo Técnico Focado */}
        <ProjectDetailTabs
          project={projectData}
          documents={safeDocuments}
          deliverables={deliverablesList}
          deliverableMatrix={deliverableMatrix}
          stages={stages}
          completion={board?.totals?.completion ?? 0}
          overdueCount={board?.totals?.overdue ?? 0}
        />
      </div>
    </AppShell>
  );
}
