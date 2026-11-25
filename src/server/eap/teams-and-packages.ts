import { prisma } from "@/server/db";
import { round2 } from "@/server/eap/calculator";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";

export interface TeamWorkerInput {
  id?: string;
  roleName: string;
  headcount: number;
  dailyRate: number;
  hourlyRate?: number;
  socialChargesPct: number;
  maxDailyOutput?: number | null;
}

export interface TeamCostSummary {
  totalHeadcount: number;
  totalDailyCost: number;
  totalHourlyCost: number;
  maxDailyHours: number;
  maxSimultaneousFronts: number;
  effectiveFrontDailyCost: number;
}

const PACKAGE_PALETTE: Array<{ corHex: string; textHex: string }> = [
  { corHex: "#1D4ED8", textHex: "#FFFFFF" }, // Blue 700
  { corHex: "#0F766E", textHex: "#FFFFFF" }, // Teal 700
  { corHex: "#B45309", textHex: "#FFFFFF" }, // Amber 700
  { corHex: "#6D28D9", textHex: "#FFFFFF" }, // Violet 700
  { corHex: "#047857", textHex: "#FFFFFF" }, // Emerald 700
  { corHex: "#BE123C", textHex: "#FFFFFF" }, // Rose 700
  { corHex: "#0369A1", textHex: "#FFFFFF" }, // Sky 700
  { corHex: "#4338CA", textHex: "#FFFFFF" }, // Indigo 700
  { corHex: "#A16207", textHex: "#FFFFFF" }, // Yellow 700
  { corHex: "#334155", textHex: "#FFFFFF" }, // Slate 700
];

function inferDisciplineFromStages(stageCodes: string[], waveName: string): string {
  if (stageCodes.some((c) => ["01", "02"].includes(c))) return "Preliminares & Terraplenagem";
  if (stageCodes.some((c) => ["03", "04"].includes(c))) return "Estrutura & Fundações";
  if (stageCodes.some((c) => ["05", "06", "07"].includes(c))) return "Alvenaria, Cobertura & Impermeabilização";
  if (stageCodes.some((c) => ["08"].includes(c))) return "Instalações Elétricas";
  if (stageCodes.some((c) => ["09", "10"].includes(c))) return "Instalações Hidrossanitárias & Especiais";
  if (stageCodes.some((c) => ["11", "12", "13", "14", "15"].includes(c))) return "Revestimentos, Pisos & Forros";
  if (stageCodes.some((c) => ["16", "17", "18", "19"].includes(c))) return "Esquadrias, Pintura & Acabamentos";
  return waveName.replace(/^Fase\s*\d+\s*—\s*/i, "") || "Geral";
}

/**
 * Calcula contraste WCAG AA automático (#FFFFFF ou #0F172A) para uma cor hexadecimal.
 */
export function getContrastTextHex(corHex: string): string {
  const clean = corHex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.35 ? "#0F172A" : "#FFFFFF";
}

/**
 * Sugere a próxima letra disponível (A, B, C... Z, A1...) para uma nova equipe.
 */
export function getNextTeamCode(existingCodes: string[]): string {
  const used = new Set(existingCodes.map((c) => c.trim().toUpperCase()));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const ch of alphabet) {
    if (!used.has(ch)) return ch;
  }
  let idx = 1;
  while (used.has(`A${idx}`)) idx++;
  return `A${idx}`;
}

export function computeWorkerDailyCost(worker: Pick<TeamWorkerInput, "headcount" | "dailyRate" | "socialChargesPct">): number {
  const headcount = Math.max(0, Number(worker.headcount) || 0);
  const dailyRate = Math.max(0, Number(worker.dailyRate) || 0);
  const charges = Math.max(0, Number(worker.socialChargesPct) || 0);
  return round2(headcount * dailyRate * (1 + charges / 100));
}

export function computeWorkerHourlyRate(
  dailyRate: number,
  maxDailyHours = 8,
  explicitHourlyRate?: number
): number {
  if (explicitHourlyRate !== undefined && explicitHourlyRate > 0) {
    return round2(explicitHourlyRate);
  }
  const hours = Math.max(1, Number(maxDailyHours) || 8);
  return round2(Math.max(0, Number(dailyRate) || 0) / hours);
}

export function computeTeamCostSummary(team: {
  maxDailyHours: number;
  maxSimultaneousFronts: number;
  workers: TeamWorkerInput[];
}): TeamCostSummary {
  const maxDailyHours = Math.max(1, Number(team.maxDailyHours) || 8);
  const maxSimultaneousFronts = Math.max(1, Math.round(Number(team.maxSimultaneousFronts) || 1));

  let totalHeadcount = 0;
  let totalDailyCost = 0;

  for (const worker of team.workers) {
    totalHeadcount += Math.max(0, Math.round(Number(worker.headcount) || 0));
    totalDailyCost += computeWorkerDailyCost(worker);
  }

  totalDailyCost = round2(totalDailyCost);
  const totalHourlyCost = round2(totalDailyCost / maxDailyHours);
  const effectiveFrontDailyCost = round2(totalDailyCost * maxSimultaneousFronts);

  return {
    totalHeadcount,
    totalDailyCost,
    totalHourlyCost,
    maxDailyHours,
    maxSimultaneousFronts,
    effectiveFrontDailyCost,
  };
}

