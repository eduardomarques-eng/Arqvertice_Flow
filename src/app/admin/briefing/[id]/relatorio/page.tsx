import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/server/auth";
import { getProject } from "@/server/services/project-service";
import { answersOf, getConsolidatedBriefing } from "@/server/services/briefing-service";
import { formatAnswer } from "@/lib/briefing-answers";
import { BriefingReportActions } from "@/components/briefing/briefing-report-actions";
import { ANSWER_KIND, type BriefingQuestion } from "@/lib/briefing-schema";
import { briefingQuestionsFromJson, OFFICIAL_BRIEFING_QUESTIONS } from "@/lib/briefing-template";
import { prisma } from "@/server/db";

const REPORT_CATEGORIES = [
  "01. Perfil, Ocupação & Estilo de Vida",
  "02. Linguagem Arquitetônica, Formas & Materiais",
  "03. Setor Social, Living & Espaço Gourmet",
  "04. Setor Íntimo, Suítes & Acessibilidade",
  "05. Área de Lazer Externa, Piscina & Convivência",
  "06. Paisagismo & Conforto Bioclimático",
  "07. Luminotécnica, Conforto Térmico & Automação",
  "08. Serviços, Sustentabilidade & Dimensionamento Orçamentário",
] as const;

const TECHNICAL_SUGGESTIONS: Record<string, string[]> = {
  official_uso: ["praia"],
  official_estilo: ["tropical"],
  official_social: ["living", "gourmet", "lounge"],
  official_externo: ["piscina", "deck", "paisagismo"],
  official_intimo: ["master", "hospedes"],
  official_conforto: ["quente", "solar"],
  official_investimento: ["alto"],
  q01_uso: ["veraneio_praia"],
  q02_familia: ["casal", "filhos_jovens", "hospedes_frequentes"],
  q03_estilo_volumetria: ["tropical_contemporaneo"],
  q04_pe_direito: ["duplo_monumental", "elevado_3m"],
  q05_relacao_exterior: ["abertura_total"],
  q06_materiais_fachada: ["madeira_ripada", "pedra_natural", "esquadrias_minimalistas"],
  q07_cobertura: ["platibanda_oculta", "pergolados_combinados"],
  q08_acesso_hall: ["porta_pivotante_imponente"],
  q09_living: ["integracao_cozinha", "lavabo_escultural"],
  q10_cozinha: ["cozinha_americana_ilha"],
  q11_gourmet: ["ilha_gourmet", "churrasqueira_carvao_inox", "chopeira_torre"],
  q12_varanda: ["lounge_sofas", "balancos_suspensos"],
  q13_piscina: ["prainha_spa", "borda_infinita"],
  q14_revestimento_piscina: ["pedra_hijau_verde"],
  q15_solarium_deck: ["piso_atermico_cimenticio", "deck_madeira_cumaru"],
  q16_firepit: ["firepit_gas"],
  q17_ducha_externa: ["ducha_escultural_pedra"],
  q18_paisagismo_tropical: ["tropical_denso"],
  q19_suite_master: ["closet_walkin", "banheiro_duplo", "banheira_imersao"],
  q20_suites_demais: ["master_mais_3suites"],
  q21_home_office: ["escritorio_fechado"],
  q22_circulacao_intima: ["copinha_noturna", "rouparia_enxoval"],
  q23_servicos_apoio: ["lavanderia_fechada", "estendal_invisivel", "deposito_praia_pranchas"],
  q24_garagem: ["2vagas_cobertas"],
  q25_iluminacao: ["quente_2700k_3000k"],
  q26_conforto_bioclimatico: ["ventilacao_cruzada", "brises_moveis"],
  q27_automacao_sustentabilidade: ["energia_solar_fotovoltaica", "aquecimento_solar_gas", "automacao_iluminacao_clima"],
  q28_investimento: ["faixa_1500k_2500k", "faixa_2500k_4000k"],
};

