import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { getEffectivePermissions } from "@/lib/rbac";
import { prisma } from "@/server/db";
import { AcervoManagerView, type AcervoProjectOption, type CdeDocumentItem } from "@/components/acervo/acervo-manager-view";
import { getAcervoExecutiveKpis } from "@/server/services/acervo-cde-service";

export const metadata = { title: "Acervo Manager (CDE) — Equipe ArqVértice" };
export const dynamic = "force-dynamic";

export default async function EquipeAcervoPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requirePageTeamRole();
  if (user.role !== "ADMIN" && !getEffectivePermissions(user).includes("acervo")) {
    redirect("/equipe");
  }
  const { projectId } = await searchParams;

  const [rawProjects, rawDocuments, kpis] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.acervoDocument.findMany({
      include: {
        project: {
          select: {
            name: true,
            client: { select: { name: true } },
          },
        },
        revisions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ discipline: "asc" }, { code: "asc" }],
    }),
    getAcervoExecutiveKpis(),
  ]);

  const projects: AcervoProjectOption[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || "Cliente",
  }));

  const documents: CdeDocumentItem[] = rawDocuments.map((d) => {
    const currentRev = d.revisions.find((r) => r.isCurrent) || d.revisions[0];
    return {
      id: d.id,
      projectId: d.projectId,
      projectName: d.project.name,
      clientName: d.project.client?.name || "Cliente",
      code: d.code,
      title: d.title,
      discipline: d.discipline,
      phase: d.phase,
      category: d.category,
      currentRevisionNumber: currentRev?.revisionNumber || "R00",
      status: currentRev?.status || "EM_ELABORACAO",
      fileName: currentRev?.fileName || `${d.code}.pdf`,
      fileUrl: currentRev?.fileUrl || "#",
      fileSize: currentRev?.fileSize || "4.2 MB",
      revisionsCount: d.revisions.length,
      updatedAt: currentRev?.updatedAt?.toISOString() || d.updatedAt.toISOString(),
    };
  });

  return (
    <AppShell eyebrow="Acervo Manager CDE" role={user.role}>
      <SectionHeading
        title="Acervo Manager — Ambiente Comum de Dados (CDE)"
        description="Acesso e consulta técnica centralizada de pranchas, validação de revisões vigentes e controle de documentos para obra."
      />
      <div className="mt-6">
        <AcervoManagerView
          projects={projects}
          documents={documents}
          basePath="/equipe"
          initialProjectId={projectId}
          kpis={kpis}
        />
      </div>
    </AppShell>
  );
}
