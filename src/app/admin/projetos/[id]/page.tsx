import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { BriefingLinkManager } from "@/components/briefing/briefing-link-manager";
import { getBriefingLinkStatus } from "@/server/services/briefing-link-service";
import { listProjectReports } from "@/server/services/report-visibility-service";
import { ReportVisibilityControl } from "@/components/reports/report-visibility-control";
import { listProjectDocuments } from "@/server/services/document-service";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { ProposalActions } from "@/components/proposals/proposal-actions";
import { CommercialSummary } from "@/components/proposals/commercial-summary";
import { getProjectCommercialSummary } from "@/server/services/commercial-service";
import { kanbanBoard } from "@/server/services/schedule-service";
import { listProjectInstallments } from "@/server/services/installment-service";
import { ProjectFinanceManager } from "@/components/projects/project-finance-manager";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageRole("ADMIN");

  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: { select: { name: true, phone: true, email: true } } },
  });

  if (!project) notFound();

  const linkStatus = await getBriefingLinkStatus(id);
  const [reports, documents, commercial, board, installments] = await Promise.all([
    listProjectReports(id),
    listProjectDocuments(id),
    getProjectCommercialSummary(id),
    kanbanBoard(id),
    listProjectInstallments(id),
  ]);

  const stages = (board?.columns || []).flatMap((column) => column?.cards || []).map((card) => ({ id: card.id, name: card.name }));
  const totalStages = board?.totals?.stages ?? 0;
  const completion = board?.totals?.completion ?? 0;
  const overdue = board?.totals?.overdue ?? 0;
  const installmentsList = installments || [];

  return (
    <AppShell eyebrow="Centro operacional">
      <Link href="/admin/projetos" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
        ← Voltar para projetos
      </Link>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Centro operacional</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Cliente: {project.client?.name ?? "Não informado"} · {project.type ?? "Residencial"}
          </p>
        </div>
        <Badge tone={project.status === "IN_PROGRESS" ? "blue" : project.status === "COMPLETED" ? "green" : "amber"}>
          {project.status}
        </Badge>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Áreas do projeto">
        {[["Resumo", "#resumo"], ["Cronograma", `/admin/projetos/${id}/cronograma`], ["Documentos", "#documentos"], ["Relatórios", "#relatórios"]].map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className="min-w-max rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-blue-700 transition"
          >
            {label}
          </Link>
        ))}
      </nav>

      {commercial ? <CommercialSummary summary={commercial} /> : null}

      <div className="mt-6">
        <ProjectFinanceManager
          projectId={id}
          initialInstallments={installmentsList.map((item) => ({ ...item, amount: Number(item.amount ?? 0) }))}
          stages={stages}
        />
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Proposta comercial</h2>
        <p className="mt-1 text-sm text-slate-500">Crie uma apresentação versionada e gere um link seguro para o cliente.</p>
        <div className="mt-4">
          <ProposalActions projectId={id} />
        </div>
      </Card>

      <BriefingLinkManager
        projectId={id}
        clientName={project.client?.name}
        clientPhone={project.client?.phone}
        initialStatus={linkStatus?.briefingStatus ?? "NOT_STARTED"}
        initialLinkStatus={linkStatus?.linkStatus === "ACTIVE" ? "ACTIVE" : "REVOKED"}
      />

      <div id="resumo" className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-semibold text-slate-900">Andamento</h2>
          <div className="mt-6">
            <Progress value={completion} />
            <p className="mt-3 text-sm text-slate-500">{totalStages} etapa(s) no cronograma.</p>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Resumo financeiro</h2>
          <div className="mt-6 text-sm">
            <p className="text-slate-500">
              Parcelas cadastradas: <strong>{installmentsList.length}</strong>
            </p>
            <p className="mt-2 text-slate-500">Valores detalhados no gerenciador financeiro acima.</p>
          </div>
        </Card>
      </div>

      <div id="cronograma" className="mt-6">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Andamento do cronograma</h2>
              <p className="mt-1 text-sm text-slate-500">
                {totalStages === 0 ? "Ainda não existem etapas." : `${totalStages} etapa(s), ${completion}% concluído.`}
              </p>
            </div>
            <Link href={`/admin/projetos/${id}/cronograma`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Abrir quadro →
            </Link>
          </div>
          <div className="mt-4">
            <Progress value={completion} />
          </div>
          {overdue > 0 ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{overdue} etapa(s) com prazo vencido.</p>
          ) : null}
        </Card>
      </div>

      <Card id="documentos" className="mt-6">
        <h2 className="font-semibold text-slate-900">Documentos privados</h2>
        <p className="mt-1 text-sm text-slate-500">Arquivos armazenados sem URL pública. O cliente só acessa itens liberados.</p>
        <DocumentUploader projectId={id} />
        <DocumentList documents={documents || []} />
      </Card>

      <div id="relatórios" className="mt-6">
        <ReportVisibilityControl
          projectId={id}
          reports={(reports || []).map((report) => ({ id: report.id, title: report.title, status: report.status }))}
        />
      </div>
    </AppShell>
  );
}
