import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requirePageClientPortal } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PortalRelatorioIndexPage() {
  const user = await requirePageClientPortal();

  const projects = await prisma.project.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { clientId: user.clientId ?? "__none__" },
              { access: { some: { userId: user.id } } },
            ],
          },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, client: { select: { name: true } } },
  });

  if (projects.length === 1) {
    redirect(`/portal/${projects[0].id}/relatorio`);
  }

  if (projects.length === 0) {
    return (
      <AppShell eyebrow="Portal do cliente" environment="client">
        <EmptyState
          title="Nenhum relatório disponível"
          description="Assim que o escritório associar você a uma edificação, o relatório aparecerá aqui."
        />
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Portal do cliente" environment="client">
      <div className="mx-auto max-w-3xl px-4 py-6 font-sans">
        <SectionHeading
          title="Relatórios de Acompanhamento"
          description="Selecione um projeto para abrir o Relatório Simplificado em tempo real."
        />

        <div className="mt-6 grid gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/portal/${project.id}/relatorio`}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 transition"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{project.client?.name ?? "Cliente"}</p>
                </div>
                <Badge tone={project.status === "IN_PROGRESS" ? "blue" : "neutral"}>
                  {project.status === "IN_PROGRESS" ? "Em andamento" : project.status}
                </Badge>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3 flex justify-end">
                <Link
                  href={`/portal/${project.id}/relatorio`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  Abrir Relatório Simplificado →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

