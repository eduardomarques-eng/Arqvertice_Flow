import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";

export const dynamic = "force-dynamic";

export default async function EquipeMensagensPage() {
  const user = await requirePageTeamRole();
  await requireModuleAccess("dashboard");

  return (
    <AppShell eyebrow="Mensagens" role={user.role}>
      <SectionHeading
        title="Mensagens e Templates"
        description="Templates de mensagem e comunicação interna. Acesso restrito à equipe técnica."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Mensagens</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gestão de templates de WhatsApp e mensagens internas.
        </p>
      </Card>
    </AppShell>
  );
}
