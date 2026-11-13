import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModulePermission } from "@/lib/rbac-helpers";
import { listCommercialPackages, listServiceCatalog } from "@/server/services/service-catalog-service";

export const dynamic = "force-dynamic";

export default async function EquipeFinanceiroPage() {
  const user = await requirePageTeamRole();
  requireModulePermission(user, "financeiro");

  const [services, packages] = await Promise.all([
    listServiceCatalog({ includeInactive: false }),
    listCommercialPackages(),
  ]);

  return (
    <AppShell eyebrow="Gestão Financeira" environment="admin" role={user.role}>
      <SectionHeading
        title="Catálogo de Serviços e Pacotes"
        description="Preços e faixas comerciais definidos pelo ADMIN. Acesso restrito a usuários com permissão financeiro."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Catálogo de serviços</h2>
        <p className="mt-1 text-sm text-slate-500">
          Serviços ativos disponíveis para composição de propostas.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Pacotes comerciais</h2>
        <p className="mt-1 text-sm text-slate-500">
          Composição configurável de serviços em pacotes comerciais.
        </p>
      </Card>
    </AppShell>
  );
}
