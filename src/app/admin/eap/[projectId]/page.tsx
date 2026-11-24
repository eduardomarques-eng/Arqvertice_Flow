import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { EapProjectHub } from "@/components/eap/eap-project-hub";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";

export const metadata = { title: "Hub EAP da Obra — ArqVértice Flow" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EapProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const admin = await requirePageAdminRole();
  const { projectId } = await params;

  const project = await prisma.project
    .findUnique({
      where: { id: projectId },
      select: { id: true, name: true, client: { select: { name: true } } },
    })
    .catch(() => null);

  if (!project) notFound();

  const [citiesRaw, eapRaw, acervoDocsRaw] = await Promise.all([
    prisma.cityCatalog
      .findMany({
        where: { active: true },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, state: true, defaultBdiPercent: true, isDefault: true },
      })
      .catch(() => []),
    prisma.eapProject
      .findUnique({
        where: { projectId },
        include: {
          city: { select: { id: true, name: true, state: true } },
          sourceFiles: { orderBy: { createdAt: "desc" } },
          conflictLogs: { orderBy: { createdAt: "desc" } },
          stages: {
            orderBy: { orderIndex: "asc" },
            include: {
              groups: {
                orderBy: { orderIndex: "asc" },
                include: { items: { orderBy: { orderIndex: "asc" } } },
              },
            },
          },
        },
      })
      .catch(() => null),
    prisma.acervoDocument
      .findMany({
        where: { projectId, isArchived: false },
        orderBy: [{ discipline: "asc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          title: true,
          discipline: true,
          revisions: {
            where: { isCurrent: true },
            take: 1,
            select: { revisionNumber: true, fileName: true, fileType: true },
          },
        },
      })
      .catch(() => []),
  ]);

  const acervoPdfs = acervoDocsRaw
    .map((d) => {
      const rev = d.revisions[0];
      if (!rev) return null;
      if (rev.fileType !== "PDF" && !rev.fileName.toLowerCase().endsWith(".pdf")) return null;
      return {
        acervoDocumentId: d.id,
        code: d.code,
        title: d.title,
        discipline: String(d.discipline),
        revisionNumber: rev.revisionNumber,
        fileName: rev.fileName,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const initialEap = eapRaw
    ? {
        id: eapRaw.id,
        title: eapRaw.title,
        status: eapRaw.status,
        builtAreaM2: eapRaw.builtAreaM2,
        bdiPercent: eapRaw.bdiPercent,
        cityLabel: `${eapRaw.city.name}/${eapRaw.city.state}`,
        sourceFiles: eapRaw.sourceFiles.map((s) => ({
          id: s.id,
          acervoDocumentId: s.acervoDocumentId,
          fileName: s.fileName,
          sourceSoftware: s.sourceSoftware,
          discipline: s.discipline,
          revisionLabel: s.revisionLabel,
          includedInMining: s.includedInMining,
          status: s.status,
        })),
        conflicts: eapRaw.conflictLogs.map((c) => ({
          id: c.id,
          category: c.category,
          itemDescription: c.itemDescription,
          winningSource: c.winningSource,
          discardedSource: c.discardedSource,
          winningQty: c.winningQty,
          discardedQty: c.discardedQty,
          unit: c.unit,
          reason: c.reason,
          status: c.status,
        })),
        stageSummaries: eapRaw.stages.map((st) => {
          const allItems = st.groups.flatMap((g) => g.items);
          return {
            code: st.code,
            name: st.name,
            itemsCount: allItems.length,
            flaggedItems: allItems
              .filter((i) => Boolean(i.sanityFlag))
              .map((i) => ({
                id: i.id,
                description: i.description,
                unit: i.unit,
                sanityFlag: i.sanityFlag!,
              })),
          };
        }),
      }
    : null;

  return (
    <AppShell eyebrow="EAP & Planejamento" role={admin.role}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          title={`EAP da Obra — ${project.name}`}
          description={`Cliente: ${project.client?.name || "—"} · Curadoria de PDFs (Acervo + Upload), mineração TQS/Revit e compatibilização anti-duplicidade.`}
        />
        <div className="flex items-center gap-2">
          <Link
            href="/admin/eap"
            className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            ← Obras EAP
          </Link>
          <Link
            href="/admin/eap/catalogo"
            className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Catálogo Regional
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <EapProjectHub
          projectId={project.id}
          projectName={project.name}
          cities={citiesRaw}
          initialEap={initialEap}
          acervoPdfs={acervoPdfs}
        />
      </div>
    </AppShell>
  );
}