function categoryFor(question: BriefingQuestion, index: number) {
  if (question.category && REPORT_CATEGORIES.includes(question.category as (typeof REPORT_CATEGORIES)[number])) return question.category;
  const id = question.id.toLowerCase();
  if (/p1_|official_uso/.test(id)) return REPORT_CATEGORIES[0];
  if (/p2_|p4_estilo|official_estilo/.test(id)) return REPORT_CATEGORIES[1];
  if (/p3_ambientes|p3_distribuicao|official_social/.test(id)) return REPORT_CATEGORIES[2];
  if (/p1_acess|p1_quem|official_intimo/.test(id)) return REPORT_CATEGORIES[3];
  if (/p7_|p8_|official_externo/.test(id)) return REPORT_CATEGORIES[4];
  if (/p5_|p6_|p9_/.test(id)) return REPORT_CATEGORIES[5];
  if (/p11_|p12_|official_conforto/.test(id)) return REPORT_CATEGORIES[6];
  if (/p10_|p17_|p18_|p19_|p20_|official_investimento/.test(id)) return REPORT_CATEGORIES[7];
  return REPORT_CATEGORIES[index % REPORT_CATEGORIES.length];
}

function answerHas(value: unknown, option: string) {
  return Array.isArray(value) ? value.includes(option) : value === option;
}

function questionTypeLabel(type: string) {
  if (type === ANSWER_KIND.SINGLE_SELECT) return "Escolha Única";
  if (type === ANSWER_KIND.MULTI_SELECT || type === ANSWER_KIND.IMAGE_CHOICE) return "Múltipla Escolha";
  if (type === ANSWER_KIND.REPEAT_GROUP || type === ANSWER_KIND.ENVIRONMENT_GROUP) return "Grupo Estruturado";
  return "Descritiva";
}

function formatDate(value: Date) {
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function addressOf(value: unknown) {
  if (!value) return "Não informado";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "formatted" in value) return String(value.formatted);
  return "Não informado";
}

