import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { EapProjectHub } from "@/components/eap/eap-project-hub";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";

export const metadata = { title: "Hub EAP da Obra" };
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

  const [citiesRaw, eapRaw] = await Promise.all([
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
  ]);

  const initialEap = eapRaw
    ? {
        id: eapRaw.id,
        cityId: eapRaw.cityId,
        title: eapRaw.title,
        status: eapRaw.status,
        builtAreaM2: eapRaw.builtAreaM2,
        bdiPercent: eapRaw.bdiPercent,
        cityLabel: `${eapRaw.city.name}/${eapRaw.city.state}`,
        sourceFiles: eapRaw.sourceFiles.map((s) => ({
          id: s.id,
          fileName: s.fileName,
          sourceSoftware: s.sourceSoftware,
          discipline: s.discipline,
          revisionLabel: s.revisionLabel,
          versionCode: s.versionCode,
          versionNumber: s.versionNumber,
          isActive: s.isActive,
          revisionNote: s.revisionNote,
          supersedesId: s.supersedesId,
          createdAt: s.createdAt.toISOString(),
          includedInMining: s.includedInMining,
          status: s.status,
          extractedSummaryJson:
            (s.extractedSummaryJson as {
              carbonKgCo2?: number | null;
              zeroSteelAlert?: {
                concreteM3: number;
                suggestedKg: number;
                message: string;
              } | null;
            } | null) ?? null,
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
          title={`EAP — ${project.name}`}
          description={`Cliente: ${project.client?.name || "—"} · Quantitativos, orçamento regional e planejamento LOB.`}
        />
        <div className="flex items-center gap-2">
          <Link
            href="/admin/eap"
            className="apple-glass-btn text-xs h-9"
          >
            ← Obras EAP
          </Link>
          <Link
            href="/admin/eap/catalogo"
            className="apple-glass-btn text-xs h-9"
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
        />
      </div>
    </AppShell>
  );
}
