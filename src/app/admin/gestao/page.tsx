import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/server/auth";
import { getCorporateGestaoData } from "@/server/services/gestao-service";
import { GestaoEnterprisePanel } from "@/components/admin/gestao-enterprise-panel";

export const metadata = { title: "Governança & Cadastros Mestres — ArqVértice" };
export const dynamic = "force-dynamic";

export default async function GestaoPage() {
  await requirePageRole("ADMIN");
  const data = await getCorporateGestaoData();

  return (
    <AppShell eyebrow="Governança & Cadastros">
      <GestaoEnterprisePanel
        initialMembers={data.members}
        projects={data.projects}
        disciplines={data.disciplines}
        phases={data.phases}
        roles={data.roles}
      />
    </AppShell>
  );
}

