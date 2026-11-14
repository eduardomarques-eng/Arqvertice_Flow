import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { AdminSettingsHub } from "@/components/settings/admin-settings-hub";
import { requirePageAdminRole } from "@/server/auth";
import { getInfrastructureHealth, getStudioSettings } from "@/server/services/settings-service";

export const metadata = { title: "Configurações do Estúdio — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const admin = await requirePageAdminRole();
  const [settings, health] = await Promise.all([
    getStudioSettings(),
    getInfrastructureHealth(),
  ]);

  return (
    <AppShell eyebrow="Administração" role={admin.role}>
      <SectionHeading
        title="Central de Configurações do Estúdio"
        description="Perfil do Administrador, dados institucionais de faturamento, parâmetros comerciais e governança de segurança."
      />
      <AdminSettingsHub
        initialSettings={settings}
        initialProfile={{
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone ?? "",
          whatsapp: admin.whatsapp ?? "",
          professionalReg: admin.professionalReg ?? "",
        }}
        initialHealth={health}
      />
    </AppShell>
  );
}
