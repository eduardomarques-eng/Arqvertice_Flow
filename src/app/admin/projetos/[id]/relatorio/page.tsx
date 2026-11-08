import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requirePageProjectAccess, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getScheduleReport } from "@/server/services/schedule-report-service";
import { getDeliverableMatrix } from "@/server/services/deliverable-service";
import { SheetMatrixView } from "@/components/deliverables/sheet-matrix-view";
import { REPORT_SUBTITLE } from "@/lib/schedule-report";
import { DUE_SOON_DAYS } from "@/lib/schedule-alerts";

export const dynamic = "force-dynamic";

/**
 * Relatório Executivo de Cronograma & Obras — Fase 3 Refatorado.
 *
 * Visualizador com Padrão Apple HIG, tipografia Montserrat e dados em tempo real
 * vindos do banco Neon.
 *
 * 1. Dados de entrada e ficha técnica do projeto
 * 2. Quadro técnico de engenharia & arquitetura
 * 3. Fase atual do empreendimento
 * 4. Parecer técnico executivo do cronograma (dinâmico e estruturado por disciplina)
 * 5. Síntese de entregas, prazos e alinhamento técnico (unificação das etapas, disciplinas e alertas)
 * 6. Resumo financeiro & cronograma de desembolso
 * Rodapé Institucional do Estúdio (sem bloco de assinaturas manuais).
 */
