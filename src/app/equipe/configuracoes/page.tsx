import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { getEffectivePermissions } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function EquipeConfiguracoesPage() {
  const user = await requirePageTeamRole();
  if (user.role !== "ADMIN") {
    const effective = getEffectivePermissions(user);
    if (!effective.includes("equipe")) {
      redirect("/equipe");
    }
  }

  return (
    <AppShell eyebrow="Configurações" environment="admin" role={user.role}>
      <SectionHeading
        title="Configurações da Equipe"
        description="Configurações operacionais da equipe técnica."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Configurações</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ajustes de operação da equipe técnica.
        </p>
      </Card>
    </AppShell>
  );
}
