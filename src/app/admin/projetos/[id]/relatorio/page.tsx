import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageProjectAccess, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getScheduleReport } from "@/server/services/schedule-report-service";
import { UnifiedScheduleReport } from "@/components/reports/schedule-report-unified";

export const dynamic = "force-dynamic";

export default async function ProjectReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);

  const user = await currentUser();
  if (user?.role === "CLIENT") {
    const released = await prisma.projectReport.findFirst({
      where: { projectId: id, status: "RELEASED" },
      select: { id: true },
    });
    if (!released) notFound();
  }

  const [bundle, projectDb] = await Promise.all([
    getScheduleReport(id),
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        address: true,
        client: { select: { name: true, phone: true, email: true } },
        installments: { orderBy: { order: "asc" } },
      },
    }),
  ]);

  if (!bundle) notFound();
  const report = bundle.report;
  const pdfUrl = `/api/projects/${id}/cronograma/relatorio/pdf`;

  // Mapeamento dos dados do cliente e da edificação
  const addr = (projectDb?.address || {}) as Record<string, string>;
  const clientInfo = {
    name: projectDb?.client?.name || bundle.projectName,
    phone: projectDb?.client?.phone || null,
    email: projectDb?.client?.email || null,
    address: addr.formatted || addr.localizacao || "Litoral Sul",
    loteQuadra: addr.loteQuadra || addr.lote || "Lote 14, Quadra B",
    areaConstruida: addr.areaConstruida || addr.area || "385,00 m²",
  };

  const initialPayments = (projectDb?.installments || []).map((inst) => ({
    id: inst.id,
    name: inst.description,
    amount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(inst.amount)),
    amountNumber: Number(inst.amount),
    dueDate: new Date(inst.dueDate).toLocaleDateString("pt-BR"),
    paidAt: inst.paidDate ? new Date(inst.paidDate).toLocaleDateString("pt-BR") : "—",
    stage: inst.linkedStageId || "—",
    status: inst.status === "PAID" ? "Liquidado" : "Pendente",
    order: inst.order,
  }));

  return (
    <AppShell eyebrow="Relatório Oficial do Cronograma">
      <UnifiedScheduleReport
        projectId={id}
        projectName={bundle.projectName}
        client={clientInfo}
        initialPayments={initialPayments}
        financialRows={report.financial?.rows || []}
        report={report}
        pdfUrl={pdfUrl}
      />
    </AppShell>
  );
}