export function computeLaborUnitCostFromTeam(input: {
  teamDailyCost: number;
  productivityPerDay: number;
  maxDailyOutput?: number | null;
}): number {
  const baseProd = Math.max(0.01, Number(input.productivityPerDay) || 1);
  const cappedProd =
    input.maxDailyOutput && input.maxDailyOutput > 0
      ? Math.max(0.01, Math.min(baseProd, input.maxDailyOutput))
      : baseProd;
  return round2(Math.max(0, input.teamDailyCost) / cappedProd);
}

const DEFAULT_WORK_TEAMS: Array<{
  teamCode: string;
  name: string;
  specialty: string;
  maxDailyHours: number;
  maxSimultaneousFronts: number;
  workers: TeamWorkerInput[];
}> = [
  {
    teamCode: "A",
    name: "Equipe A — Estrutura & Alvenaria",
    specialty: "Fundações, Supraestrutura & Alvenaria de Vedação",
    maxDailyHours: 8,
    maxSimultaneousFronts: 2,
    workers: [
      { roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 20, maxDailyOutput: 18 },
      { roleName: "Servente", headcount: 3, dailyRate: 110, socialChargesPct: 20, maxDailyOutput: null },
      { roleName: "Carpinteiro", headcount: 1, dailyRate: 190, socialChargesPct: 20, maxDailyOutput: 14 },
    ],
  },
  {
    teamCode: "B",
    name: "Equipe B — Instalações Prediais",
    specialty: "Elétrica, Automação, Hidrossanitária & Climatização",
    maxDailyHours: 8,
    maxSimultaneousFronts: 2,
    workers: [
      { roleName: "Eletricista", headcount: 1, dailyRate: 210, socialChargesPct: 20, maxDailyOutput: 25 },
      { roleName: "Encanador", headcount: 1, dailyRate: 200, socialChargesPct: 20, maxDailyOutput: 20 },
      { roleName: "Ajudante Técnico", headcount: 1, dailyRate: 125, socialChargesPct: 20, maxDailyOutput: null },
    ],
  },
  {
    teamCode: "C",
    name: "Equipe C — Revestimentos & Acabamentos",
    specialty: "Revestimentos, Pisos, Forros, Esquadrias & Pintura",
    maxDailyHours: 8,
    maxSimultaneousFronts: 2,
    workers: [
      { roleName: "Azulejista / Revestidor", headcount: 2, dailyRate: 195, socialChargesPct: 20, maxDailyOutput: 22 },
      { roleName: "Pintor", headcount: 2, dailyRate: 175, socialChargesPct: 20, maxDailyOutput: 35 },
      { roleName: "Servente", headcount: 1, dailyRate: 110, socialChargesPct: 20, maxDailyOutput: null },
    ],
  },
];

/**
 * Inicializa de forma idempotente e segura contra concorrência os pacotes de serviço (1..N)
 * e as 3 equipes iniciais (A, B, C) caso o projeto EAP ainda não possua registros.
 */
export async function ensureDefaultTeamsAndPackages(eapProjectId: string): Promise<{
  seededPackages: number;
  seededTeams: number;
}> {
  return prisma.$transaction(async (tx) => {
    // Serializa o seed inicial por EapProject para evitar P2002 em GETs paralelos
    await tx.$executeRaw`SELECT 1 FROM "EapProject" WHERE "id" = ${eapProjectId}::uuid FOR UPDATE`;

    const [pkgCount, teamCount] = await Promise.all([
      tx.eapServicePackage.count({ where: { eapProjectId } }),
      tx.eapWorkTeam.count({ where: { eapProjectId } }),
    ]);

    let seededPackages = 0;
    let seededTeams = 0;

    if (pkgCount === 0) {
      const packageRows = MASTER_LOB_PACKAGES.map((pkg, idx) => {
        const palette = PACKAGE_PALETTE[idx % PACKAGE_PALETTE.length];
        return {
          eapProjectId,
          packageNumber: pkg.packageNumber,
          name: pkg.name,
          discipline: inferDisciplineFromStages(pkg.linkedStageCodes, pkg.waveName),
          corHex: palette.corHex,
          textHex: palette.textHex,
          predecessorNumbers: pkg.predecessorNumbers,
          productivityPerDay: Math.max(1, round2(100 / Math.max(1, pkg.defaultDurationWorkingDays))),
          productivityUnit: "un/dia",
          linkedEapStageCodes: pkg.linkedStageCodes,
          isActive: true,
        };
      });

      const res = await tx.eapServicePackage.createMany({
        data: packageRows,
        skipDuplicates: true,
      });
      seededPackages = res.count;
    }

    if (teamCount === 0) {
      for (const teamDef of DEFAULT_WORK_TEAMS) {
        await tx.eapWorkTeam.create({
          data: {
            eapProjectId,
            teamCode: teamDef.teamCode,
            name: teamDef.name,
            specialty: teamDef.specialty,
            maxDailyHours: teamDef.maxDailyHours,
            maxSimultaneousFronts: teamDef.maxSimultaneousFronts,
            isActive: true,
            workers: {
              create: teamDef.workers.map((w) => ({
                roleName: w.roleName,
                headcount: w.headcount,
                dailyRate: w.dailyRate,
                hourlyRate: computeWorkerHourlyRate(w.dailyRate, teamDef.maxDailyHours),
                socialChargesPct: w.socialChargesPct,
                maxDailyOutput: w.maxDailyOutput ?? null,
              })),
            },
          },
          select: { id: true },
        });
        seededTeams += 1;
      }
    }

    return { seededPackages, seededTeams };
  });
}

