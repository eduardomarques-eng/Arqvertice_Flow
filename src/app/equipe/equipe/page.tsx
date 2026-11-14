import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { getEffectivePermissions } from "@/lib/rbac";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const user = await requirePageTeamRole();
  const effective = getEffectivePermissions(user);
  if (!effective.includes("equipe")) {
    redirect("/equipe");
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, email: true, isActive: true },
  });

  return (
    <AppShell eyebrow="Equipe & Governança" environment="admin" role={user.role}>
      <SectionHeading
        title="Colaboradores e Governança"
        description="Gestão de colaboradores da equipe técnica. Acesso restrito a usuários com permissão equipe."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Equipe ({users.length})</h2>
        <p className="mt-1 text-sm text-slate-500">
          Colaboradores ativos do estúdio.
        </p>
      </Card>
    </AppShell>
  );
}
