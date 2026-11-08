import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requirePageClientPortal } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Projetos & Pranchas" };
export const dynamic = "force-dynamic";

export default async function PortalProjetosPage() {
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
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      client: { select: { name: true } },
    },
  });

  // Se o cliente tem apenas 1 projeto (caso comum do Pedro), direciona diretamente para o painel com a galeria de pranchas
  if (projects.length === 1) {
    redirect(`/portal/${projects[0].id}`);
  }

  return (
    <AppShell eyebrow="Portal do cliente" environment="client">
      <div className="mx-auto max-w-4xl px-4 py-6 font-sans">
        <SectionHeading
          title="Meus Projetos & Pranchas"
          description="Selecione um projeto para acessar o acervo de pranchas técnicas, memoriais e renders 3D homologados."
        />

        {projects.length === 0 ? (
          <EmptyState
            title="Nenhum projeto associado"
            description="Assim que o estúdio liberar suas pranchas, elas estarão disponíveis aqui."
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{project.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {project.client?.name ?? "Cliente"} · {project.type ?? "Residencial"}
                    </p>
                  </div>
                  <Badge tone={project.status === "IN_PROGRESS" ? "blue" : "neutral"}>
                    {project.status === "IN_PROGRESS" ? "Em andamento" : project.status}
                  </Badge>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3 flex justify-end">
                  <Link
                    href={`/portal/${project.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    Ver Pranchas & Renders →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

