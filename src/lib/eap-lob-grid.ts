import {
  isNonWorkingDayUTC,
  toIsoDateKeyUTC,
} from "@/server/eap/calculator";
import {
  MASTER_LOB_PACKAGES,
  type EapZoneCode,
} from "@/server/eap/templates/residential-master";

export type LobTimeScale = "DIARIO" | "SEMANAL" | "MENSAL" | "ANUAL";

export interface LobPackageRegistryEntry {
  packageNumber: number;
  name: string;
  corHex: string;
  textHex: string;
  disciplina: string;
  equipeNecessaria: number;
  predecessores: number[];
}

export interface LobSegmentLike {
  id?: string;
  zoneCode: EapZoneCode | string;
  segmentOrder: number;
  startDate: string;
  endDate: string;
  workingDays: number;
  parallelLane: number;
  progressPercent?: number;
  notes?: string | null;
}

export interface LobPackageLike {
  id: string;
  packageNumber: number;
  name: string;
  waveName: string;
  linkedStageCodes: string[];
  predecessorNumbers: number[];
  durationWorkingDays: number;
  teamsCount: number;
  orderIndex?: number;
  segments: LobSegmentLike[];
}

export interface LobTimelineColumn {
  key: string;
  label: string;
  subLabel: string;
  groupKey: string;
  groupLabel: string;
  isHoliday: boolean;
  holidayName: string | null;
  editable: boolean;
  workingDaysIso: string[];
  startIso: string;
  endIso: string;
}

export interface LobTimelineResult {
  columns: LobTimelineColumn[];
  topGroups: Array<{ key: string; label: string; count: number }>;
  allWorkingDaysIso: string[];
}

export interface LobPrecedenceViolation {
  packageNumber: number;
  packageName: string;
  predecessorNumber: number;
  predecessorEndDate: string;
  packageStartDate: string;
}

export interface LobConflictAnalysis {
  teamsByDay: Record<string, number>;
  overloadedDays: Array<{ iso: string; teams: number; limit: number }>;
  precedenceViolations: LobPrecedenceViolation[];
  conflictingPackageNumbers: number[];
}

const PACKAGE_PALETTE: ReadonlyArray<{ bg: string; text: string }> = [
  { bg: "#1D4ED8", text: "#FFFFFF" }, // 1 Azul Royal
  { bg: "#0284C7", text: "#FFFFFF" }, // 2 Azul Ciano
  { bg: "#0F766E", text: "#FFFFFF" }, // 3 Verde Petróleo
  { bg: "#DC2626", text: "#FFFFFF" }, // 4 Vermelho Vivo
  { bg: "#EA580C", text: "#FFFFFF" }, // 5 Laranja Queimado
  { bg: "#CA8A04", text: "#111827" }, // 6 Amarelo Ouro
  { bg: "#7C3AED", text: "#FFFFFF" }, // 7 Roxo Intenso
  { bg: "#9333EA", text: "#FFFFFF" }, // 8 Púrpura
  { bg: "#C026D3", text: "#FFFFFF" }, // 9 Magenta
  { bg: "#16A34A", text: "#FFFFFF" }, // 10 Verde Esmeralda
  { bg: "#15803D", text: "#FFFFFF" }, // 11 Verde Floresta
  { bg: "#65A30D", text: "#111827" }, // 12 Lima Escuro
  { bg: "#0891B2", text: "#FFFFFF" }, // 13 Turquesa
  { bg: "#2563EB", text: "#FFFFFF" }, // 14 Cobalto
  { bg: "#D97706", text: "#FFFFFF" }, // 15 Âmbar
  { bg: "#B45309", text: "#FFFFFF" }, // 16 Ocre
  { bg: "#E11D48", text: "#FFFFFF" }, // 17 Carmesim
  { bg: "#BE185D", text: "#FFFFFF" }, // 18 Vinho
  { bg: "#4F46E5", text: "#FFFFFF" }, // 19 Índigo
  { bg: "#0D9488", text: "#FFFFFF" }, // 20 Teal
  { bg: "#059669", text: "#FFFFFF" }, // 21 Menta Escuro
  { bg: "#F59E0B", text: "#111827" }, // 22 Dourado
  { bg: "#0369A1", text: "#FFFFFF" }, // 23 Azul Marinho
  { bg: "#6D28D9", text: "#FFFFFF" }, // 24 Violeta
  { bg: "#DB2777", text: "#FFFFFF" }, // 25 Pink
  { bg: "#FB923C", text: "#111827" }, // 26 Pêssego
  { bg: "#4338CA", text: "#FFFFFF" }, // 27 Índigo Profundo
  { bg: "#047857", text: "#FFFFFF" }, // 28 Jade
  { bg: "#A16207", text: "#FFFFFF" }, // 29 Bronze
  { bg: "#B91C1C", text: "#FFFFFF" }, // 30 Rubi
  { bg: "#1E40AF", text: "#FFFFFF" }, // 31 Safira
  { bg: "#0E7490", text: "#FFFFFF" }, // 32 Ciano Profundo
  { bg: "#7E22CE", text: "#FFFFFF" }, // 33 Ametista
  { bg: "#A21CAF", text: "#FFFFFF" }, // 34 Orquídea
  { bg: "#3F6212", text: "#FFFFFF" }, // 35 Oliva
  { bg: "#9A3412", text: "#FFFFFF" }, // 36 Terracota
  { bg: "#334155", text: "#FFFFFF" }, // 37 Grafite
  { bg: "#0F172A", text: "#FFFFFF" }, // 38 Ônix
];

