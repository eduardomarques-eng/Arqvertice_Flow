import { AppShell } from "@/components/app-shell";
import { requirePageTeamRole } from "@/server/auth";
import { AcervoPluginsHub } from "@/components/acervo/acervo-plugins-hub";

export const metadata = { title: "Central de Plugins CAD/BIM — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function EquipeAcervoPluginsPage() {
  await requirePageTeamRole();
  return (
    <AppShell eyebrow="Acervo Manager CDE">
      <AcervoPluginsHub basePath="/equipe" />
    </AppShell>
  );
}
