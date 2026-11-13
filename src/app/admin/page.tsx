import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { executiveDashboardData } from "@/server/services/dashboard-service";
import { currentUser } from "@/server/auth";
import { QuickProjectAction } from "@/components/dashboard/quick-project-action";
import { getEffectivePermissions } from "@/lib/rbac";

export const metadata = { title: "Command Center" };
export const dynamic = "force-dynamic";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const date = (value: Date | null) =>
  value
    ? value.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
    : "Sem prazo";

const statusLabel: Record<string, string> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const disciplineColors = [
  "bg-pink-500",
  "bg-indigo-600",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
];

function Arrow() {
  return (
    <span aria-hidden="true" className="text-neutral-300">
      →
    </span>
  );
}

export default async function AdminDashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  // Se cliente, redirecionar para o portal
  if (user.role === "CLIENTE" || (user.role as string) === "CLIENT") {
    redirect("/portal");
  }

  const effectivePermissions = getEffectivePermissions({
    role: user.role,
    permissions: user.permissions,
  });

  const canViewFinancial =
    user.role === "ADMIN" || effectivePermissions.includes("financeiro");
  const canViewSchedule =
    user.role === "ADMIN" || effectivePermissions.includes("cronograma");
  const canViewProjects =
    user.role === "ADMIN" || effectivePermissions.includes("projetos");
  const canViewClients =
    user.role === "ADMIN" || effectivePermissions.includes("clientes");
  const canViewTeam =
    user.role === "ADMIN" || effectivePermissions.includes("equipe");

  let data: Awaited<ReturnType<typeof executiveDashboardData>>;
  try {
    data = await executiveDashboardData();
  } catch (error) {
    console.error(
      "[DASHBOARD_CRASH] Erro ao buscar dados para o usuário:",
      user?.id,
      user?.role,
      error,
    );
    return (
      <AppShell eyebrow="Executive Command Center">
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm font-semibold text-amber-900">
            Painel temporariamente indisponível
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Não foi possível carregar os dados do estúdio. Tente novamente em
            alguns instantes.
          </p>
          <Link
            href="/admin"
            className="mt-4 inline-flex text-sm font-semibold text-amber-900 underline"
          >
            Tentar novamente
          </Link>
        </Card>
      </AppShell>
    );
  }

  const { metrics, projects, deliveries, team, proposalFunnel } = data;
  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const pendingAlerts = metrics.stagesWithoutOwner + metrics.dueSoon;

  // Filtra as etapas atribuídas ao profissional logado
  const myAssignedDeliveries = deliveries.filter(
    (d) => d.designer && d.designer.toLowerCase().includes(user.name.toLowerCase().split(" ")[0])
  );

  return (
    <AppShell eyebrow="Executive Command Center">
      <div className="space-y-8">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              ArqVértice Flow / Command Center
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              {greeting}, {user.name}.
            </h1>
            <p className="mt-2 max-w-xl text-sm font-light leading-6 text-neutral-600">
              {canViewFinancial
                ? "Panorama operacional e comercial consolidado do estúdio ArqVértice."
                : "Panorama técnico, operacional e entregas executivas em andamento."}
            </p>
            {pendingAlerts > 0 && canViewSchedule ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                {pendingAlerts} pendência(s) exigem atenção
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canViewProjects && <QuickProjectAction clients={data.clients} />}
            {canViewProjects && (
              <Link
                href="/admin/briefing"
                className="rounded-xl border border-neutral-200/70 bg-white/80 px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:text-neutral-950"
              >
                Novo Briefing
              </Link>
            )}
            {canViewSchedule && (
              <Link
                href="/operacao"
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                Ver Cronograma Geral <Arrow />
              </Link>
            )}
          </div>
        </header>

        {/* MINHAS ATRIBUIÇÕES PRIORITÁRIAS (Quando o profissional tem cronograma ativo) */}
        {canViewSchedule && myAssignedDeliveries.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/40 p-5 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <h3 className="text-sm font-bold text-blue-950">
                  Minhas Atribuições Prioritárias ({myAssignedDeliveries.length})
                </h3>
              </div>
              <Link href="/operacao" className="text-xs font-bold text-blue-600 hover:text-blue-800">
                Ver no Kanban →
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {myAssignedDeliveries.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{item.projectName}</p>
                  </div>
                  <Badge tone={item.overdue ? "red" : "amber"} className="text-[10px]">
                    {item.overdue ? "Atrasado" : "Em prazo"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CARDS DE INDICADORES (KPIs Condicionados a Permissões) */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* BLOCO FINANCEIRO: Exclusivo se canViewFinancial */}
          {canViewFinancial && (
            <>
              <Kpi
                icon="◈"
                label="Total faturado / recebido"
                value={money(metrics.installmentsReceived)}
                detail="Total liquidado em parcelas de contratos ativos"
                tone="emerald"
              />
              <Kpi
                icon="◌"
                label="Saldo a faturar"
                value={money(metrics.openBalance)}
                detail={
                  metrics.nextInstallment
                    ? `Próximo vencimento: ${date(metrics.nextInstallment.dueDate)}`
                    : "Nenhum vencimento pendente"
                }
                tone="sky"
              />
            </>
          )}

          {canViewProjects && (
            <Kpi
              icon="▣"
              label="Projetos em execução"
              value={String(metrics.activeProjects)}
              detail={
                metrics.delayedStages === 0
                  ? "100% no prazo"
                  : `${metrics.delayedStages} etapa(s) em atraso`
              }
              tone="indigo"
            />
          )}

          {canViewClients && (
            <Kpi
              icon="✦"
              label="Briefings de descoberta"
              value={String(metrics.pendingBriefings)}
              detail={`${metrics.finalizedBriefings} respondido(s) · ${
                metrics.finalizedBriefings + metrics.pendingBriefings
                  ? Math.round(
                      (metrics.finalizedBriefings /
                        (metrics.finalizedBriefings + metrics.pendingBriefings)) *
                        100
                    )
                  : 0
              }% de resposta`}
              tone="pink"
            />
          )}

          {canViewSchedule && (
            <>
              <Kpi
                icon="⌁"
                label="Índice médio de avanço físico"
                value={`${metrics.averageProgress.toLocaleString("pt-BR")}%`}
                detail="Média ponderada de todas as obras"
                tone="amber"
              />
              <Kpi
                icon="✓"
                label="Entregas concluídas"
                value={`${metrics.completedStages} de ${metrics.totalStages}`}
                detail="Etapas finalizadas no ecossistema"
                tone="neutral"
              />
            </>
          )}
        </section>

        {/* PANORAMA OPERACIONAL & PROJETOS */}
        {canViewProjects && (
          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="overflow-hidden p-0">
              <PanelHeader
                title="Panorama dos projetos"
                description="Avanço físico consolidado por carteira."
                href="/admin/projetos"
                action="Ver todos"
              />
              {projects.length === 0 ? (
                <EmptyState
                  title="Nenhum projeto com cronograma"
                  description="Adicione etapas para acompanhar a evolução aqui."
                />
              ) : (
                <div className="divide-y divide-neutral-100">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/admin/projetos/${project.id}`}
                      className="block px-5 py-5 transition hover:bg-neutral-50/70"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-900">{project.name}</p>
                          <p className="mt-1 text-xs font-light text-neutral-500">
                            {project.clientName} · {project.currentStage ?? "Sem etapa em andamento"}
                          </p>
                        </div>
                        <span className="shrink-0 text-lg font-bold text-neutral-900">
                          {project.progress}%
                        </span>
                      </div>
                      <div className="mt-3">
                        <Progress value={project.progress} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        {project.disciplines.map((discipline, index) => (
                          <div key={discipline.discipline} className="min-w-[120px] flex-1">
                            <div className="flex justify-between text-[11px] text-neutral-500">
                              <span className="truncate">{discipline.discipline}</span>
                              <b className="text-neutral-700">{discipline.progress}%</b>
                            </div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className={`h-full rounded-full ${
                                  disciplineColors[index % disciplineColors.length]
                                }`}
                                style={{ width: `${discipline.progress}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={project.status === "IN_PROGRESS" ? "blue" : "neutral"}>
                          {statusLabel[project.status] ?? project.status}
                        </Badge>
                        <span className="text-xs text-neutral-400">
                          Próximo prazo: {date(project.nextDueDate)}
                        </span>
                        {project.delayedStages > 0 ? (
                          <span className="text-xs font-medium text-rose-600">
                            {project.delayedStages} atrasada(s)
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {canViewSchedule && (
              <Card>
                <PanelHeader
                  title="Radar de entregas"
                  description="Janela operacional de 14 dias."
                  href="/operacao"
                  action="Abrir operação"
                />
                <div className="mt-5 space-y-4">
                  {deliveries.length === 0 ? (
                    <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">
                      Nenhuma entrega prevista para esta janela.
                    </p>
                  ) : (
                    deliveries.slice(0, 6).map((delivery) => (
                      <Link
                        key={delivery.id}
                        href={`/admin/projetos/${delivery.projectId}/cronograma`}
                        className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-neutral-50"
                      >
                        <div
                          className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                            delivery.overdue ? "bg-rose-500" : "bg-indigo-500"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-800">
                            {delivery.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-neutral-400">
                            {delivery.projectName} · {delivery.designer ?? "Sem responsável"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                            delivery.overdue
                              ? "bg-rose-50 text-rose-600"
                              : delivery.dueDate.getTime() - today.getTime() <= 7 * 86400000
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {delivery.overdue
                            ? "Atrasado"
                            : delivery.dueDate.getTime() - today.getTime() <= 7 * 86400000
                            ? "Vence em breve"
                            : "No prazo"}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* FUNIL COMERCIAL & CARGA DA EQUIPE */}
        <div className="grid gap-5 lg:grid-cols-2">
          {canViewFinancial && (
            <Card>
              <PanelHeader
                title="Funil comercial & briefings"
                description="Onde estão as oportunidades do estúdio."
                href="/admin/propostas"
                action="Ver propostas"
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricTile
                  label="Briefings concluídos"
                  value={metrics.finalizedBriefings}
                  detail={`${metrics.pendingBriefings} em aberto`}
                />
                <MetricTile
                  label="Propostas pendentes"
                  value={metrics.pendingProposals}
                  detail={`${metrics.approvedProposals} aprovadas`}
                />
              </div>
              <div className="mt-6 space-y-3">
                {proposalFunnel.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">{item.label}</span>
                      <span className="font-semibold text-neutral-800">{item.value}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full ${
                          item.tone === "emerald"
                            ? "bg-emerald-500"
                            : item.tone === "violet"
                            ? "bg-violet-500"
                            : item.tone === "blue"
                            ? "bg-blue-500"
                            : "bg-neutral-400"
                        }`}
                        style={{ width: `${Math.min(100, item.value * 20)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canViewTeam && (
            <Card>
              <PanelHeader
                title="Saúde operacional da equipe"
                description="Carga e avanço por responsável."
                href="/admin/equipe"
                action="Ver equipe"
              />
              <div className="mt-5 space-y-4">
                {team.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nenhum responsável cadastrado.</p>
                ) : (
                  team.map((member) => (
                    <div key={`${member.role}-${member.name}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-800">{member.name}</p>
                          <p className="text-xs font-light text-neutral-400">
                            {member.role === "ADMIN" ? "Direção / arquitetura" : "Operação"} ·{" "}
                            {member.stages} etapas
                          </p>
                        </div>
                        <span className="text-sm font-bold text-neutral-900">
                          {member.completion}%
                        </span>
                      </div>
                      <div className="mt-2">
                        <Progress value={member.completion} />
                      </div>
                      <p className="mt-1 text-right text-[11px] text-neutral-400">
                        {member.completed} concluída(s)
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/70 pt-5 text-xs font-light text-neutral-400">
          <span>
            Atualizado em{" "}
            {today.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span>ArqVértice Flow · visão executiva</span>
        </footer>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "sky" | "indigo" | "pink" | "amber" | "neutral";
}) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    indigo: "bg-indigo-50 text-indigo-600",
    pink: "bg-pink-50 text-pink-600",
    amber: "bg-amber-50 text-amber-600",
    neutral: "bg-neutral-100 text-neutral-700",
  }[tone];
  return (
    <Card className="relative overflow-hidden">
      <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-lg ${styles}`}>
        {icon}
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-1 min-h-8 text-xs font-light leading-4 text-neutral-500">{detail}</p>
    </Card>
  );
}

function PanelHeader({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-xs font-light text-neutral-500">{description}</p>
      </div>
      <Link href={href} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800">
        {action} <Arrow />
      </Link>
    </div>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/70 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-[11px] font-light text-neutral-400">{detail}</p>
    </div>
  );
}
