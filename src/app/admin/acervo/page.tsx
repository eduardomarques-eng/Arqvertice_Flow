import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { AcervoManagerView, type AcervoProjectOption, type CdeDocumentItem } from "@/components/acervo/acervo-manager-view";
import { seedAcervoManagerDemo } from "@/server/services/acervo-seed";

export const metadata = { title: "Acervo Manager (CDE) — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminAcervoPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  await requirePageRole("ADMIN");
  const { projectId } = await searchParams;

  // Garante carga inicial para homologação
  await seedAcervoManagerDemo();

  const [rawProjects, rawDocuments] = await Promise.all([
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
    <AppShell eyebrow="Acervo Manager CDE">
      <SectionHeading
        title="Acervo Manager — Ambiente Comum de Dados (CDE)"
        description="Gestão integrada de projetos, controle de revisões (R00, R01...), validação de nomenclatura, esteira Bom para Obra e emissão de GRDs."
      />
      <div className="mt-6">
        <AcervoManagerView
          projects={projects}
          documents={documents}
          basePath="/admin"
          initialProjectId={projectId}
        />
      </div>
    </AppShell>
  );
}