/**
 * Sincroniza o custo unitário de Mão de Obra (MO R$) dos itens da EAP vinculados às macro-etapas informadas,
 * usando atualização em lote (updateMany) dentro de uma única transação para evitar N+1 e TOCTOU.
 */
export async function syncTeamLaborRatesToEap(input: {
  projectId: string;
  teamId: string;
  stageCodes: string[];
}): Promise<{
  updatedCount: number;
  teamCode: string;
  teamDailyCost: number;
  stageCodes: string[];
  appliedRatesByStage: Record<string, number>;
} | null> {
  return prisma.$transaction(async (tx) => {
    const eap = await tx.eapProject.findUnique({
      where: { projectId: input.projectId },
      select: { id: true },
    });
    if (!eap) return null;

    const team = await tx.eapWorkTeam.findFirst({
      where: { id: input.teamId, eapProjectId: eap.id },
      include: { workers: true },
    });
    if (!team) return null;

    const summary = computeTeamCostSummary(team);
    const uniqueStageCodes = Array.from(
      new Set(input.stageCodes.map((s) => s.trim()).filter(Boolean))
    );
    if (uniqueStageCodes.length === 0) {
      return {
        updatedCount: 0,
        teamCode: team.teamCode,
        teamDailyCost: summary.totalDailyCost,
        stageCodes: [],
        appliedRatesByStage: {},
      };
    }

    const workerOutputs = team.workers
      .map((w) => w.maxDailyOutput)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const teamOutputCap = workerOutputs.length > 0 ? Math.min(...workerOutputs) : null;

    const packages = await tx.eapServicePackage.findMany({
      where: { eapProjectId: eap.id, isActive: true },
      select: {
        linkedEapStageCodes: true,
        productivityPerDay: true,
      },
    });

    const appliedRatesByStage: Record<string, number> = {};
    let updatedCount = 0;

    for (const stageCode of uniqueStageCodes) {
      const matchingPkgs = packages.filter((p) => p.linkedEapStageCodes.includes(stageCode));
      const avgProductivity =
        matchingPkgs.length > 0
          ? matchingPkgs.reduce((acc, p) => acc + Math.max(0.1, p.productivityPerDay), 0) /
            matchingPkgs.length
          : 10;

      const rate = computeLaborUnitCostFromTeam({
        teamDailyCost: summary.totalDailyCost,
        productivityPerDay: avgProductivity,
        maxDailyOutput: teamOutputCap,
      });
      appliedRatesByStage[stageCode] = rate;

      const stageScope = {
        group: {
          stage: {
            eapProjectId: eap.id,
            code: stageCode,
          },
        },
      };

      const [resOriginal, resModified] = await Promise.all([
        tx.eapItem.updateMany({
          where: { ...stageScope, revisionTag: "ORIGINAL" },
          data: {
            laborUnitCost: rate,
            teamsCount: team.maxSimultaneousFronts,
            revisionTag: "CUSTO_ALTERADO",
          },
        }),
        tx.eapItem.updateMany({
          where: { ...stageScope, revisionTag: { not: "ORIGINAL" } },
          data: {
            laborUnitCost: rate,
            teamsCount: team.maxSimultaneousFronts,
          },
        }),
      ]);

      updatedCount += resOriginal.count + resModified.count;
    }

    return {
      updatedCount,
      teamCode: team.teamCode,
      teamDailyCost: summary.totalDailyCost,
      stageCodes: uniqueStageCodes,
      appliedRatesByStage,
    };
  });
}
