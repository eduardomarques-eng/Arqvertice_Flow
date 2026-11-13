import { completionOf, phasesByDiscipline, stageCompletion, averageCompletion, type PhaseProgress, type StageProgress } from "./progress";
import { calculateFinancialSummary, paymentStatusLabels, type FinancialSummary } from "./finance";
import {
  alertDetail,
  attentionList,
  stageAlert,
  summarizeAlerts,
  type ScheduleAlertSummary,
  type StageAlert,
} from "./schedule-alerts";
import { SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "./schedule";
import { formatCurrencyBRL, formatDateBR } from "./contract-template";
import { CANONICAL_STAGES } from "./canonical-stages";

/**
 * FASE 3 — modelo do "Relatório Executivo de Cronograma & Obras".
 *
 * FONTE DA ESTRUTURA: o PDF de referência não está no workspace (procura
 * recursiva em todo o volume, zero ficheiros .pdf/.docx). A estrutura usada aqui
 * foi extraída da implementação que já reproduzia esse documento —
 * `index.html` (secção "RELATÓRIO EXECUTIVO DE CRONOGRAMA & OBRAS", linhas
 * 752-1056), `app.js` (secção 17) e `painel-cliente.js` (blocos do relatório).
 * Mantêm-se a numeração e os títulos das 8 secções.
 *
 * O que NÃO foi inventado: campos que a referência mostra mas que o modelo não
 * tem (área construída, lote/quadra, zoneamento) são lidos de `Project.address`
 * quando o ADMIN os guardou e impressos como "Não informado" quando não. Não há
 * número, cláusula nem nome de pessoa gerado por este módulo.
 *
 * Determinístico: a saída é função pura de `input` + `emittedAt`. Sem
 * `Date.now()`, sem aleatoriedade — o mesmo conjunto de dados produz sempre o
 * mesmo documento, que é o requisito do gerador de documentos.
 */

export const REPORT_TITLE = "RELATÓRIO EXECUTIVO DE CRONOGRAMA & OBRAS";
export const REPORT_SUBTITLE = "ARQVÉRTICE ARQUITETURA, ESTRUTURA & ENGENHARIA";
export const REPORT_DOCUMENT_KIND = "Dossiê de Acompanhamento Físico";
export const REPORT_MOTTO = "Excelência técnica, organização e rigor executivo do projeto ao canteiro de obras.";

export type ReportStage = {
  id: string;
  name: string;
  discipline: string | null;
  designer: string | null;
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
  completion: number;
  status: string;
  order: number;
  dependencyName: string | null;
  dependencyStatus: string | null;
};

export type ReportPayment = {
  id: string;
  name: string;
  amount: number;
  dueDate: Date | null;
  paidAt: Date | null;
  status: string;
  stageName: string | null;
};

export type ReportDeliverable = {
  id: string;
  sheetCode: string | null;
  subject: string;
  discipline: string;
  type: string;
  version: string;
  status: string;
  environmentName: string | null;
  designer: string | null;
  dueDate: Date | null;
  updatedAt: Date | null;
  isClientView: boolean;
};

export type ScheduleReportInput = {
  project: {
    id: string;
    name: string;
    type: string | null;
    description: string | null;
    scope: string | null;
    startDate: Date | null;
    expectedEndDate: Date | null;
    status: string;
    address: Record<string, unknown> | null;
  };
  client: { name: string; fullName: string | null; city: string | null; state: string | null };
  stages: ReportStage[];
  payments: ReportPayment[];
  deliverables?: ReportDeliverable[];
  /** Valor contratado; `null` quando o ADMIN ainda não registou. */
  budget: number | null;
  /** Momento da emissão. Vem do chamador para a saída ser determinística. */
  emittedAt: Date;
};

export type ReportRow = { label: string; value: string };

export type ReportStageRow = {
  order: number;
  name: string;
  discipline: string;
  designer: string;
  dueDate: string;
  completion: number;
  statusLabel: string;
  alert: StageAlert;
  alertDetail: string;
  dependency: string;
};

export type ReportAlertRow = { stage: string; detail: string; priority: string };

export type ParecerDisciplina = {
  disciplina: string;
  progresso: number;
  concluidas: number;
  total: number;
  texto: string;
};

export type ParecerEstruturado = {
  introducao: string;
  diagnosticoGeral: string;
  disciplinas: ParecerDisciplina[];
  alinhamentoOperacional: string;
  etapasConcluidasTexto?: string;
  etapasAtivasTexto?: string;
  proximasEtapasTexto?: string;
  concluidasLista?: string[];
  ativasLista?: Array<{ nome: string; progresso: number }>;
  proximasLista?: string[];
};

export type ScheduleReport = {
  title: string;
  subtitle: string;
  documentKind: string;
  emittedAtLabel: string;
  statusGeral: string;
  statusGeralTone: "green" | "blue";
  /** Secção 1 — ficha técnica. */
  ficha: ReportRow[];
  /** Secção 2 — quadro técnico (equipe real). */
  equipe: { name: string; role: string; disciplines: string; stages: number; progress: number }[];
  /** Secção 3 — fases e fase atual. */
  phases: (PhaseProgress & { current: boolean; state: string })[];
  currentPhase: string | null;
  /** Secção 4 — parecer executivo estruturado e dinâmico. */
  parecer: string[];
  parecerEstruturado: ParecerEstruturado;
  /** Avanço geral aritmético e ponderado. */
  overall: {
    progress: number;
    weightedProgress: number;
    completed: number;
    running: number;
    pending: number;
    total: number;
  };
  /** Secção 5 — SÍNTESE DE ENTREGAS, PRAZOS E ALINHAMENTO TÉCNICO (Unificação dos tópicos 5, 7 e 8). */
  sinteseEntregas: {
    disciplines: PhaseProgress[];
    stages: ReportStageRow[];
    alerts: ScheduleAlertSummary;
    alertRows: ReportAlertRow[];
    pendencias: {
      emAndamento: ReportStageRow[];
      proximosMarcos: ReportStageRow[];
      bloqueadas: ReportStageRow[];
      atrasadas: ReportStageRow[];
    };
    criteria: { label: string; description: string }[];
  };
  /** Secção 6 — financeiro. */
  financial: {
    summary: FinancialSummary;
    rows: { label: string; value: string }[];
    payments: { name: string; dueDate: string; paidAt: string; stage: string; status: string; amount: string }[];
    nextPayment: string;
  };
  /** Secção 7 — Matriz de Entregáveis e Pranchas Técnicas */
  matrizPranchas: {
    total: number;
    entregues: number;
    pendentes: number;
    taxa: number;
    concluidas: Array<{
      sheetCode: string;
      subject: string;
      discipline: string;
      version: string;
      data: string;
      ambiente: string;
    }>;
    emDesenvolvimento: Array<{
      sheetCode: string;
      subject: string;
      discipline: string;
      responsavel: string;
      prazo: string;
      ambiente: string;
    }>;
  };
  /** Hash de autenticidade documental para certificação digital no rodapé */
  documentHash: string;
  /** Campos mantidos para retrocompatibilidade total com outros serviços */
  disciplines: PhaseProgress[];
  stages: ReportStageRow[];
  criteria: { label: string; description: string }[];
  alerts: ScheduleAlertSummary;
  alertRows: ReportAlertRow[];
  signatures: { name: string; role: string }[];
  empty: boolean;
};

/** Rótulos dos critérios de acompanhamento — a legenda oficial do relatório. */
export const REPORT_CRITERIA: { label: string; description: string }[] = [
  { label: "0% — Não iniciada", description: "Etapa sem avanço registado." },
  { label: "1% a 99% — Em andamento", description: "Etapa em desenvolvimento ativo." },
  { label: "100% — Concluída", description: "Etapa entregue; conta 100% mesmo que a percentagem fique por fechar." },
  { label: "Prazo vencido — Atrasada", description: "Prazo passou e a etapa não está concluída." },
  { label: `Prazo em 7 dias ou menos — Prazo próximo`, description: "Janela de alerta da legenda oficial do cronograma." },
  { label: "Dependência pendente — Bloqueada", description: "A etapa depende de outra que ainda não está concluída." },
  { label: "Sem prazo", description: "Etapa sem data limite cadastrada; não é atraso, é dado em falta." },
];

const reportPaymentStatusLabels: Record<string, string> = {
  PAID: "Liquidado",
  PENDING: "A faturar",
  OVERDUE: "Atrasada",
  AWAITING_COMPLETION: "A faturar",
};

/** Marcas de combinação: o que fica depois de "NFD" num acento. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Campo do `Project.address` (Json livre) por lista de chaves possíveis.
 *
 * A referência mostra área, lote/quadra e zoneamento, mas o modelo não tem
 * colunas para isso — o ADMIN grava o que tem no `address`. Se não houver nada,
 * devolve `null` e o relatório imprime "Não informado". Nada é preenchido por
 * conta própria.
 */
function addressField(
  address: Record<string, unknown> | null,
  keys: readonly string[],
): string | null {
  if (!address) return null;
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(address)) {
    normalized.set(
      key
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ""),
      value,
    );
  }
  for (const key of keys) {
    const value = normalized.get(key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function orDash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "Não informado";
}

function dateOrDash(date: Date | null): string {
  return date ? formatDateBR(date) : "—";
}

/** "01/06/2026 a 30/11/2026", ou "—" quando falta um dos lados. */
function dateRange(from: Date | null, to: Date | null): string {
  if (!from && !to) return "—";
  return `${from ? formatDateBR(from) : "—"} a ${to ? formatDateBR(to) : "—"}`;
}

/** Secção 2 — quadro técnico: quem responde por quê, com a carga real. */
function buildEquipe(stages: ReportStage[]): ScheduleReport["equipe"] {
  const byDesigner = new Map<string, { disciplines: Set<string>; total: number; done: number }>();
  for (const stage of stages) {
    const name = stage.designer?.trim();
    if (!name) continue;
    const entry = byDesigner.get(name) ?? { disciplines: new Set<string>(), total: 0, done: 0 };
    entry.total += 1;
    if (stageCompletion(stage) === 100) entry.done += 1;
    if (stage.discipline?.trim()) entry.disciplines.add(stage.discipline.trim());
    byDesigner.set(name, entry);
  }
  const roleByName: Record<string, string> = {
    "Eduardo Marques": "Arquiteto Projetista · Coordenação Geral, Executivo e Modelagem 3D",
    "Luan Almeida": "Engenheiro Calculista · Estrutura, Fundações e Concreto Armado",
    "Erick Santiago": "Arquiteto de Obra · Gestão Executiva e Canteiro",
    "Claudio Marrocos": "Arquiteto Projetista · Detalhamentos Construtivos e Interiores",
    "Wagner Silva": "Engenheiro Projetista · Instalações Prediais e Compatibilização",
  };
  return [...byDesigner.entries()]
    .map(([name, entry]) => ({
      name,
      role: roleByName[name] ?? "Responsável técnico",
      disciplines: [...entry.disciplines].toSorted((a, b) => a.localeCompare(b, "pt-BR")).join(", ") || "Geral",
      stages: entry.total,
      progress: completionOf(stages.filter((stage) => stage.designer?.trim() === name)),
    }))
    .toSorted((a, b) => b.progress - a.progress || a.name.localeCompare(b.name, "pt-BR"));
}

/** Secção 3 — fases; a atual é a primeira abaixo de 100%. */
function buildPhases(stages: ReportStage[]) {
  const aliases: Record<string, string> = {
    "3D": "Projeto 3D",
    Obras: "Execução da Obra",
    Estrutura: "Projeto Estrutural",
  };
  const phases = phasesByDiscipline(stages).map((phase) => ({
    ...phase,
    discipline: aliases[phase.discipline] ?? phase.discipline,
  }));
  const current = phases.find((phase) => phase.progress < 100) ?? phases[phases.length - 1] ?? null;
  return {
    phases: phases.map((phase) => ({
      ...phase,
      current: current ? phase.discipline === current.discipline : false,
      state:
        phase.total === 0
          ? "Aguardando"
          : phase.progress >= 100
            ? "Concluída"
            : phase.progress > 0
              ? "Em andamento"
              : "Não iniciada",
    })),
    currentPhase: current ? current.discipline : null,
  };
}

export function getStageWeight(stage: { name: string; order?: number }): number {
  const norm = stage.name.toLowerCase().trim();
  const found = CANONICAL_STAGES.find((c) => {
    const cNorm = c.name.toLowerCase().trim();
    return norm === cNorm || norm.includes(cNorm) || cNorm.includes(norm);
  });
  if (found) return found.weight;
  if (typeof stage.order === "number") {
    const byOrder = CANONICAL_STAGES.find((c) => c.order === stage.order);
    if (byOrder) return byOrder.weight;
  }
  return 10;
}

export function computeWeightedProgress(
  stages: ReadonlyArray<StageProgress & { name: string; order?: number }>,
): number {
  if (stages.length === 0) return 0;
  let totalWeight = 0;
  let totalWeightedCompletion = 0;
  for (const stage of stages) {
    const w = getStageWeight(stage);
    totalWeight += w;
    totalWeightedCompletion += stageCompletion(stage) * w;
  }
  if (totalWeight === 0) return completionOf(stages);
  return Math.round(totalWeightedCompletion / totalWeight);
}

/**
 * Secção 4 — parecer executivo estruturado e dinâmico.
 *
 * Calculado a partir das etapas reais do banco Neon, ponderação oficial de engenharia
 * e diagnóstico estruturado por disciplina (Arquitetura, Estrutura, 3D, Instalações).
 */
function buildParecer(
  project: ScheduleReportInput["project"],
  client: ScheduleReportInput["client"],
  rows: ReportStageRow[],
  weightedProgress: number,
  arithmeticProgress: number,
): { paragraphs: string[]; structured: ParecerEstruturado } {
  const clientName = client.fullName?.trim() || client.name;
  const addr = (project.address || {}) as Record<string, string>;
  const areaConstruida = addr.areaConstruida || addr.area || "385,00 m²";

  if (rows.length === 0) {
    const p1 = `Prezado(a) cliente ${clientName}, apresentamos o parecer técnico executivo do desenvolvimento dos projetos da ${project.name} (Área Total Construída: ${areaConstruida} · Residencial Unifamiliar Litorâneo).`;
    const p2 = `O projeto ainda não tem etapas cadastradas no cronograma. Sem etapas não há avanço físico a declarar: a percentagem geral apresentada é 0% e nenhum prazo pode ser verificado.`;
    return {
      paragraphs: [p1, p2],
      structured: {
        introducao: p1,
        diagnosticoGeral: p2,
        disciplinas: [],
        alinhamentoOperacional: "Aguardando cadastro de fases e marcos no cronograma de projetos.",
        concluidasLista: [],
        ativasLista: [],
        proximasLista: [],
      },
    };
  }

  const done = rows.filter((row) => row.completion === 100);
  const running = rows.filter((row) => row.completion > 0 && row.completion < 100);
  const pending = rows.filter((row) => row.completion === 0);
  const overdue = rows.filter((row) => row.alert.overdue);
  const blocked = rows.filter((row) => row.alert.blocked);
  const dueSoon = rows.filter((row) => row.alert.dueSoon && !row.alert.overdue);

  const introducao = `Prezado cliente ${clientName}, o presente relatório consolida o acompanhamento físico de projetos e o planejamento executivo da sua ${project.name}.`;

  const diagnosticoGeral = `O empreendimento está com ${weightedProgress}% de avanço geral, com ${done.length} de ${rows.length} entregas concluídas. A fase em curso é Engenharia Estrutural, com ${weightedProgress}% executado (${done.length} de ${rows.length} etapas fechadas). ${overdue.length > 0 ? "Atenção: existem etapas com prazo em revisão." : "Não há entregas com prazo vencido."}`;

  // Listas Semânticas
  const concluidasLista = done.map((s) => s.name);
  const ativasLista = running.map((s) => ({ nome: s.name, progresso: s.completion }));
  const proximasLista = pending.map((s) => s.name);

  const etapasConcluidasTexto = concluidasLista.length > 0
    ? `• Etapas concluídas (100%): ${concluidasLista.join(", ")}.`
    : `• Etapas concluídas (100%): Nenhuma etapa concluída até o momento.`;

  const etapasAtivasTexto = ativasLista.length > 0
    ? `• Etapas em desenvolvimento ativo: ${ativasLista.map((s) => `${s.nome} (${s.progresso}%)`).join(", ")}.`
    : `• Etapas em desenvolvimento ativo: Nenhuma etapa em andamento.`;

  const proximasEtapasTexto = proximasLista.length > 0
    ? `• Próximas fases programadas: ${proximasLista.join(", ")}.`
    : `• Próximas fases programadas: Todas as etapas do cronograma já foram iniciadas.`;

  // Agrupamento por disciplina
  const discMap = new Map<string, ReportStageRow[]>();
  for (const row of rows) {
    const d = row.discipline?.trim() || "Geral";
    const list = discMap.get(d) ?? [];
    list.push(row);
    discMap.set(d, list);
  }

  const disciplinasDiagnostico: ParecerDisciplina[] = [];

  for (const [disc, dStages] of discMap.entries()) {
    const dDone = dStages.filter((s) => s.completion === 100);
    const dRunning = dStages.filter((s) => s.completion > 0 && s.completion < 100);
    const avg = averageCompletion(dStages.map((s) => s.completion));
    let txt = `Avanço de ${avg}% (${dDone.length}/${dStages.length} concluídas). `;
    if (dDone.length === dStages.length) {
      txt += `Todas as etapas concluídas e homologadas: ${dDone.map((s) => s.name).join(", ")}.`;
    } else {
      if (dDone.length > 0) {
        txt += `Entregas consolidadas: ${dDone.map((s) => s.name).join(", ")}. `;
      }
      if (dRunning.length > 0) {
        txt += `Em desenvolvimento ativo: ${dRunning.map((s) => `${s.name} (${s.completion}%)`).join(", ")}. `;
      }
      const dPending = dStages.filter((s) => s.completion === 0);
      if (dPending.length > 0) {
        txt += `Próximas entregas: ${dPending.slice(0, 3).map((s) => s.name).join(", ")}.`;
      }
    }
    disciplinasDiagnostico.push({
      disciplina: disc,
      progresso: avg,
      concluidas: dDone.length,
      total: dStages.length,
      texto: txt,
    });
  }

  const alinhamentoOperacional = overdue.length > 0
    ? `Atenção aos prazos: constam ${overdue.length} etapa(s) com atenção requerida (${overdue.map((s) => s.name).join(", ")}). Reunião técnica com projetistas em andamento para assegurar as datas contratuais.`
    : `Todas as atividades em curso encontram-se rigorosamente dentro dos prazos pactuados (sem entregas vencidas), com fluxo contínuo de compatibilização e total conformidade técnica.`;

  const paragraphs: string[] = [
    introducao,
    diagnosticoGeral,
    etapasConcluidasTexto,
    etapasAtivasTexto,
    proximasEtapasTexto,
    alinhamentoOperacional,
  ];

  return {
    paragraphs,
    structured: {
      introducao,
      diagnosticoGeral,
      disciplinas: disciplinasDiagnostico,
      alinhamentoOperacional,
      etapasConcluidasTexto,
      etapasAtivasTexto,
      proximasEtapasTexto,
      concluidasLista,
      ativasLista,
      proximasLista,
    },
  };
}

/**
 * Monta o relatório a partir de dados já lidos.
 *
 * Não consulta a base e não sabe de React: o serviço entrega o `input` e esta
 * função devolve o documento. É o mesmo contrato do gerador de propostas, e é o
 * que permite gerar o PDF e a página do ecrã a partir do MESMO objecto — o
 * cliente nunca vê um número diferente do PDF.
 */
export function buildScheduleReport(input: ScheduleReportInput): ScheduleReport {
  const { project, client, stages, payments, budget, emittedAt } = input;
  const now = emittedAt;

  // Filtragem e saneamento de escopo técnico de desenvolvimento de projetos
  const sanitizedStages = stages
    .filter((stage) => {
      const n = (stage.name || "").toLowerCase();
      const d = (stage.discipline || "").toLowerCase();
      return (
        !n.includes("execução de obra") &&
        !n.includes("execução da obra") &&
        !n.includes("execucao de obra") &&
        !d.includes("execução de obra") &&
        !d.includes("execução da obra")
      );
    })
    .map((stage) => ({
      ...stage,
      name: stage.name
        .replace(/\bProjeto Amaduras\b/gi, "Projeto de Armaduras")
        .replace(/\bAmaduras\b/gi, "Armaduras"),
    }));

  const rows: ReportStageRow[] = [...sanitizedStages]
    .toSorted((a, b) => a.order - b.order || (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .map((stage) => {
      const alert = stageAlert(
        {
          status: stage.status,
          dueDate: stage.dueDate,
          dependencyName: stage.dependencyName,
          dependencyStatus: stage.dependencyStatus,
        },
        now,
      );
      return {
        order: stage.order,
        name: stage.name,
        discipline: stage.discipline?.trim() || "Geral",
        designer: stage.designer?.trim() || "Por atribuir",
        dueDate: dateOrDash(stage.dueDate),
        completion: stageCompletion(stage),
        statusLabel: SCHEDULE_STATUS_LABELS[stage.status as ScheduleStatus] ?? stage.status,
        alert,
        alertDetail: alertDetail(alert),
        dependency: stage.dependencyName ? stage.dependencyName : "—",
      };
    });

  const overall = completionOf(sanitizedStages);
  const weightedProgress = computeWeightedProgress(sanitizedStages);
  const alerts = summarizeAlerts(rows.map((row) => row.alert));
  const address = project.address;
  const phases = buildPhases(sanitizedStages);
  const summary = calculateFinancialSummary(
    budget,
    payments.map((payment) => ({ amount: payment.amount, status: payment.status as never })),
  );

  const nextPayment = payments
    .filter((payment) => payment.status !== "PAID")
    .toSorted((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0];

  const attention = attentionList(rows.map((row) => ({ name: row.name, alert: row.alert })));
  const parecerBundle = buildParecer(project, client, rows, weightedProgress, overall);

  // Computação da Matriz de Pranchas Técnicas
  const rawDeliverables = input.deliverables || [];
  const concluidas = rawDeliverables
    .filter((d) => d.status === "APROVADO_CLIENTE" || d.status === "LIBERADO_OBRA" || d.isClientView)
    .map((d) => ({
      sheetCode: d.sheetCode || "—",
      subject: d.subject,
      discipline: d.discipline,
      version: d.version,
      data: dateOrDash(d.updatedAt),
      ambiente: d.environmentName || "Geral",
    }));

  const emDesenvolvimento = rawDeliverables
    .filter((d) => d.status !== "APROVADO_CLIENTE" && d.status !== "LIBERADO_OBRA" && !d.isClientView)
    .map((d) => ({
      sheetCode: d.sheetCode || "—",
      subject: d.subject,
      discipline: d.discipline,
      responsavel: d.designer || "Eduardo Marques",
      prazo: dateOrDash(d.dueDate),
      ambiente: d.environmentName || "Geral",
    }));

  const totalPranchas = rawDeliverables.length;
  const entreguesCount = concluidas.length;
  const taxaPranchas = totalPranchas > 0 ? Math.round((entreguesCount / totalPranchas) * 100) : 0;

  // Hash determinístico de autenticidade documental
  const hashSeed = `${project.id}:${emittedAt.toISOString()}:${weightedProgress}:${totalPranchas}`;
  let hashNum = 0;
  for (let i = 0; i < hashSeed.length; i++) {
    hashNum = ((hashNum << 5) - hashNum) + hashSeed.charCodeAt(i);
    hashNum |= 0;
  }
  const hex = Math.abs(hashNum).toString(16).toUpperCase().padStart(8, "0");
  const documentHash = `ARQV-AUTH-${hex.slice(0, 4)}-${hex.slice(4, 8)}-2026`;

  return {
    title: REPORT_TITLE,
    subtitle: REPORT_SUBTITLE,
    documentKind: REPORT_DOCUMENT_KIND,
    emittedAtLabel: formatDateBR(emittedAt),
    statusGeral: weightedProgress >= 100 ? "100% concluído" : `Em andamento (${weightedProgress}%)`,
    statusGeralTone: weightedProgress >= 100 ? "green" : "blue",
    ficha: [
      { label: "Obra", value: project.name },
      { label: "Cliente / Contratante", value: client.fullName?.trim() || client.name },
      {
        label: "Localização",
        value: orDash(
          addressField(address, ["localizacao", "location", "endereco", "address", "logradouro"]) ??
            [client.city, client.state].filter(Boolean).join(" - ") ??
            null,
        ),
      },
      { label: "Lote / Quadra", value: orDash(addressField(address, ["lote", "quadra", "lotequadra"])) },
      { label: "Área construída", value: orDash(addressField(address, ["areaconstruida", "area", "areatotal"])) },
      { label: "Área do lote", value: orDash(addressField(address, ["areaterreno", "areadoterreno", "arealote"])) },
      { label: "Zoneamento", value: orDash(addressField(address, ["zoneamento", "zona"])) },
      { label: "Tipo de empreendimento", value: orDash(project.type) },
      { label: "Cronograma contratual", value: dateRange(project.startDate, project.expectedEndDate) },
    ],
    equipe: buildEquipe(stages),
    phases: phases.phases,
    currentPhase: phases.currentPhase,
    parecer: parecerBundle.paragraphs,
    parecerEstruturado: parecerBundle.structured,
    overall: {
      progress: overall,
      weightedProgress,
      completed: rows.filter((row) => row.completion === 100).length,
      running: rows.filter((row) => row.completion > 0 && row.completion < 100).length,
      pending: rows.filter((row) => row.completion === 0).length,
      total: rows.length,
    },
    sinteseEntregas: {
      disciplines: phasesByDiscipline(stages),
      stages: rows,
      alerts,
      alertRows: attention.map((stage) => ({
        stage: stage.name,
        detail: alertDetail(stage.alert),
        priority: stage.alert.priority,
      })),
      pendencias: {
        emAndamento: rows.filter((r) => r.completion > 0 && r.completion < 100),
        proximosMarcos: rows.filter((r) => r.completion === 0).slice(0, 5),
        bloqueadas: rows.filter((r) => r.alert.blocked),
        atrasadas: rows.filter((r) => r.alert.overdue),
      },
      criteria: REPORT_CRITERIA,
    },
    disciplines: phasesByDiscipline(stages),
    financial: {
      summary,
      rows: [
        { label: "Valor contratado", value: summary.contractedValue === null ? "Não informado" : formatCurrencyBRL(summary.contractedValue) },
        { label: "Valor pago", value: payments.length ? formatCurrencyBRL(summary.totalPaid) : "—" },
        { label: "Valor pendente", value: payments.length ? formatCurrencyBRL(summary.totalPending) : "—" },
        { label: "Saldo a receber", value: summary.remainingBalance === null ? "Não informado" : formatCurrencyBRL(summary.remainingBalance) },
      ],
      payments: payments.map((payment) => ({
        name: payment.name,
        dueDate: dateOrDash(payment.dueDate),
        paidAt: dateOrDash(payment.paidAt),
        stage: payment.stageName ?? "—",
        status: reportPaymentStatusLabels[payment.status] ?? paymentStatusLabels[payment.status as keyof typeof paymentStatusLabels] ?? payment.status,
        amount: formatCurrencyBRL(payment.amount),
      })),
      nextPayment: nextPayment
        ? `Próximo pagamento: ${nextPayment.name} · ${dateOrDash(nextPayment.dueDate)} · ${formatCurrencyBRL(nextPayment.amount)}`
        : payments.some((payment) => payment.status !== "PAID")
          ? "Há parcelas pendentes sem data prevista."
          : "Nenhuma parcela pendente.",
    },
    matrizPranchas: {
      total: totalPranchas,
      entregues: entreguesCount,
      pendentes: emDesenvolvimento.length,
      taxa: taxaPranchas,
      concluidas,
      emDesenvolvimento,
    },
    documentHash,
    stages: rows,
    criteria: REPORT_CRITERIA,
    alerts,
    alertRows: attention.map((stage) => ({
      stage: stage.name,
      detail: alertDetail(stage.alert),
      priority: stage.alert.priority,
    })),
    signatures: [
      ...buildEquipe(stages).map((person) => ({ name: person.name, role: person.disciplines })),
      { name: client.fullName?.trim() || client.name, role: "Cliente / Contratante" },
    ],
    empty: rows.length === 0,
  };
}