export const LOB_PACKAGE_COLOR_MAP: Record<number, LobPackageRegistryEntry> = Object.fromEntries(
  MASTER_LOB_PACKAGES.map((pkg) => {
    const color = PACKAGE_PALETTE[(pkg.packageNumber - 1) % PACKAGE_PALETTE.length];
    return [
      pkg.packageNumber,
      {
        packageNumber: pkg.packageNumber,
        name: pkg.name,
        corHex: color.bg,
        textHex: color.text,
        disciplina: pkg.waveName,
        equipeNecessaria: pkg.defaultTeamsCount,
        predecessores: pkg.predecessorNumbers,
      },
    ];
  })
);

export function getLobPackageMeta(
  packageNumber: number,
  livePkg?: Pick<LobPackageLike, "name" | "waveName" | "teamsCount" | "predecessorNumbers"> | null
): LobPackageRegistryEntry {
  const base = LOB_PACKAGE_COLOR_MAP[packageNumber];
  const color = PACKAGE_PALETTE[(Math.max(1, packageNumber) - 1) % PACKAGE_PALETTE.length];
  if (base && !livePkg) return base;
  return {
    packageNumber,
    name: livePkg?.name ?? base?.name ?? `Pacote ${packageNumber}`,
    corHex: base?.corHex ?? color.bg,
    textHex: base?.textHex ?? color.text,
    disciplina: livePkg?.waveName ?? base?.disciplina ?? "Obra",
    equipeNecessaria: livePkg?.teamsCount ?? base?.equipeNecessaria ?? 1,
    predecessores: livePkg?.predecessorNumbers ?? base?.predecessores ?? [],
  };
}

const MONTH_FULL_PT = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MONTH_SHORT_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const WEEKDAY_INITIAL = ["D", "S", "T", "Q", "Q", "S", "S"];

function parseUtcDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function stepWorkingDayUTC(
  isoDate: string,
  deltaWorkingDays: number,
  holidaySet: Set<string>
): string {
  const cursor = parseUtcDate(isoDate);
  if (deltaWorkingDays === 0) {
    while (isNonWorkingDayUTC(cursor, holidaySet)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return toIsoDateKeyUTC(cursor);
  }

  const step = deltaWorkingDays > 0 ? 1 : -1;
  let remaining = Math.abs(Math.round(deltaWorkingDays));
  let guard = 0;
  while (remaining > 0 && guard < 3650) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    if (!isNonWorkingDayUTC(cursor, holidaySet)) {
      remaining -= 1;
    }
    guard += 1;
  }
  return toIsoDateKeyUTC(cursor);
}