export default async function ProjectReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);

  const user = await currentUser();
  if (user?.role === "CLIENT") {
    const released = await prisma.projectReport.findFirst({
      where: { projectId: id, status: "RELEASED" },
      select: { id: true },
    });
    if (!released) notFound();
  }

  const [bundle, deliverableMatrix] = await Promise.all([
    getScheduleReport(id),
    getDeliverableMatrix(id, user?.role === "CLIENT" || user?.role === "CLIENTE"),
  ]);

  if (!bundle) notFound();
  const report = bundle.report;
  const pdfUrl = `/api/projects/${id}/cronograma/relatorio/pdf`;

  return (
    <AppShell eyebrow="Relatório Técnico">
      <div className="print-report mx-auto max-w-5xl px-4 py-8 font-sans">
        {/* Cabeçalho Oficial do Estúdio */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                ArqVértice Studio
              </span>
              <span className="text-xs font-medium text-slate-400">· Flow Engineering v2.4</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {report.title}
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              {REPORT_SUBTITLE}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-600">
              Empreendimento: <strong className="text-slate-900">{bundle.projectName}</strong> · Emissão: {report.emittedAtLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 print-hidden">
            <PrintButton />
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Baixar PDF Oficial
            </a>
          </div>
        </div>

        {/* Resumo Rápido de Status (KPI Badges) */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge tone={report.statusGeralTone}>
            Avanço Ponderado: {report.overall.weightedProgress}%
          </Badge>
          <Badge tone="blue">Avanço Linear: {report.overall.progress}%</Badge>
          <Badge tone="neutral">
            {report.overall.completed} de {report.overall.total} etapas concluídas
          </Badge>
          {report.overall.running > 0 ? (
            <Badge tone="blue">{report.overall.running} em andamento</Badge>
          ) : null}
          {report.alerts.overdue > 0 ? <Badge tone="red">{report.alerts.overdue} atrasada(s)</Badge> : null}
          {report.alerts.blocked > 0 ? <Badge tone="amber">{report.alerts.blocked} bloqueada(s)</Badge> : null}
          {report.alerts.dueSoon > 0 ? (
            <Badge tone="amber">{report.alerts.dueSoon} com prazo ≤ {DUE_SOON_DAYS} dias</Badge>
          ) : null}
          {deliverableMatrix.total > 0 ? (
            <Badge tone="green">
              Pranchas: {deliverableMatrix.delivered}/{deliverableMatrix.total} entregues ({deliverableMatrix.complianceRate}%)
            </Badge>
          ) : null}
        </div>

        {/* 1. DADOS DE ENTRADA E FICHA TÉCNICA DO PROJETO */}
        <ReportSection title="1. Dados de Entrada e Ficha Técnica do Projeto">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.ficha.map((row) => (
              <div key={row.label} className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-100">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{row.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </ReportSection>

        {/* 2. QUADRO TÉCNICO DE ENGENHARIA & ARQUITETURA */}
        <ReportSection title="2. Quadro Técnico de Engenharia & Arquitetura">
          {report.equipe.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum responsável atribuído às etapas deste projeto.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.equipe.map((person) => (
                <div key={person.name} className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">{person.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {person.progress}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-blue-600">{person.role}</p>
                    <p className="mt-1 text-xs text-slate-500">Disciplinas: {person.disciplines}</p>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>{person.stages} etapa(s) atribuída(s)</span>
                      <span>{person.progress}%</span>
                    </div>
                    <Progress value={person.progress} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {/* 3. FASE ATUAL DO EMPREENDIMENTO */}
        <ReportSection title="3. Fase Atual do Empreendimento">
          {report.phases.length === 0 ? (
            <p className="text-sm text-slate-500">Sem etapas cadastradas: não há fase a assinalar.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.phases.map((phase) => (
                <li
                  key={phase.discipline}
                  className={`rounded-xl border p-3.5 transition ${
                    phase.current
                      ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-300 shadow-sm"
                      : "border-slate-200/80 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{phase.discipline}</p>
                    {phase.current ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Estamos aqui
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {phase.state} · {phase.completed}/{phase.total} concluídas
                  </p>
                  <div className="mt-2.5">
                    <Progress value={phase.progress} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        {/* 4. PARECER TÉCNICO EXECUTIVO DO CRONOGRAMA (DINÂMICO E ESTRUTURADO) */}
        <ReportSection title="4. Parecer Técnico Executivo do Cronograma">
          <div className="space-y-4">
            {/* Introdução e Síntese Geral */}
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-slate-50/70 to-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                {report.parecerEstruturado?.introducao || report.parecer[0]}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-blue-100/60 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Avanço Físico Ponderado Oficial:</span>
                  <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                    {report.overall.weightedProgress}%
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  (Progresso linear simples: {report.overall.progress}% · {report.overall.completed} concluídas, {report.overall.running} em andamento, {report.overall.pending} programadas)
                </div>
              </div>
            </div>

            {/* Diagnósticos Estruturados por Disciplina */}
            <div className="grid gap-3 sm:grid-cols-2">
              {report.parecerEstruturado?.disciplinas?.map((disc) => (
                <div key={disc.disciplina} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">{disc.disciplina}</span>
                    <Badge tone={disc.progresso === 100 ? "green" : disc.progresso > 0 ? "blue" : "neutral"}>
                      {disc.progresso}% concluído
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{disc.texto}</p>
                  <div className="mt-3">
                    <Progress value={disc.progresso} />
                  </div>
                </div>
              ))}
            </div>

            {/* Alinhamento Operacional e Mitigação de Riscos */}
            <div className={`rounded-xl border p-3.5 ${
              report.alerts.overdue > 0
                ? "border-rose-200 bg-rose-50/60 text-rose-900"
                : "border-emerald-200 bg-emerald-50/60 text-emerald-900"
            }`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-sm">
                  {report.alerts.overdue > 0 ? "⚠️" : "✅"}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Alinhamento Operacional & Prazos
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {report.parecerEstruturado?.alinhamentoOperacional || report.parecer.at(-1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ReportSection>

        {/* 5. SÍNTESE DE ENTREGAS, PRAZOS E ALINHAMENTO TÉCNICO (UNIFICAÇÃO DOS ITENS 5, 7 E 8) */}
        <ReportSection title="5. Síntese de Entregas, Prazos e Alinhamento Técnico">
          <div className="space-y-6">
            {/* 5.1 Resumo Rápido das Disciplinas */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                5.1 Avanço Físico Integrado por Disciplina
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {report.sinteseEntregas.disciplines.map((d) => (
                  <div key={d.discipline} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{d.discipline}</span>
                      <span className="font-bold text-blue-600">{d.progress}%</span>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={d.progress} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {d.completed} de {d.total} etapas concluídas
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 5.2 Quadro Consolidado de Etapas & Entregas */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                5.2 Quadro Geral de Etapas, Prazos e Status Físico
              </h3>
              {report.sinteseEntregas.stages.length === 0 ? (
                <p className="text-xs text-slate-500">Sem etapas cadastradas no cronograma.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 pl-3 pr-2">#</th>
                        <th className="py-2.5 px-2">Descrição da Etapa</th>
                        <th className="py-2.5 px-2">Disciplina</th>
                        <th className="py-2.5 px-2">Responsável</th>
                        <th className="py-2.5 px-2">Data Limite</th>
                        <th className="py-2.5 px-2 w-32">Avanço Físico</th>
                        <th className="py-2.5 pr-3 pl-2">Status Operacional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {report.sinteseEntregas.stages.map((stage) => (
                        <tr key={stage.order} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-slate-400">
                            {String(stage.order).padStart(2, "0")}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-900">
                            {stage.name}
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {stage.discipline}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">{stage.designer}</td>
                          <td className="py-2.5 px-2 text-slate-600 font-medium">{stage.dueDate}</td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <Progress value={stage.completion} />
                              </div>
                              <span className="font-semibold text-slate-900 text-[11px]">{stage.completion}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 pl-2">
                            <Badge tone={
                              stage.completion === 100 ? "green" :
                              stage.alert.overdue ? "red" :
                              stage.alert.blocked ? "amber" :
                              stage.completion > 0 ? "blue" : "neutral"
                            }>
                              {stage.statusLabel} {stage.alertDetail ? `· ${stage.alertDetail}` : ""}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 5.3 Painel de Alertas, Pendências e Próximos Marcos */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                5.3 Alinhamento Operacional e Próximos Marcos Previstos
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Em Andamento Ativo */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">Etapas em Desenvolvimento Ativo</span>
                    <Badge tone="blue">{report.sinteseEntregas.pendencias.emAndamento.length} ativa(s)</Badge>
                  </div>
                  {report.sinteseEntregas.pendencias.emAndamento.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Nenhuma etapa com avanço parcial no momento.</p>
                  ) : (
                    <ul className="mt-2.5 divide-y divide-slate-100 text-xs">
                      {report.sinteseEntregas.pendencias.emAndamento.map((s) => (
                        <li key={s.name} className="py-1.5 flex items-center justify-between">
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span className="font-bold text-blue-600">{s.completion}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Próximas Entregas na Fila */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">Próximos Marcos Programados</span>
                    <Badge tone="neutral">{report.sinteseEntregas.pendencias.proximosMarcos.length} na fila</Badge>
                  </div>
                  {report.sinteseEntregas.pendencias.proximosMarcos.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Todas as etapas já foram iniciadas ou concluídas.</p>
                  ) : (
                    <ul className="mt-2.5 divide-y divide-slate-100 text-xs">
                      {report.sinteseEntregas.pendencias.proximosMarcos.map((s) => (
                        <li key={s.name} className="py-1.5 flex items-center justify-between">
                          <span className="text-slate-700">{s.name}</span>
                          <span className="text-slate-400 font-mono text-[11px]">{s.dueDate}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* 5.4 Matriz de Pranchas & Plantas Técnicas */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                5.4 Matriz de Pranchas Técnicas: Entregues vs. Pendentes por Disciplina
              </h3>
              <SheetMatrixView matrix={deliverableMatrix} projectId={id} isClientView={user?.role === "CLIENT"} />

              {/* Tabelas Detalhadas de Conferência */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {/* Pranchas Liberadas / Concluídas */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Pranchas Concluídas & Homologadas ({report.matrizPranchas.concluidas.length})
                    </span>
                    <Badge tone="green">Liberadas</Badge>
                  </div>
                  {report.matrizPranchas.concluidas.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Nenhuma prancha concluída até o momento.</p>
                  ) : (
                    <div className="mt-2 max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                            <th className="py-1.5 pl-1">Código</th>
                            <th className="py-1.5 px-1">Assunto</th>
                            <th className="py-1.5 px-1">Rev</th>
                            <th className="py-1.5 pr-1 text-right">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {report.matrizPranchas.concluidas.map((p) => (
                            <tr key={p.sheetCode + p.subject} className="hover:bg-slate-50/50">
                              <td className="py-1.5 pl-1 font-mono font-bold text-blue-700">{p.sheetCode}</td>
                              <td className="py-1.5 px-1 font-medium text-slate-800 truncate max-w-[140px]">{p.subject}</td>
                              <td className="py-1.5 px-1 font-mono text-slate-500">{p.version}</td>
                              <td className="py-1.5 pr-1 text-right text-slate-500">{p.data}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pranchas em Desenvolvimento / Previstas */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Pranchas em Desenvolvimento ({report.matrizPranchas.emDesenvolvimento.length})
                    </span>
                    <Badge tone="blue">Em elaboração</Badge>
                  </div>
                  {report.matrizPranchas.emDesenvolvimento.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Todas as pranchas previstas foram homologadas.</p>
                  ) : (
                    <div className="mt-2 max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                            <th className="py-1.5 pl-1">Disciplina</th>
                            <th className="py-1.5 px-1">Assunto Previsto</th>
                            <th className="py-1.5 px-1">Responsável</th>
                            <th className="py-1.5 pr-1 text-right">Prazo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {report.matrizPranchas.emDesenvolvimento.map((p) => (
                            <tr key={p.sheetCode + p.subject} className="hover:bg-slate-50/50">
                              <td className="py-1.5 pl-1 font-medium text-slate-700">{p.discipline}</td>
                              <td className="py-1.5 px-1 font-medium text-slate-800 truncate max-w-[140px]">{p.subject}</td>
                              <td className="py-1.5 px-1 text-slate-500">{p.responsavel}</td>
                              <td className="py-1.5 pr-1 text-right text-slate-500 font-mono">{p.prazo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ReportSection>

        {/* 6. RESUMO FINANCEIRO & CRONOGRAMA DE DESEMBOLSO */}
        <ReportSection title="6. Resumo Financeiro & Cronograma de Desembolso">
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.financial.rows.map((row) => (
                <div key={row.label} className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-100">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{row.label}</dt>
                  <dd className="mt-1 text-sm font-bold text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs font-semibold text-blue-900">
              {report.financial.nextPayment}
            </div>

            {report.financial.payments.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 pl-3 pr-2">Parcela</th>
                      <th className="py-2.5 px-2">Data Prevista</th>
                      <th className="py-2.5 px-2">Data Pagamento</th>
                      <th className="py-2.5 px-2">Etapa Vinculada</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 pr-3 pl-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.financial.payments.map((p) => (
                      <tr key={p.name} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 pl-3 pr-2 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-2 text-slate-600">{p.dueDate}</td>
                        <td className="py-2.5 px-2 text-slate-600">{p.paidAt}</td>
                        <td className="py-2.5 px-2 text-slate-600">{p.stage}</td>
                        <td className="py-2.5 px-2">
                          <Badge tone={p.status === "Liquidado" || p.status === "PAID" ? "green" : "neutral"}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3 pl-2 text-right font-bold text-slate-900">{p.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </ReportSection>

        {/* RODAPÉ INSTITUCIONAL OFICIAL (SEM BLOCO DE ASSINATURAS MANUAIS) */}
        <div className="mt-10 border-t border-slate-200 pt-6">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                ArqVértice Studio · Arquitetura, Estrutura & Engenharia
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Relatório Técnico de Acompanhamento Físico · Emissão em {report.emittedAtLabel} · Versão 2.4 Oficial · Hash: <strong className="font-mono text-slate-800">{report.documentHash}</strong>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Documento oficial gerado e certificado digitalmente pelo Sistema ArqVértice Flow. Dispensa assinaturas manuscritas.
              </p>
            </div>
            <div className="mt-3 sm:mt-0 print-hidden">
              <Link
                href={`/admin/projetos/${id}/cronograma`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                ← Voltar ao Cronograma Geral
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="border-l-4 border-blue-600 pl-3 text-xs font-bold uppercase tracking-wider text-slate-900">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
