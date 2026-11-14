import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageProjectAccess, requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { prisma } from "@/server/db";
import { listProjectDocuments } from "@/server/services/document-service";
import { listProjectDeliverables, getDeliverableMatrix } from "@/server/services/deliverable-service";
import { kanbanBoard } from "@/server/services/schedule-service";
import { ProjectDetailTabs } from "@/components/projects/project-detail-tabs";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export const dynamic = "force-dynamic";

export default async function TeamProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");
  await requirePageProjectAccess(id);

  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: { select: { name: true, phone: true, email: true } } },
  });

  if (!project) notFound();

  const [documents, board, deliverables, deliverableMatrix] = await Promise.all([
    listProjectDocuments(id),
    kanbanBoard(id),
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

  const deliverablesList = (deliverables ?? []).map((d) => ({
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
    name: project.name ?? "Projeto sem nome",
    type: project.type ?? null,
    status: project.status ?? "IN_PROGRESS",
    budget: project.budget ? Number(project.budget) : null,
    startDate: project.startDate ?? null,
    expectedEndDate: project.expectedEndDate ?? null,
    address: (project.address as Record<string, unknown>) || null,
    client: project.client ?? { name: "Cliente não informado", phone: null, email: null },
  };

  return (
    <AppShell eyebrow="Ficha técnica" role={user.role}>
      <div className="mx-auto max-w-7xl font-sans space-y-4">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/equipe/projetos"
            className="font-semibold text-blue-600 hover:text-blue-700 transition flex items-center gap-1"
          >
            ← Voltar para projetos
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-500 truncate max-w-[240px] sm:max-w-none">{projectData.name}</span>
        </div>

        <ErrorBoundary fallbackTitle="Erro ao carregar ficha técnica" backHref="/equipe/projetos">
          <ProjectDetailTabs
            project={projectData}
            documents={safeDocuments}
            deliverables={deliverablesList}
            deliverableMatrix={deliverableMatrix}
            stages={stages}
            completion={board?.totals?.completion ?? 0}
            overdueCount={board?.totals?.overdue ?? 0}
            basePath="/equipe"
          />
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}
