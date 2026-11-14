import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageTeamRole } from "@/server/auth";
import { getEffectivePermissions } from "@/lib/rbac";
import { AcervoPluginsHub } from "@/components/acervo/acervo-plugins-hub";

export const metadata = { title: "Central de Plugins CAD/BIM — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function EquipeAcervoPluginsPage() {
  const user = await requirePageTeamRole();
  if (user.role !== "ADMIN" && !getEffectivePermissions(user).includes("acervo")) {
    redirect("/equipe");
  }
  return (
    <AppShell eyebrow="Acervo Manager CDE">
      <AcervoPluginsHub basePath="/equipe" />
    </AppShell>
  );
}