export default async function BriefingReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("ADMIN");
  const { id } = await params;
  const project = await getProject(id);
  if (!project.briefing) notFound();
  const persistedQuestions = briefingQuestionsFromJson(project.briefing.questions);
  const questions = persistedQuestions.length ? persistedQuestions : OFFICIAL_BRIEFING_QUESTIONS;
  if (!project.briefing.questions || !Array.isArray(project.briefing.questions) || project.briefing.questions.length === 0) {
    await prisma.briefing.update({ where: { id: project.briefing.id }, data: { questions: OFFICIAL_BRIEFING_QUESTIONS } });
  }
  const [consolidation] = await Promise.all([getConsolidatedBriefing(id)]);
  const answers = answersOf(project.briefing);
  const status = project.briefing.status === "FINALIZED" ? "Concluído" : project.briefing.status === "DRAFT" ? "Em preenchimento" : "Pendente";
  const location = addressOf(project.address ?? project.client.address);

  return <AppShell eyebrow="Dossiê técnico" role={user.role}>
    <style>{`@media print { body { background: #ffffff !important; color: #111827 !important; } .no-print, .print\\\\:hidden { display: none !important; } .page-break { page-break-before: always; } .report-card, .briefing-report-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; } @page { margin: 14mm; } .briefing-report { max-width: none !important; } }`}</style>
    <div className="print:hidden"><Link href="/admin/briefing" className="text-sm font-semibold text-indigo-600">← Voltar aos Briefings</Link></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 print:hidden"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Visualização executiva</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{project.name}</h1></div><div className="flex items-center gap-3"><Badge tone={status === "Concluído" ? "green" : status === "Em preenchimento" ? "blue" : "amber"}>{status}</Badge><BriefingReportActions briefingId={id} clientName={project.client.name} /></div></div>

    <main className="briefing-report mx-auto mt-8 max-w-5xl space-y-6">
      <header className="briefing-report-card rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold tracking-[0.18em] text-indigo-700">ARQVÉRTICE <span className="font-normal text-slate-400">• ARQUITETURA, ESTRUTURA & ENGENHARIA</span></p>
        <h2 className="mt-10 text-3xl font-bold tracking-tight text-slate-950">PROGRAMA DE NECESSIDADES & DIRETRIZES DE PROJETO</h2>
        <p className="mt-2 text-base italic text-slate-500">Dossiê Técnico Preliminar de Alinhamento e Briefing com o Cliente</p>
        <div className="mt-8 grid gap-3 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2"><div><strong>Cliente / Contratante:</strong> {project.client.fullName ?? project.client.name}</div><div><strong>Obra:</strong> {project.name}</div><div><strong>Localização:</strong> {location}</div><div><strong>Área Construída Alvo:</strong> {typeof project.address === "object" && project.address !== null && "areaConstruida" in project.address ? String(project.address.areaConstruida) : "Não informado"}</div><div><strong>Responsável Técnico:</strong> Eduardo Marques (Arquiteto Projetista)</div><div><strong>Data de Emissão / Versão:</strong> {formatDate(new Date())}</div></div>
      </header>

      <section className="briefing-report-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">1. Resumo executivo e prontidão</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Progresso respondido</p><strong>{consolidation?.progress.percent ?? 0}%</strong></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Status de prontidão</p><strong>{consolidation?.readiness.ready ? "Pronto para revisão" : "Requer complementos"}</strong></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pendências</p><strong>{consolidation?.readiness.blockers.length ?? 0}</strong></div></div>{consolidation?.readiness.blockers.length ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-700">{consolidation.readiness.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>

      <section className="space-y-6"><h2 className="text-xl font-bold text-slate-950">2. Perguntas & diretrizes estratégicas</h2>{REPORT_CATEGORIES.map((category, categoryIndex) => { const grouped = questions.filter((question, index) => categoryFor(question, index) === category); return <section key={category} className={`space-y-3 ${categoryIndex > 0 ? "page-break" : ""}`}><h3 className="text-lg font-bold text-indigo-900">{category}</h3>{grouped.length === 0 ? <p className="text-sm text-slate-400">Nenhuma pergunta cadastrada nesta categoria.</p> : grouped.map((question) => { const answer = answers[question.id]?.value; const options = question.visualOptions ?? question.options ?? []; return <Card key={question.id} className="report-card briefing-report-card"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pergunta {String(questions.indexOf(question) + 1).padStart(2, "0")}</p><h4 className="mt-1 font-bold text-slate-900">{question.text}</h4></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{questionTypeLabel(question.type)}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{question.hint ?? "Esta pergunta orienta a definição do programa de necessidades e das diretrizes do projeto."}</p>{options.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{options.map((option) => { const suggested = TECHNICAL_SUGGESTIONS[question.id]?.includes(option.value) ?? false; const selected = answerHas(answer, option.value); return <div key={option.value} className={`rounded-xl border p-3 ${suggested ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-slate-50/60"}`}>{option.imageUrl ? <img src={option.imageUrl} alt={option.altText ?? option.label} className="mb-2 h-24 w-full rounded-lg object-cover" /> : null}<div className="flex items-start gap-2"><span className={`mt-0.5 ${selected || suggested ? "text-indigo-700" : "text-slate-300"}`}>{selected || suggested ? "✓" : "○"}</span><div><p className="text-sm font-semibold text-slate-800">{option.label}</p>{option.description ? <p className="mt-1 text-xs text-slate-500">{option.description}</p> : null}{suggested ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">[Sugestão Técnica / Padrão ArqVértice]</p> : null}</div></div></div>; })}</div> : <div className="mt-4 min-h-20 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Resposta / anotações de campo</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{formatAnswer(answer) || "Espaço reservado para complementação do cliente."}</p></div>}{answers[question.id]?.professionalNote ? <p className="mt-3 rounded-lg bg-indigo-50 p-2 text-xs text-indigo-800"><strong>Diretriz do estúdio:</strong> {answers[question.id].professionalNote}</p> : null}</Card>; })}</section>; })}</section>

      <section className="briefing-report-card rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">3. Diretrizes estruturadas para validação</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[["Programa de ambientes", consolidation?.program.map((item) => item.name).join(", ") || "Não informado"], ["Serviços previstos", consolidation?.services.join(", ") || "Não informado"], ["Orçamento", consolidation?.budget.range ?? (consolidation?.budget.amount ? `R$ ${consolidation.budget.amount.toLocaleString("pt-BR")}` : "Não informado")], ["Prazo", consolidation?.deadline.date ?? "Não informado"], ["Restrições", consolidation?.restrictions.map((item) => JSON.stringify(item)).join("; ") || "Não informado"], ["Necessidades técnicas", consolidation?.technicalNeeds.map((item) => JSON.stringify(item)).join("; ") || "Não informado"]].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{value}</p></div>)}</div>{consolidation?.conflicts.length ? <div className="mt-5 border-t border-indigo-100 pt-4"><h3 className="font-semibold text-amber-800">Pontos para confirmação</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">{consolidation.conflicts.map((item) => <li key={item.id}><strong>{item.title}:</strong> {item.detail}</li>)}</ul></div> : null}</section>
      <footer className="pb-8 text-center text-xs text-slate-400">Documento preliminar para validação interna e alinhamento com o cliente · ArqVértice</footer>
    </main>
  </AppShell>;
}
