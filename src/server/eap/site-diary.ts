import { prisma } from "@/server/db";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { decodeImageBufferToPdfImage } from "@/lib/pdf/pdf-image";
import {
  drawPdfBrandedHeader,
  drawPdfKpiCardsRow,
  PDF_PALETTE,
} from "@/lib/pdf/pdf-charts";

export type DiaryWeather = "SOL" | "NUBLADO" | "CHUVA" | "IMPRATICAVEL";
export type DiarySiteCondition = "OPERAVEL" | "PARCIAL" | "PARALISADO";

export interface SiteDiaryWorkforceSummary {
  teamA: number;
  teamB: number;
  teamC: number;
  thirdParty: number;
  total: number;
  notes?: string;
}

export interface SiteDiaryMediaItem {
  id: string;
  mediaType: "IMAGE" | "VIDEO";
  fileName: string;
  dataBase64?: string;
  caption?: string;
  timeLabel?: string;
}

export interface SiteDiaryEntryDTO {
  id: string;
  eapProjectId: string;
  bulletinId: string | null;
  entryDate: string;
  weatherMorning: DiaryWeather;
  weatherAfternoon: DiaryWeather;
  siteCondition: DiarySiteCondition;
  workforceSummary: SiteDiaryWorkforceSummary;
  activitiesExecuted: string;
  occurrencesAndNotes: string;
  mediaItems: SiteDiaryMediaItem[];
  createdAt: string;
}

export interface SiteDiaryPeriodSummary {
  totalDays: number;
  operableDays: number;
  rainDays: number;
  avgWorkforce: number;
  latestOccurrences: Array<{ entryDate: string; text: string }>;
}

function normalizeWorkforce(raw: unknown): SiteDiaryWorkforceSummary {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const teamA = Math.max(0, Number(obj.teamA) || 0);
  const teamB = Math.max(0, Number(obj.teamB) || 0);
  const teamC = Math.max(0, Number(obj.teamC) || 0);
  const thirdParty = Math.max(0, Number(obj.thirdParty) || 0);
  const total = teamA + teamB + teamC + thirdParty;
  return {
    teamA,
    teamB,
    teamC,
    thirdParty,
    total,
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
  };
}

function normalizeMedia(raw: unknown): SiteDiaryMediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === "object"))
    .map((m, idx) => ({
      id: typeof m.id === "string" ? m.id : `media-${idx + 1}`,
      mediaType: m.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      fileName: typeof m.fileName === "string" ? m.fileName : "registro.jpg",
      dataBase64: typeof m.dataBase64 === "string" ? m.dataBase64 : undefined,
      caption: typeof m.caption === "string" ? m.caption : undefined,
      timeLabel: typeof m.timeLabel === "string" ? m.timeLabel : undefined,
    }));
}

export function summarizeSiteDiaryPeriod(
  entries: SiteDiaryEntryDTO[]
): SiteDiaryPeriodSummary {
  const totalDays = entries.length;
  const operableDays = entries.filter((e) => e.siteCondition === "OPERAVEL").length;
  const rainDays = entries.filter(
    (e) =>
      e.weatherMorning === "CHUVA" ||
      e.weatherAfternoon === "CHUVA" ||
      e.weatherMorning === "IMPRATICAVEL" ||
      e.weatherAfternoon === "IMPRATICAVEL"
  ).length;
  const totalWorkers = entries.reduce((s, e) => s + (e.workforceSummary.total || 0), 0);
  const avgWorkforce = totalDays > 0 ? Math.round((totalWorkers / totalDays) * 10) / 10 : 0;
  const latestOccurrences = entries
    .filter((e) => e.occurrencesAndNotes.trim().length > 0)
    .slice(0, 4)
    .map((e) => ({
      entryDate: e.entryDate,
      text: e.occurrencesAndNotes.trim(),
    }));

  return {
    totalDays,
    operableDays,
    rainDays,
    avgWorkforce,
    latestOccurrences,
  };
}

