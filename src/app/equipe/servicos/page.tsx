import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { listServiceCatalog } from "@/server/services/service-catalog-service";

export const dynamic = "force-dynamic";

export default async function EquipeServicosPage() {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");

  const services = await listServiceCatalog({ includeInactive: false });

  return (
    <AppShell eyebrow="Serviços" role={user.role}>
      <SectionHeading
        title="Catálogo de Serviços"
        description="Serviços disponíveis para composição de propostas e projetos."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Serviços Ativos ({services.length})</h2>
        <p className="mt-1 text-sm text-slate-500">
          Catálogo de serviços do estúdio.
        </p>
      </Card>
    </AppShell>
  );
}
