import { AppShell } from "@/components/app-shell";
import { Pipeline3DView } from "@/components/acervo/pipeline-3d-view";
import { requirePageRole } from "@/server/auth";

export const metadata = { title: "Pipeline Pré-Build 3D — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminPipeline3DPage() {
  await requirePageRole("ADMIN");

  return (
    <AppShell>
      <Pipeline3DView basePath="/admin" />
    </AppShell>
  );
}
