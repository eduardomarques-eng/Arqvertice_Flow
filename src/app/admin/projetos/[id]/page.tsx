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
import { getProjectChecklist } from "@/server/actions/checklist";
import { ProjectDetailTabs } from "@/components/projects/project-detail-tabs";

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
  const [reports, documents, commercial, board, installments, deliverables, deliverableMatrix, checklistItems] = await Promise.all([
    listProjectReports(id),
    listProjectDocuments(id),
    getProjectCommercialSummary(id),
    kanbanBoard(id),
    listProjectInstallments(id),
    listProjectDeliverables(id),
    getDeliverableMatrix(id),
    getProjectChecklist(id),
  ]);

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
      <div className="mx-auto max-w-7xl font-sans">
        <Link href="/admin/projetos" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
          ← Voltar para projetos
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Edificação
              </span>
              <span className="text-xs font-semibold text-slate-400">· ArqVértice Studio</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{project.name}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Cliente: <strong className="text-slate-800">{project.client?.name ?? "Não informado"}</strong> · {project.type ?? "Residencial Alto Padrão"}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href={`/admin/projetos/${id}/relatorio`}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              Relatório Executivo
            </Link>
            <Badge tone={project.status === "IN_PROGRESS" ? "blue" : project.status === "COMPLETED" ? "green" : "amber"}>
              {project.status === "IN_PROGRESS" ? "Em Execução" : project.status === "COMPLETED" ? "Concluído" : project.status}
            </Badge>
          </div>
        </div>

        {/* Submenu por Abas da Edificação e Conteúdo Dinâmico */}
        <div className="mt-4">
          <ProjectDetailTabs
            project={projectData}
            linkStatus={linkStatus}
            reports={reports.map((r) => ({ id: r.id, title: r.title, status: r.status as "PREPARING" | "INTERNAL" | "RELEASED" | "ARCHIVED" }))}
            documents={documents}
            commercial={commercial}
            board={board}
            installments={installmentsList}
            deliverables={deliverablesList}
            deliverableMatrix={deliverableMatrix}
            stages={stages}
            checklistItems={checklistItems}
          />
        </div>
      </div>
    </AppShell>
  );
}
