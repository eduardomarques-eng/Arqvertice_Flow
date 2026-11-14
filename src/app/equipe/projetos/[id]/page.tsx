import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isTeamRole, requirePageProjectAccess } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function TeamProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageProjectAccess(id);
  if (user.role !== "ADMIN" && !isTeamRole(user.role)) {
    return null;
  }
  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      scope: true,
      startDate: true,
      expectedEndDate: true,
      status: true,
      client: { select: { name: true, email: true, phone: true, city: true, state: true } },
    },
  });
  if (!project) return null;

  return (
    <AppShell eyebrow="Ficha técnica" role={user.role}>
      <Link href="/equipe" className="text-sm font-semibold text-blue-600">← Voltar à equipe</Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="blue">Projeto atribuído</Badge>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-500">{project.type ?? "Projeto arquitetônico"} · {project.status}</p>
        </div>
        <Link href={`/equipe/cronograma/${id}`} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Abrir Kanban
        </Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-950">Dados básicos do cliente</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-400">Nome</dt><dd className="font-medium text-slate-800">{project.client.name}</dd></div>
            {project.client.email ? <div><dt className="text-slate-400">E-mail</dt><dd className="font-medium text-slate-800">{project.client.email}</dd></div> : null}
            {project.client.phone ? <div><dt className="text-slate-400">Telefone</dt><dd className="font-medium text-slate-800">{project.client.phone}</dd></div> : null}
            {project.client.city ? <div><dt className="text-slate-400">Localidade</dt><dd className="font-medium text-slate-800">{project.client.city}{project.client.state ? ` - ${project.client.state}` : ""}</dd></div> : null}
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-950">Ficha do projeto</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-400">Escopo</dt><dd className="font-medium text-slate-800">{project.scope ?? "Não informado"}</dd></div>
            <div><dt className="text-slate-400">Descrição</dt><dd className="font-medium text-slate-800">{project.description ?? "Não informado"}</dd></div>
            <div><dt className="text-slate-400">Período</dt><dd className="font-medium text-slate-800">{project.startDate?.toLocaleDateString("pt-BR") ?? "—"} a {project.expectedEndDate?.toLocaleDateString("pt-BR") ?? "—"}</dd></div>
          </dl>
        </Card>
      </div>
    </AppShell>
  );
}