export function enumerateWorkingDaysInRange(
  startIso: string,
  endIso: string,
  holidaySet: Set<string>
): string[] {
  if (!startIso || !endIso || endIso < startIso) return [];
  const cursor = parseUtcDate(startIso);
  const endTs = parseUtcDate(endIso).getTime();
  const list: string[] = [];
  let guard = 0;
  while (cursor.getTime() <= endTs && guard < 1500) {
    if (!isNonWorkingDayUTC(cursor, holidaySet)) {
      list.push(toIsoDateKeyUTC(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return list;
}

export function scaleUnitsToWorkingDays(scale: LobTimeScale, units: number): number {
  const n = Math.round(units);
  if (scale === "DIARIO") return n;
  if (scale === "SEMANAL") return n * 5;
  if (scale === "MENSAL") return n * 22;
  return n * 252;
}

/**
 * Constrói o calendário em 4 escalas temporais (Diário, Semanal, Mensal, Anual),
 * preservando feriados regionais marcados em cinza e listando os dias úteis exatos de cada coluna.
 */
export function buildLobTimeline(input: {
  scale: LobTimeScale;
  startDate: string;
  endDate: string;
  holidays: Array<{ date: string; name: string }>;
  trailingWorkingDays?: number;
}): LobTimelineResult {
  const holidayMap = new Map(input.holidays.map((h) => [h.date.slice(0, 10), h.name]));
  const holidaySet = new Set(holidayMap.keys());

  const safeStart = input.startDate ? input.startDate.slice(0, 10) : "2026-04-01";
  const rawEnd = input.endDate ? input.endDate.slice(0, 10) : safeStart;
  const effectiveEnd = stepWorkingDayUTC(
    rawEnd >= safeStart ? rawEnd : safeStart,
    input.trailingWorkingDays ?? 10,
    holidaySet
  );

  // Coleta todos os dias de semana (seg..sex) do período
  const allWeekdayDates: string[] = [];
  const allWorkingDaysIso: string[] = [];
  const cursor = parseUtcDate(safeStart);
  const endTs = parseUtcDate(effectiveEnd).getTime();
  while (cursor.getTime() <= endTs && allWeekdayDates.length < 750) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const iso = toIsoDateKeyUTC(cursor);
      allWeekdayDates.push(iso);
      if (!holidaySet.has(iso)) {
        allWorkingDaysIso.push(iso);
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const columns: LobTimelineColumn[] = [];

  if (input.scale === "DIARIO") {
    for (const iso of allWeekdayDates) {
      const dt = parseUtcDate(iso);
      const m = dt.getUTCMonth();
      const yy = String(dt.getUTCFullYear()).slice(-2);
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      const hName = holidayMap.get(iso) ?? null;
      columns.push({
        key: iso,
        label: `${dd}/${MONTH_SHORT_PT[m]}/${yy}`,
        subLabel: WEEKDAY_INITIAL[dt.getUTCDay()],
        groupKey: iso.slice(0, 7),
        groupLabel: `${MONTH_FULL_PT[m]}-${yy}`,
        isHoliday: Boolean(hName),
        holidayName: hName,
        editable: !hName,
        workingDaysIso: hName ? [] : [iso],
        startIso: iso,
        endIso: iso,
      });
    }
  } else if (input.scale === "SEMANAL") {
    const weekMap = new Map<string, LobTimelineColumn>();
    for (const iso of allWeekdayDates) {
      const dt = parseUtcDate(iso);
      const dow = dt.getUTCDay(); // 1..5
      const mon = new Date(dt.getTime());
      mon.setUTCDate(mon.getUTCDate() - (dow - 1));
      const weekKey = toIsoDateKeyUTC(mon);
      const existing = weekMap.get(weekKey);
      const isHol = holidaySet.has(iso);
      if (existing) {
        if (!isHol) existing.workingDaysIso.push(iso);
        existing.endIso = iso;
        existing.editable = existing.workingDaysIso.length > 0;
        existing.isHoliday = existing.workingDaysIso.length === 0;
      } else {
        const m = mon.getUTCMonth();
        const yy = String(mon.getUTCFullYear()).slice(-2);
        const dd = String(mon.getUTCDate()).padStart(2, "0");
        const weekNum = Math.ceil(
          (mon.getTime() - Date.UTC(mon.getUTCFullYear(), 0, 1)) / (7 * 86_400_000)
        );
        weekMap.set(weekKey, {
          key: `W-${weekKey}`,
          label: `${dd}/${MONTH_SHORT_PT[m]}`,
          subLabel: `S${String(Math.max(1, weekNum)).padStart(2, "0")}`,
          groupKey: weekKey.slice(0, 7),
          groupLabel: `${MONTH_FULL_PT[m]}-${yy}`,
          isHoliday: isHol,
          holidayName: isHol ? holidayMap.get(iso) ?? "Feriado" : null,
          editable: !isHol,
          workingDaysIso: isHol ? [] : [iso],
          startIso: iso,
          endIso: iso,
        });
      }
    }
    columns.push(...weekMap.values());
  } else if (input.scale === "MENSAL") {
    const monthMap = new Map<string, LobTimelineColumn>();
    for (const iso of allWeekdayDates) {
      const mKey = iso.slice(0, 7);
      const isHol = holidaySet.has(iso);
      const existing = monthMap.get(mKey);
      if (existing) {
        if (!isHol) existing.workingDaysIso.push(iso);
        existing.endIso = iso;
        existing.editable = existing.workingDaysIso.length > 0;
        existing.isHoliday = existing.workingDaysIso.length === 0;
      } else {
        const dt = parseUtcDate(iso);
        const m = dt.getUTCMonth();
        const yyyy = String(dt.getUTCFullYear());
        monthMap.set(mKey, {
          key: `M-${mKey}`,
          label: `${MONTH_SHORT_PT[m]}/${yyyy.slice(-2)}`,
          subLabel: MONTH_FULL_PT[m].slice(0, 3).toUpperCase(),
          groupKey: yyyy,
          groupLabel: yyyy,
          isHoliday: isHol,
          holidayName: null,
          editable: !isHol,
          workingDaysIso: isHol ? [] : [iso],
          startIso: iso,
          endIso: iso,
        });
      }
    }
    columns.push(...monthMap.values());
  } else {
    // ANUAL
    const yearMap = new Map<string, LobTimelineColumn>();
    for (const iso of allWeekdayDates) {
      const yKey = iso.slice(0, 4);
      const isHol = holidaySet.has(iso);
      const existing = yearMap.get(yKey);
      if (existing) {
        if (!isHol) existing.workingDaysIso.push(iso);
        existing.endIso = iso;
        existing.editable = existing.workingDaysIso.length > 0;
        existing.isHoliday = existing.workingDaysIso.length === 0;
      } else {
        yearMap.set(yKey, {
          key: `Y-${yKey}`,
          label: yKey,
          subLabel: "ANO",
          groupKey: "HORIZONTE",
          groupLabel: "Visão Anual",
          isHoliday: isHol,
          holidayName: null,
          editable: !isHol,
          workingDaysIso: isHol ? [] : [iso],
          startIso: iso,
          endIso: iso,
        });
      }
    }
    columns.push(...yearMap.values());
  }

  const topGroups: Array<{ key: string; label: string; count: number }> = [];
  for (const col of columns) {
    const last = topGroups[topGroups.length - 1];
    if (last && last.key === col.groupKey) {
      last.count += 1;
    } else {
      topGroups.push({ key: col.groupKey, label: col.groupLabel, count: 1 });
    }
  }

  return { columns, topGroups, allWorkingDaysIso };
}

export function segmentsToWorkingDaySet(
  segments: LobSegmentLike[],
  holidaySet: Set<string>
): Set<string> {
  const active = new Set<string>();
  for (const seg of segments) {
    for (const d of enumerateWorkingDaysInRange(seg.startDate, seg.endDate, holidaySet)) {
      active.add(d);
    }
  }
  return active;
}

/**
 * Converte um conjunto de datas úteis ativas em uma zona de volta para segmentos contínuos,
 * pulando automaticamente finais de semana e feriados entre datas consecutivas.
 */
export function workingDaySetToSegments(input: {
  zoneCode: EapZoneCode | string;
  activeIsoSet: Set<string>;
  holidaySet: Set<string>;
  parallelLane?: number;
  notes?: string | null;
}): Array<{
  zoneCode: EapZoneCode | string;
  segmentOrder: number;
  startDate: string;
  endDate: string;
  workingDays: number;
  parallelLane: number;
  notes: string | null;
}> {
  const sorted = [...input.activeIsoSet]
    .filter((iso) => !isNonWorkingDayUTC(parseUtcDate(iso), input.holidaySet))
    .sort();

  if (sorted.length === 0) return [];

  const groups: string[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const expectedNext = stepWorkingDayUTC(prev, 1, input.holidaySet);
    if (curr === expectedNext) {
      groups[groups.length - 1].push(curr);
    } else {
      groups.push([curr]);
    }
  }

  return groups.map((days, idx) => ({
    zoneCode: input.zoneCode,
    segmentOrder: idx + 1,
    startDate: days[0],
    endDate: days[days.length - 1],
    workingDays: days.length,
    parallelLane: input.parallelLane ?? 1,
    notes: input.notes ?? null,
  }));
}

function getPackageBounds(
  pkg: Pick<LobPackageLike, "segments">,
  holidaySet: Set<string>
): { start: string | null; end: string | null; workingDays: number } {
  let start: string | null = null;
  let end: string | null = null;
  let workingDays = 0;
  for (const seg of pkg.segments) {
    if (!start || seg.startDate < start) start = seg.startDate;
    if (!end || seg.endDate > end) end = seg.endDate;
    workingDays += enumerateWorkingDaysInRange(seg.startDate, seg.endDate, holidaySet).length;
  }
  return { start, end, workingDays };
}

function shiftSegmentsPreservingDuration(
  segments: LobSegmentLike[],
  deltaWorkingDays: number,
  holidaySet: Set<string>
): LobSegmentLike[] {
  if (deltaWorkingDays === 0) return segments.map((s) => ({ ...s }));
  return segments.map((seg) => {
    const dur = Math.max(
      1,
      enumerateWorkingDaysInRange(seg.startDate, seg.endDate, holidaySet).length || seg.workingDays
    );
    const nextStart = stepWorkingDayUTC(seg.startDate, deltaWorkingDays, holidaySet);
    const nextEnd = dur <= 1 ? nextStart : stepWorkingDayUTC(nextStart, dur - 1, holidaySet);
    return {
      ...seg,
      startDate: nextStart,
      endDate: nextEnd,
      workingDays: dur,
    };
  });
}

/**
 * Desloca pacotes selecionados em ±N dias úteis (pulando finais de semana e feriados),
 * com opção de deslocar dependentes em cascata para manter a lógica construtiva.
 */
export function shiftSchedulePackages<T extends LobPackageLike>(input: {
  packages: T[];
  targetPackageNumbers: number[];
  deltaWorkingDays: number;
  holidaySet: Set<string>;
  cascadeDependents: boolean;
}): {
  packages: T[];
  movedPackageNumbers: number[];
} {
  const { packages, targetPackageNumbers, deltaWorkingDays, holidaySet, cascadeDependents } = input;
  if (deltaWorkingDays === 0 || targetPackageNumbers.length === 0) {
    return { packages: packages.map((p) => ({ ...p })), movedPackageNumbers: [] };
  }

  const targetSet = new Set(targetPackageNumbers);
  const byNumber = new Map<number, T>();
  const cloned = packages.map((p) => {
    const copy = {
      ...p,
      segments: p.segments.map((s) => ({ ...s })),
    };
    byNumber.set(copy.packageNumber, copy);
    return copy;
  });

  // Coleta sucessores transitivos em cascata quando habilitado
  const cascadeSet = new Set<number>(targetSet);
  if (cascadeDependents) {
    let added = true;
    while (added) {
      added = false;
      for (const pkg of cloned) {
        if (cascadeSet.has(pkg.packageNumber)) continue;
        if (pkg.predecessorNumbers.some((pred) => cascadeSet.has(pred))) {
          cascadeSet.add(pkg.packageNumber);
          added = true;
        }
      }
    }
  }

  const moved: number[] = [];
  const ordered = [...cloned].sort((a, b) => a.packageNumber - b.packageNumber);

  for (const pkg of ordered) {
    if (!cascadeSet.has(pkg.packageNumber) || pkg.segments.length === 0) continue;

    if (targetSet.has(pkg.packageNumber)) {
      pkg.segments = shiftSegmentsPreservingDuration(pkg.segments, deltaWorkingDays, holidaySet);
      moved.push(pkg.packageNumber);
      continue;
    }

    // Dependente em cascata: aplica deslocamento respeitando predecessoras
    let nextSegs = shiftSegmentsPreservingDuration(pkg.segments, deltaWorkingDays, holidaySet);
    const boundsAfterShift = getPackageBounds({ segments: nextSegs }, holidaySet);
    let minAllowedStart: string | null = null;
    for (const predNum of pkg.predecessorNumbers) {
      const pred = byNumber.get(predNum);
      if (!pred) continue;
      const predBounds = getPackageBounds(pred, holidaySet);
      if (predBounds.end) {
        const minStart = stepWorkingDayUTC(predBounds.end, 1, holidaySet);
        if (!minAllowedStart || minStart > minAllowedStart) {
          minAllowedStart = minStart;
        }
      }
    }

    if (minAllowedStart && boundsAfterShift.start && boundsAfterShift.start < minAllowedStart) {
      const diff =
        enumerateWorkingDaysInRange(boundsAfterShift.start, minAllowedStart, holidaySet).length - 1;
      if (diff > 0) {
        nextSegs = shiftSegmentsPreservingDuration(nextSegs, diff, holidaySet);
      }
    }

    pkg.segments = nextSegs;
    moved.push(pkg.packageNumber);
  }

  return { packages: cloned, movedPackageNumbers: moved };
}

/**
 * Soma equipes por dia útil e valida precedência lógica entre todos os pacotes.
 */
export function analyzeLobConflicts(input: {
  packages: LobPackageLike[];
  holidaySet: Set<string>;
  maxTeamsLimit: number;
}): LobConflictAnalysis {
  const { packages, holidaySet, maxTeamsLimit } = input;
  const teamsByDay: Record<string, number> = {};
  const pkgsByDay = new Map<string, Set<number>>();
  const conflictingSet = new Set<number>();

  const boundsByPkg = new Map<number, { start: string | null; end: string | null }>();

  for (const pkg of packages) {
    const pkgTeams = Math.max(1, pkg.teamsCount || 1);
    const bounds = getPackageBounds(pkg, holidaySet);
    boundsByPkg.set(pkg.packageNumber, { start: bounds.start, end: bounds.end });

    const activeDays = segmentsToWorkingDaySet(pkg.segments, holidaySet);
    for (const dayIso of activeDays) {
      teamsByDay[dayIso] = (teamsByDay[dayIso] || 0) + pkgTeams;
      const set = pkgsByDay.get(dayIso) ?? new Set<number>();
      set.add(pkg.packageNumber);
      pkgsByDay.set(dayIso, set);
    }
  }

  const overloadedDays: Array<{ iso: string; teams: number; limit: number }> = [];
  for (const [iso, teams] of Object.entries(teamsByDay).sort(([a], [b]) => a.localeCompare(b))) {
    if (teams > maxTeamsLimit) {
      overloadedDays.push({ iso, teams, limit: maxTeamsLimit });
      const activeNums = pkgsByDay.get(iso);
      if (activeNums) {
        for (const n of activeNums) conflictingSet.add(n);
      }
    }
  }

  const precedenceViolations: LobPrecedenceViolation[] = [];
  for (const pkg of packages) {
    const pkgBounds = boundsByPkg.get(pkg.packageNumber);
    if (!pkgBounds?.start) continue;

    for (const predNum of pkg.predecessorNumbers) {
      const predBounds = boundsByPkg.get(predNum);
      if (!predBounds?.end) continue;
      if (pkgBounds.start <= predBounds.end) {
        precedenceViolations.push({
          packageNumber: pkg.packageNumber,
          packageName: pkg.name,
          predecessorNumber: predNum,
          predecessorEndDate: predBounds.end,
          packageStartDate: pkgBounds.start,
        });
        conflictingSet.add(pkg.packageNumber);
      }
    }
  }

  return {
    teamsByDay,
    overloadedDays,
    precedenceViolations,
    conflictingPackageNumbers: [...conflictingSet].sort((a, b) => a - b),
  };
}

/**
 * Nivela automaticamente pacotes conflitantes empurrando-os para a próxima janela livre
 * que respeite todas as predecessoras e o limite diário de equipes (`maxTeamsLimit`).
 */
export function autoLevelConflictingPackages<T extends LobPackageLike>(input: {
  packages: T[];
  holidaySet: Set<string>;
  maxTeamsLimit: number;
  focusPackageNumbers?: number[];
}): {
  packages: T[];
  leveledPackageNumbers: number[];
} {
  const { packages, holidaySet, maxTeamsLimit, focusPackageNumbers } = input;
  const focusSet = focusPackageNumbers && focusPackageNumbers.length > 0 ? new Set(focusPackageNumbers) : null;

  const cloned = packages.map((p) => ({
    ...p,
    segments: p.segments.map((s) => ({ ...s })),
  }));
  const byNumber = new Map<number, T>();
  for (const p of cloned) byNumber.set(p.packageNumber, p);

  // Ordenação topológica simplificada respeitando predecessoras e número do pacote
  const sorted = [...cloned].sort((a, b) => a.packageNumber - b.packageNumber);
  const occupancy = new Map<string, number>();
  const leveled: number[] = [];

  for (const pkg of sorted) {
    if (pkg.segments.length === 0) continue;
    const teams = Math.max(1, pkg.teamsCount || 1);
    const bounds = getPackageBounds(pkg, holidaySet);
    if (!bounds.start) continue;

    let minAllowedStart = bounds.start;
    for (const predNum of pkg.predecessorNumbers) {
      const pred = byNumber.get(predNum);
      if (!pred) continue;
      const predBounds = getPackageBounds(pred, holidaySet);
      if (predBounds.end) {
        const afterPred = stepWorkingDayUTC(predBounds.end, 1, holidaySet);
        if (afterPred > minAllowedStart) {
          minAllowedStart = afterPred;
        }
      }
    }

    const canEvaluateMove = !focusSet || focusSet.has(pkg.packageNumber) || bounds.start < minAllowedStart;

    let candidateSegs = pkg.segments;
    if (bounds.start < minAllowedStart) {
      const gap = enumerateWorkingDaysInRange(bounds.start, minAllowedStart, holidaySet).length - 1;
      candidateSegs = shiftSegmentsPreservingDuration(pkg.segments, Math.max(1, gap), holidaySet);
    }

    if (canEvaluateMove) {
      let attempts = 0;
      while (attempts < 400) {
        const activeDays = segmentsToWorkingDaySet(candidateSegs, holidaySet);
        let overloaded = false;
        for (const dayIso of activeDays) {
          if ((occupancy.get(dayIso) ?? 0) + teams > maxTeamsLimit) {
            overloaded = true;
            break;
          }
        }
        if (!overloaded) break;
        candidateSegs = shiftSegmentsPreservingDuration(candidateSegs, 1, holidaySet);
        attempts += 1;
      }
    }

    const nextStart = getPackageBounds({ segments: candidateSegs }, holidaySet).start;
    if (nextStart !== bounds.start) {
      pkg.segments = candidateSegs;
      leveled.push(pkg.packageNumber);
    }

    const finalDays = segmentsToWorkingDaySet(pkg.segments, holidaySet);
    for (const dayIso of finalDays) {
      occupancy.set(dayIso, (occupancy.get(dayIso) ?? 0) + teams);
    }
  }

  return {
    packages: cloned,
    leveledPackageNumbers: leveled,
  };
}
