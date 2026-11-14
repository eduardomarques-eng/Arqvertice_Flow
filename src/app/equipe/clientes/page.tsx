import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { getEffectivePermissions } from "@/lib/rbac";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function EquipeClientesPage() {
  const user = await requirePageTeamRole();
  const effective = getEffectivePermissions(user);
  if (!effective.includes("clientes")) {
    redirect("/equipe");
  }

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  return (
    <AppShell eyebrow="Base de Clientes" environment="admin" role={user.role}>
      <SectionHeading
        title="Cadastro de Clientes"
        description="Clientes ativos e contatos. Acesso restrito a usuários com permissão clientes."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Clientes ({clients.length})</h2>
        <p className="mt-1 text-sm text-slate-500">
          Lista de clientes cadastrados no estúdio.
        </p>
      </Card>
    </AppShell>
  );
}
