import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requirePageProjectAccess, requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { getProject } from "@/server/services/project-service";
import { getBriefingQuestions } from "@/server/services/briefing-service";
import { BriefingCanvas } from "@/components/briefing/briefing-canvas";

export const dynamic = "force-dynamic";

export default async function EquipeBriefingEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");
  const { id } = await params;
  await requirePageProjectAccess(id);

  const [project, briefing] = await Promise.all([getProject(id), getBriefingQuestions(id)]);
  return (
    <AppShell eyebrow="Canvas de briefing" role={user.role}>
      <Link href="/equipe/briefing" className="text-sm font-semibold text-indigo-600">← Voltar aos briefings</Link>
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Construtor visual</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{project.client.name} · Perguntas do quiz</h1>
        <p className="mt-2 text-sm text-slate-500">
          Reordene, desative e personalize as perguntas deste cliente. As alterações só ficam públicas depois de salvar.
        </p>
      </div>
      <div className="mt-8">
        <BriefingCanvas projectId={id} initialTitle={briefing.title} initialQuestions={briefing.questions} />
      </div>
    </AppShell>
  );
}
