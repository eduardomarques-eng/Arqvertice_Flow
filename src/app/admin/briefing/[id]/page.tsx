import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/server/auth";
import { getProject } from "@/server/services/project-service";
import { answersOf } from "@/server/services/briefing-service";
import { briefingSections } from "@/lib/briefing-definition";
import { formatAnswer } from "@/lib/briefing-answers";

export default async function BriefingAnswersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("ADMIN");
  const { id } = await params;
  const project = await getProject(id);
  if (!project.briefing) notFound();
  const answers = answersOf(project.briefing);
  return (
    <AppShell eyebrow="Dossiê de briefing" role={user.role}>
      <Link href="/admin/briefing" className="text-sm font-semibold text-indigo-600">← Voltar aos briefings</Link>
      <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Dossiê de respostas</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{project.name}</h1><p className="mt-2 text-sm text-slate-500">Cliente: {project.client.name} · {project.briefing.status === "FINALIZED" ? "Briefing respondido" : "Em preenchimento"}</p></div>
      <div className="mt-8 space-y-4">{briefingSections.map((section) => <Card key={section.id}><h2 className="font-bold text-slate-900">{section.step}. {section.title}</h2><div className="mt-4 space-y-4">{section.questions.map((question) => { const answer = formatAnswer(answers[question.id]?.value); return <div key={question.id} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0"><p className="text-xs font-semibold text-slate-400">{question.text}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{answer || "Não respondido"}</p>{answers[question.id]?.professionalNote ? <p className="mt-1 text-xs text-indigo-600">Nota técnica: {answers[question.id].professionalNote}</p> : null}</div>; })}</div></Card>)}</div>
    </AppShell>
  );
}
