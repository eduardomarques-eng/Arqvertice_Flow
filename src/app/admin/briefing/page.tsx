import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { BriefingLinkManager } from "@/components/briefing/briefing-link-manager";
import { getBriefingLinkStatus } from "@/server/services/briefing-link-service";

export default async function BriefingAdminPage() {
  const user = await requirePageRole("ADMIN");
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { client: { select: { name: true, phone: true, email: true } }, briefing: { select: { status: true, submittedAt: true } } },
  });
  const pending = projects.filter((project) => project.briefing?.status !== "FINALIZED").length;
  const rows = await Promise.all(projects.map(async (project) => ({ project, linkStatus: await getBriefingLinkStatus(project.id) })));

  return (
    <AppShell eyebrow="Briefing" role={user.role}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Quiz de descoberta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Briefings dos projetos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Crie um link seguro para cada cliente, acompanhe as respostas e abra o dossiê completo sem sair do fluxo comercial.</p>
        </div>
        <Badge tone={pending ? "amber" : "green"}>{pending} pendente(s)</Badge>
      </div>

      <div className="mt-8 grid gap-4">
        {projects.length === 0 ? <Card className="border-dashed text-center text-sm text-slate-500">Cadastre um projeto para iniciar um briefing.</Card> : rows.map(({ project, linkStatus }) => {
          const status = project.briefing?.status === "FINALIZED" ? "Respondido" : project.briefing ? "Em preenchimento" : "Pendente";
          return (
            <Card key={project.id} className="overflow-hidden">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-900">{project.name}</h2><Badge tone={status === "Respondido" ? "green" : status === "Em preenchimento" ? "blue" : "amber"}>{status}</Badge></div>
                  <p className="mt-1 text-sm text-slate-500">{project.client.name} · {project.client.email ?? "sem e-mail"} · {project.client.phone ?? "sem WhatsApp"}</p>
                  <p className="mt-2 text-xs text-slate-400">{project.briefing?.submittedAt ? `Respondido em ${project.briefing.submittedAt.toLocaleDateString("pt-BR")}` : "Ainda não enviado ao cliente"}</p>
                </div>
                <div className="flex flex-wrap gap-3"><Link href={`/admin/briefing/${project.id}/editor`} className="text-sm font-semibold text-slate-700 hover:text-indigo-700">Editar perguntas →</Link><Link href={`/admin/briefing/${project.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Ver respostas →</Link><Link href={`/admin/briefing/${project.id}/relatorio`} className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-indigo-600">Ver relatório formatado <span aria-hidden="true">→</span></Link></div>
              </div>
              <BriefingLinkManager projectId={project.id} clientName={project.client.name} clientPhone={project.client.phone} initialStatus={linkStatus.briefingStatus} initialLinkStatus={linkStatus.linkStatus === "ACTIVE" ? "ACTIVE" : "REVOKED"} />
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
