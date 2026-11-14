import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { AcervoProjectDetailView, type ProjectDetailData } from "@/components/acervo/acervo-project-detail-view";

export const dynamic = "force-dynamic";

export default async function AdminAcervoProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requirePageRole("ADMIN");
  const { projectId } = await params;

  const rawProject = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { name: true } },
      acervoNamingRules: true,
      acervoDocuments: {
        include: {
          revisions: {
            orderBy: { createdAt: "desc" },
            include: {
              workflowLogs: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
        orderBy: [{ discipline: "asc" }, { code: "asc" }],
      },
      acervoGrds: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });

  if (!rawProject) {
    notFound();
  }

  const project: ProjectDetailData = {
    id: rawProject.id,
    name: rawProject.name,
    clientName: rawProject.client?.name || "Geral",
    namingRules: rawProject.acervoNamingRules.map((r) => ({
      id: r.id,
      mask: r.mask,
      example: r.example,
      policy: r.policy,
    })),
    documents: rawProject.acervoDocuments.map((doc) => ({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      discipline: doc.discipline,
      phase: doc.phase,
      revisions: doc.revisions.map((rev) => ({
        id: rev.id,
        revisionNumber: rev.revisionNumber,
        status: rev.status,
        fileName: rev.fileName,
        fileUrl: rev.fileUrl,
        fileSize: rev.fileSize,
        isCurrent: rev.isCurrent,
        createdAt: rev.createdAt.toISOString(),
        workflowLogs: rev.workflowLogs.map((log) => ({
          id: log.id,
          action: log.action,
          fromStatus: log.fromStatus,
          toStatus: log.toStatus,
          performedByName: log.performedByName,
          performedByRole: log.performedByRole,
          createdAt: log.createdAt.toISOString(),
        })),
      })),
    })),
    grds: rawProject.acervoGrds.map((g) => ({
      id: g.id,
      code: g.code,
      recipientName: g.recipientName,
      recipientOrg: g.recipientOrg,
      createdAt: g.createdAt.toISOString(),
      itemsCount: g.items.length,
    })),
  };

  return (
    <AppShell eyebrow="Acervo Manager CDE">
      <AcervoProjectDetailView project={project} basePath="/admin" userRole="ADMIN" />
    </AppShell>
  );
}
