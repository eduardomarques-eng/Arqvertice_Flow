import { AppShell } from "@/components/app-shell";
import { getUserFeatureVisibility, requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { seedAcervoManagerDemo } from "@/server/services/acervo-seed";
import {
  Viewer3DHub,
  type Viewer3DProjectOption,
} from "@/components/viewer-3d/viewer-3d-hub";

export const metadata = {
  title: "3D Viewer — ArqVértice Flow",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Admin3DViewerPage() {
  const user = await requirePageRole("ADMIN");
  await seedAcervoManagerDemo();

  const [rawProjects, governance] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    getUserFeatureVisibility(user.id, user.role),
  ]);

  const projects: Viewer3DProjectOption[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || "Cliente",
  }));

  return (
    <AppShell eyebrow="3D Viewer">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            3D Viewer
          </h1>
          <span className="rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#141419] px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
            {projects.length} projeto(s) disponível(is)
          </span>
        </div>
        <div className="min-h-[calc(100vh-9rem)] rounded-2xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#141419] p-3 sm:p-4 shadow-sm">
          <Viewer3DHub
            basePath="/admin"
            projects={projects}
            governance={governance}
            userRole={user.role}
          />
        </div>
      </div>
    </AppShell>
  );
}
