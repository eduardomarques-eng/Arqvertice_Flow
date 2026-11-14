import { AppShell } from "@/components/app-shell";
import { Pipeline3DView } from "@/components/acervo/pipeline-3d-view";
import { requirePageTeamRole } from "@/server/auth";

export const metadata = { title: "Pipeline Pré-Build 3D — Equipe ArqVértice" };
export const dynamic = "force-dynamic";

export default async function EquipePipeline3DPage() {
  await requirePageTeamRole();

  return (
    <AppShell>
      <Pipeline3DView basePath="/equipe" />
    </AppShell>
  );
}