export async function listSiteDiaryEntries(
  projectId: string
): Promise<SiteDiaryEntryDTO[]> {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!eap) return [];

  const rows = await prisma.eapSiteDiaryEntry.findMany({
    where: { eapProjectId: eap.id },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    eapProjectId: r.eapProjectId,
    bulletinId: r.bulletinId,
    entryDate: r.entryDate.toISOString().slice(0, 10),
    weatherMorning: (r.weatherMorning as DiaryWeather) || "SOL",
    weatherAfternoon: (r.weatherAfternoon as DiaryWeather) || "SOL",
    siteCondition: (r.siteCondition as DiarySiteCondition) || "OPERAVEL",
    workforceSummary: normalizeWorkforce(r.workforceSummary),
    activitiesExecuted: r.activitiesExecuted,
    occurrencesAndNotes: r.occurrencesAndNotes,
    mediaItems: normalizeMedia(r.mediaItems),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createSiteDiaryEntry(
  projectId: string,
  input: {
    bulletinId?: string | null;
    entryDate: string;
    weatherMorning: DiaryWeather;
    weatherAfternoon: DiaryWeather;
    siteCondition: DiarySiteCondition;
    workforceSummary: Partial<SiteDiaryWorkforceSummary>;
    activitiesExecuted: string;
    occurrencesAndNotes?: string;
    mediaItems?: SiteDiaryMediaItem[];
  }
): Promise<SiteDiaryEntryDTO> {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!eap) {
    throw new Error("EAP não encontrada para este projeto.");
  }

  const wf = normalizeWorkforce(input.workforceSummary);
  const created = await prisma.eapSiteDiaryEntry.create({
    data: {
      eapProjectId: eap.id,
      bulletinId: input.bulletinId ?? null,
      entryDate: new Date(`${input.entryDate.slice(0, 10)}T12:00:00.000Z`),
      weatherMorning: input.weatherMorning,
      weatherAfternoon: input.weatherAfternoon,
      siteCondition: input.siteCondition,
      workforceSummary: wf as unknown as object,
      activitiesExecuted: input.activitiesExecuted.trim(),
      occurrencesAndNotes: (input.occurrencesAndNotes || "").trim(),
      mediaItems: (input.mediaItems ?? []) as unknown as object,
    },
  });

  return {
    id: created.id,
    eapProjectId: created.eapProjectId,
    bulletinId: created.bulletinId,
    entryDate: created.entryDate.toISOString().slice(0, 10),
    weatherMorning: created.weatherMorning as DiaryWeather,
    weatherAfternoon: created.weatherAfternoon as DiaryWeather,
    siteCondition: created.siteCondition as DiarySiteCondition,
    workforceSummary: wf,
    activitiesExecuted: created.activitiesExecuted,
    occurrencesAndNotes: created.occurrencesAndNotes,
    mediaItems: normalizeMedia(created.mediaItems),
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteSiteDiaryEntry(
  projectId: string,
  entryId: string
): Promise<boolean> {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!eap) return false;

  const res = await prisma.eapSiteDiaryEntry.deleteMany({
    where: { id: entryId, eapProjectId: eap.id },
  });
  return res.count > 0;
}

function fmtDateBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export async function renderSiteDiaryPdfBuffer(projectId: string): Promise<Buffer> {
  const [project, entries] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        client: { select: { name: true } },
        eapProject: {
          select: {
            builtAreaM2: true,
            currentRevision: true,
            city: { select: { name: true, state: true } },
          },
        },
      },
    }),
    listSiteDiaryEntries(projectId),
  ]);

  const summary = summarizeSiteDiaryPeriod(entries);
  const cityLabel = project?.eapProject?.city
    ? `${project.eapProject.city.name}/${project.eapProject.city.state}`
    : "Fortaleza/CE";
  const areaM2 = project?.eapProject?.builtAreaM2 ?? 0;
  const rev = project?.eapProject?.currentRevision ?? 1;

  const pdf = new PdfWriter(
    {
      title: `Diario de Obra — ${project?.name || "Obra"}`,
      author: "ArqVertice OS",
      subject: "Diario de Obra e Registro de Canteiro",
    },
    { margin: 28 }
  );

  drawPdfBrandedHeader(pdf, {
    eyebrow: "ArqVertice OS · Acompanhamento de Canteiro",
    title: "Diário de Obra",
    subtitle: `${project?.name || "Obra"} · Cliente: ${project?.client?.name || "—"} · ${cityLabel}`,
    metaLine: `Area Construida: ${areaM2} m2 · Revisao: R${String(rev).padStart(2, "0")} · ${summary.totalDays} registro(s) diario(s)`,
    accentHex: "#059669",
  });

  drawPdfKpiCardsRow(pdf, [
    {
      label: "Dias Registrados",
      value: `${summary.totalDays}`,
      sub: "Diario de Obra",
      accentHex: PDF_PALETTE[0],
    },
    {
      label: "Dias Operaveis",
      value: `${summary.operableDays}`,
      sub: "Canteiro ativo",
      accentHex: PDF_PALETTE[1],
    },
    {
      label: "Dias de Chuva",
      value: `${summary.rainDays}`,
      sub: "Impacto climatico",
      accentHex: summary.rainDays > 0 ? PDF_PALETTE[2] : PDF_PALETTE[1],
    },
    {
      label: "Efetivo Medio",
      value: `${summary.avgWorkforce} trab/dia`,
      sub: "Equipes em campo",
      accentHex: PDF_PALETTE[4],
    },
  ]);

  pdf.ensure(40);
  pdf.heading("1. Registros Diarios de Canteiro");
  pdf.table({
    columns: [
      { title: "Data", weight: 0.9 },
      { title: "Clima (M / T)", weight: 1.1 },
      { title: "Condicao", weight: 0.9 },
      { title: "Efetivo", weight: 0.8, align: "right" },
      { title: "Atividades Executadas & Ocorrencias", weight: 3.3 },
    ],
    rows:
      entries.length > 0
        ? entries.map((e) => [
            fmtDateBr(e.entryDate),
            `${e.weatherMorning} / ${e.weatherAfternoon}`,
            e.siteCondition,
            `${e.workforceSummary.total}`,
            `${e.activitiesExecuted}${e.occurrencesAndNotes ? ` | Obs: ${e.occurrencesAndNotes}` : ""}`,
          ])
        : [["—", "—", "—", "0", "Nenhum registro diario lancado ate o momento."]],
  });

  // Evidências fotográficas do Diário
  const images = entries.flatMap((e) =>
    e.mediaItems
      .filter((m) => m.mediaType === "IMAGE" && m.dataBase64)
      .map((m) => ({ ...m, entryDate: e.entryDate }))
  );

  if (images.length > 0) {
    pdf.ensure(40);
    pdf.heading("2. Registro Fotografico do Diario de Obra");
    for (const imgItem of images.slice(0, 8)) {
      try {
        const rawBuf = Buffer.from(imgItem.dataBase64!, "base64");
        const decoded = decodeImageBufferToPdfImage(rawBuf, "image/jpeg");
        if (!decoded) continue;
        pdf.ensure(130);
        const y0 = pdf.y;
        pdf.drawEmbeddedImage(decoded, pdf.margin, y0, 150, 100);
        pdf.drawText(
          `${fmtDateBr(imgItem.entryDate)}${imgItem.timeLabel ? ` · ${imgItem.timeLabel}` : ""}`,
          pdf.margin + 162,
          y0 + 18,
          { size: 8.5, bold: true }
        );
        pdf.drawText(
          imgItem.caption || imgItem.fileName,
          pdf.margin + 162,
          y0 + 34,
          { size: 8 }
        );
        pdf.y += 110;
      } catch {
        // Ignora imagem corrompida sem quebrar o PDF
      }
    }
  }

  return Buffer.from(pdf.build());
}
