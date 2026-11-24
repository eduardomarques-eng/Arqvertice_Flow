import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/server/auth";
import { AcervoPluginsHub } from "@/components/acervo/acervo-plugins-hub";

export const metadata = { title: "Central de Plugins CAD/BIM" };
export const dynamic = "force-dynamic";

export default async function AdminAcervoPluginsPage() {
  await requirePageRole("ADMIN");
  return (
    <AppShell eyebrow="Acervo Manager CDE">
      <AcervoPluginsHub basePath="/admin" />
    </AppShell>
  );
}
