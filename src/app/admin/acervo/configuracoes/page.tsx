import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { AcervoConfigView } from "@/components/acervo/acervo-config-view";

export const metadata = { title: "Integrações CAD/BIM — Acervo Manager" };
export const dynamic = "force-dynamic";

export default async function AdminAcervoConfigPage() {
  const user = await requirePageRole("ADMIN");

  const rawProjects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      client: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || undefined,
  }));

  return (
    <AppShell eyebrow="Acervo Manager CDE · Configurações" role={user.role}>
      <SectionHeading
        title="Integrações CAD/BIM (AutoCAD & Revit Sync API)"
        description="Gerencie tokens de autenticação SHA-256 para automação de plotagem, scripts LISP e plugins Revit conectados diretamente ao Acervo Manager."
      />
      <div className="mt-6">
        <AcervoConfigView projects={projects} userRole={user.role} />
      </div>
    </AppShell>
  );
}
