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

/**
 * Calcula contraste WCAG AA automático (texto branco ou escuro) a partir da luminância de corHex.
 */
export function getContrastTextHex(hex: string): "#FFFFFF" | "#111827" {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "#FFFFFF";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#FFFFFF";
}

export const LOB_PACKAGE_COLOR_MAP: Record<number, LobPackageRegistryEntry> = Object.fromEntries(
  MASTER_LOB_PACKAGES.map((pkg) => {
    const color = PACKAGE_PALETTE[(pkg.packageNumber - 1) % PACKAGE_PALETTE.length];
    return [
      pkg.packageNumber,
      {
        packageNumber: pkg.packageNumber,
        name: pkg.name,
        corHex: color.bg,
        textHex: getContrastTextHex(color.bg),
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
  const corHex = base?.corHex ?? color.bg;
  if (base && !livePkg) return base;
  return {
    packageNumber,
    name: livePkg?.name ?? base?.name ?? `Pacote ${packageNumber}`,
    corHex,
    textHex: getContrastTextHex(corHex),
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

// ============================================================================
// FASE 9 — NOVA MATRIZ LOB: PAVIMENTOS × DATAS + CÉLULAS EQUIPE+PACOTE (A1, B3)
// ============================================================================

export interface LobFloorDefinition {
  floorId: string;
  floorName: string;
  floorOrder: number;
}

export interface LobCellToken {
  teamCode: string;
  packageNumber: number;
  code: string; // Ex.: "A1", "B15"
}

export interface LobFloorAllocationItem {
  floorId: string;
  floorName: string;
  floorOrder: number;
  dateIso: string;
  teamCode: string;
  packageNumber: number;
  isOvertime: boolean;
  isLocked?: boolean;
}

export interface ContinuousTimelineColumn extends LobTimelineColumn {
  isWeekend: boolean;
  isNonWorking: boolean;
  weekdayInitial: string;
  dateShort: string; // "DD/MM"
  allDatesIso: string[];
}

export interface ContinuousTimelineResult {
  columns: ContinuousTimelineColumn[];
  topGroups: Array<{ key: string; label: string; count: number }>;
  allCalendarDaysIso: string[];
  allWorkingDaysIso: string[];
}

export const DEFAULT_LOB_FLOORS: LobFloorDefinition[] = [
  { floorId: "FUNDACAO", floorName: "Infraestrutura / Fundação", floorOrder: 1 },
  { floorId: "TERREO", floorName: "Térreo", floorOrder: 2 },
  { floorId: "PAV_SUPERIOR", floorName: "Pavimento Superior", floorOrder: 3 },
  { floorId: "COBERTA", floorName: "Coberta", floorOrder: 4 },
  { floorId: "AREA_EXTERNA", floorName: "Área Externa", floorOrder: 5 },
];

/**
 * Faz o parsing inteligente de entradas como "a1", "A1", "B4, C12", "A5 B15" ou "3" (usando equipe ativa).
 */
export function parseLobCellInput(raw: string, activeTeamCode = "A"): LobCellToken[] {
  const safeDefaultTeam = (activeTeamCode || "A").trim().toUpperCase().replace(/[^A-Z]/g, "") || "A";
  const parts = raw
    .split(/[,;\s]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const tokens: LobCellToken[] = [];

  for (const part of parts) {
    const matchCombined = part.match(/^([A-Z]{1,4})(\d{1,3})$/);
    if (matchCombined) {
      const teamCode = matchCombined[1];
      const packageNumber = Number(matchCombined[2]);
      if (packageNumber >= 1) {
        const code = `${teamCode}${packageNumber}`;
        if (!seen.has(code)) {
          seen.add(code);
          tokens.push({ teamCode, packageNumber, code });
        }
      }
      continue;
    }

    const matchNumberOnly = part.match(/^(\d{1,3})$/);
    if (matchNumberOnly) {
      const packageNumber = Number(matchNumberOnly[1]);
      if (packageNumber >= 1) {
        const code = `${safeDefaultTeam}${packageNumber}`;
        if (!seen.has(code)) {
          seen.add(code);
          tokens.push({ teamCode: safeDefaultTeam, packageNumber, code });
        }
      }
    }
  }

  return tokens;
}

/**
 * Gera linha do tempo contínua com TODOS os dias corridos (incluindo Sábados e Domingos sombreados)
 * e feriados regionais, suportando escalas Diário, Semanal, Mensal e Anual.
 */
export function buildContinuousLobTimeline(input: {
  scale: LobTimeScale;
  startDate: string;
  endDate: string;
  holidays: Array<{ date: string; name: string }>;
  trailingDays?: number;
}): ContinuousTimelineResult {
  const holidayMap = new Map(input.holidays.map((h) => [h.date.slice(0, 10), h.name]));
  const holidaySet = new Set(holidayMap.keys());

  const safeStart = input.startDate ? input.startDate.slice(0, 10) : "2026-04-01";
  const rawEnd = input.endDate && input.endDate >= safeStart ? input.endDate.slice(0, 10) : safeStart;

  const endCursor = parseUtcDate(rawEnd);
  endCursor.setUTCDate(endCursor.getUTCDate() + Math.max(0, input.trailingDays ?? 14));
  const effectiveEnd = toIsoDateKeyUTC(endCursor);

  const allCalendarDaysIso: string[] = [];
  const allWorkingDaysIso: string[] = [];

  const cursor = parseUtcDate(safeStart);
  const endTs = parseUtcDate(effectiveEnd).getTime();
  while (cursor.getTime() <= endTs && allCalendarDaysIso.length < 900) {
    const iso = toIsoDateKeyUTC(cursor);
    allCalendarDaysIso.push(iso);
    if (!isNonWorkingDayUTC(cursor, holidaySet)) {
      allWorkingDaysIso.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const columns: ContinuousTimelineColumn[] = [];

  if (input.scale === "DIARIO") {
    for (const iso of allCalendarDaysIso) {
      const dt = parseUtcDate(iso);
      const dow = dt.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaySet.has(iso);
      const isNonWorking = isWeekend || isHoliday;
      const m = dt.getUTCMonth();
      const yy = String(dt.getUTCFullYear()).slice(-2);
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      const mm = String(m + 1).padStart(2, "0");

      columns.push({
        key: iso,
        label: `${dd}/${mm}`,
        subLabel: WEEKDAY_INITIAL[dow],
        groupKey: `${dt.getUTCFullYear()}-${mm}`,
        groupLabel: `${MONTH_FULL_PT[m]}-${yy}`,
        isHoliday,
        holidayName: holidayMap.get(iso) ?? null,
        isWeekend,
        isNonWorking,
        weekdayInitial: WEEKDAY_INITIAL[dow],
        dateShort: `${dd}/${mm}`,
        editable: true,
        workingDaysIso: isNonWorking ? [] : [iso],
        allDatesIso: [iso],
        startIso: iso,
        endIso: iso,
      });
    }
  } else if (input.scale === "SEMANAL") {
    for (let i = 0; i < allCalendarDaysIso.length; i += 7) {
      const chunk = allCalendarDaysIso.slice(i, i + 7);
      const firstDt = parseUtcDate(chunk[0]);
      const lastDt = parseUtcDate(chunk[chunk.length - 1]);
      const m = firstDt.getUTCMonth();
      const yy = String(firstDt.getUTCFullYear()).slice(-2);
      const mm = String(m + 1).padStart(2, "0");
      const working = chunk.filter((d) => !isNonWorkingDayUTC(parseUtcDate(d), holidaySet));

      columns.push({
        key: `W-${chunk[0]}`,
        label: `${String(firstDt.getUTCDate()).padStart(2, "0")}/${mm}`,
        subLabel: `S${Math.floor(i / 7) + 1}`,
        groupKey: `${firstDt.getUTCFullYear()}-${mm}`,
        groupLabel: `${MONTH_FULL_PT[m]}-${yy}`,
        isHoliday: working.length === 0,
        holidayName: null,
        isWeekend: false,
        isNonWorking: working.length === 0,
        weekdayInitial: `S${Math.floor(i / 7) + 1}`,
        dateShort: `${String(firstDt.getUTCDate()).padStart(2, "0")}–${String(lastDt.getUTCDate()).padStart(2, "0")}`,
        editable: true,
        workingDaysIso: working,
        allDatesIso: chunk,
        startIso: chunk[0],
        endIso: chunk[chunk.length - 1],
      });
    }
  } else if (input.scale === "MENSAL") {
    const byMonth = new Map<string, string[]>();
    for (const iso of allCalendarDaysIso) {
      const key = iso.slice(0, 7);
      const list = byMonth.get(key) ?? [];
      list.push(iso);
      byMonth.set(key, list);
    }
    for (const [ym, days] of byMonth.entries()) {
      const [yStr, mStr] = ym.split("-");
      const mIdx = Number(mStr) - 1;
      const working = days.filter((d) => !isNonWorkingDayUTC(parseUtcDate(d), holidaySet));
      columns.push({
        key: ym,
        label: `${MONTH_SHORT_PT[mIdx]}/${yStr.slice(-2)}`,
        subLabel: `${working.length}d.u.`,
        groupKey: yStr,
        groupLabel: yStr,
        isHoliday: working.length === 0,
        holidayName: null,
        isWeekend: false,
        isNonWorking: working.length === 0,
        weekdayInitial: `${working.length}d`,
        dateShort: `${MONTH_SHORT_PT[mIdx]}`,
        editable: true,
        workingDaysIso: working,
        allDatesIso: days,
        startIso: days[0],
        endIso: days[days.length - 1],
      });
    }
  } else {
    const byYear = new Map<string, string[]>();
    for (const iso of allCalendarDaysIso) {
      const key = iso.slice(0, 4);
      const list = byYear.get(key) ?? [];
      list.push(iso);
      byYear.set(key, list);
    }
    for (const [yStr, days] of byYear.entries()) {
      const working = days.filter((d) => !isNonWorkingDayUTC(parseUtcDate(d), holidaySet));
      columns.push({
        key: yStr,
        label: yStr,
        subLabel: `${working.length}d.u.`,
        groupKey: "OBRA",
        groupLabel: "Anual",
        isHoliday: working.length === 0,
        holidayName: null,
        isWeekend: false,
        isNonWorking: working.length === 0,
        weekdayInitial: `${working.length}d`,
        dateShort: yStr,
        editable: true,
        workingDaysIso: working,
        allDatesIso: days,
        startIso: days[0],
        endIso: days[days.length - 1],
      });
    }
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

  return {
    columns,
    topGroups,
    allCalendarDaysIso,
    allWorkingDaysIso,
  };
}

/**
 * Preenche horizontalmente uma sequência de dias úteis (pulando Sábados, Domingos e feriados,
 * salvo se `includeWeekends` for true) com os tokens informados.
 */
export function fillFloorAllocationsHorizontally(input: {
  allocations: LobFloorAllocationItem[];
  floor: LobFloorDefinition;
  startDateIso: string;
  workingDaysCount: number;
  tokens: LobCellToken[];
  holidaySet: Set<string>;
  includeWeekends?: boolean;
}): LobFloorAllocationItem[] {
  if (input.tokens.length === 0 || input.workingDaysCount <= 0) {
    return input.allocations;
  }

  const targetDates: string[] = [];
  const cursor = parseUtcDate(input.startDateIso);
  let guard = 0;
  while (targetDates.length < input.workingDaysCount && guard < 1500) {
    const iso = toIsoDateKeyUTC(cursor);
    const nonWorking = isNonWorkingDayUTC(cursor, input.holidaySet);
    if (input.includeWeekends || !nonWorking) {
      targetDates.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }

  const map = new Map<string, LobFloorAllocationItem>();
  for (const item of input.allocations) {
    map.set(`${item.floorId}::${item.dateIso}::${item.teamCode}::${item.packageNumber}`, item);
  }

  for (const dateIso of targetDates) {
    const isNonWorking = isNonWorkingDayUTC(parseUtcDate(dateIso), input.holidaySet);
    for (const tok of input.tokens) {
      const key = `${input.floor.floorId}::${dateIso}::${tok.teamCode}::${tok.packageNumber}`;
      map.set(key, {
        floorId: input.floor.floorId,
        floorName: input.floor.floorName,
        floorOrder: input.floor.floorOrder,
        dateIso,
        teamCode: tok.teamCode,
        packageNumber: tok.packageNumber,
        isOvertime: isNonWorking,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Desloca alocações de pavimentos em +N / -N dias úteis, pulando automaticamente finais de semana e feriados.
 */
export function shiftFloorAllocations(input: {
  allocations: LobFloorAllocationItem[];
  floorIds?: string[];
  deltaWorkingDays: number;
  holidaySet: Set<string>;
}): LobFloorAllocationItem[] {
  if (input.deltaWorkingDays === 0) return input.allocations;
  const floorFilter = input.floorIds && input.floorIds.length > 0 ? new Set(input.floorIds) : null;

  const map = new Map<string, LobFloorAllocationItem>();
  for (const item of input.allocations) {
    const shouldShift = !floorFilter || floorFilter.has(item.floorId);
    const nextDateIso = shouldShift
      ? stepWorkingDayUTC(item.dateIso, input.deltaWorkingDays, input.holidaySet)
      : item.dateIso;

    const moved: LobFloorAllocationItem = {
      ...item,
      dateIso: nextDateIso,
    };
    map.set(`${moved.floorId}::${moved.dateIso}::${moved.teamCode}::${moved.packageNumber}`, moved);
  }

  return Array.from(map.values());
}

// ============================================================================
// FASE 10 — MOTOR INTELIGENTE LOB × EAP × EQUIPES A/B/C & NIVELAMENTO
// ============================================================================

export interface EapStageFloorLoad {
  stageCode: string;
  stageName: string;
  floorQuantities: Record<string, number>;
}

export interface FloorMatrixServicePackage {
  packageNumber: number;
  name: string;
  discipline: string;
  corHex: string;
  textHex: string;
  predecessorNumbers: number[];
  productivityPerDay: number;
  productivityUnit: string;
  linkedEapStageCodes: string[];
  isActive: boolean;
}

export interface FloorMatrixWorkTeam {
  teamCode: string;
  name: string;
  specialty: string;
  maxDailyHours: number;
  maxSimultaneousFronts: number;
  dailyCost?: number;
  workers: Array<{
    roleName: string;
    headcount: number;
    dailyRate: number;
    socialChargesPct: number;
    maxDailyOutput?: number | null;
  }>;
}

export interface FloorMatrixConflictItem {
  type: "TEAM_OVERLOAD" | "PRECEDENCE_VIOLATION" | "CAPACITY_EXCEEDED" | "UNALLOCATED_EAP";
  severity: "critical" | "warning";
  floorId?: string;
  floorName?: string;
  dateIso?: string;
  teamCode?: string;
  packageNumber?: number;
  message: string;
}

export interface FloorMatrixTeamSummary {
  teamCode: string;
  name: string;
  workingDays: number;
  headcount: number;
  dailyCost: number;
  totalEstimatedCost: number;
  occupancyPercent: number;
  maxSimultaneousFronts: number;
}

export interface FloorMatrixAnalysisResult {
  startDate: string | null;
  endDate: string | null;
  totalWorkingDays: number;
  totalCalendarDays: number;
  isValid: boolean;
  conflicts: FloorMatrixConflictItem[];
  conflictCellKeys: string[];
  teamSummaries: FloorMatrixTeamSummary[];
  unallocatedStages: Array<{ stageCode: string; stageName: string; totalQty: number }>;
}

export function inferDefaultTeamCodeForPackage(
  pkg: Pick<FloorMatrixServicePackage, "linkedEapStageCodes" | "discipline">,
  workTeams: FloorMatrixWorkTeam[]
): string {
  const available = new Set(workTeams.map((t) => t.teamCode.toUpperCase()));
  const stages = pkg.linkedEapStageCodes;

  if (stages.some((c) => ["08", "09", "10"].includes(c)) && available.has("B")) {
    return "B";
  }
  if (
    stages.some((c) => Number(c) >= 11 && Number(c) <= 26) &&
    available.has("C")
  ) {
    return "C";
  }
  if (available.has("A")) {
    return "A";
  }
  return workTeams[0]?.teamCode.toUpperCase() || "A";
}

export function computeEffectiveDailyCapacity(
  pkg: Pick<FloorMatrixServicePackage, "productivityPerDay">,
  team?: FloorMatrixWorkTeam | null
): number {
  const baseProd = Math.max(0.01, Number(pkg.productivityPerDay) || 1);
  if (!team || team.workers.length === 0) return baseProd;

  const hoursFactor = Math.max(0.25, (Number(team.maxDailyHours) || 8) / 8);
  const cappedOutputs = team.workers
    .filter((w) => typeof w.maxDailyOutput === "number" && w.maxDailyOutput > 0)
    .map((w) => Math.max(1, Number(w.headcount) || 1) * Number(w.maxDailyOutput) * hoursFactor);

  if (cappedOutputs.length === 0) {
    return Math.round(baseProd * hoursFactor * 100) / 100;
  }

  const teamDailyCap = cappedOutputs.reduce((acc, v) => acc + v, 0);
  return Math.max(0.01, Math.round(Math.min(baseProd * hoursFactor, teamDailyCap) * 100) / 100);
}

export function computeTeamDailyCostEstimate(team: FloorMatrixWorkTeam): number {
  if (typeof team.dailyCost === "number" && team.dailyCost >= 0) {
    return Math.round(team.dailyCost * 100) / 100;
  }
  let total = 0;
  for (const w of team.workers) {
    const qty = Math.max(0, Number(w.headcount) || 0);
    const rate = Math.max(0, Number(w.dailyRate) || 0);
    const charges = Math.max(0, Number(w.socialChargesPct) || 0);
    total += qty * rate * (1 + charges / 100);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Gera automaticamente a matriz LOB (Pavimentos × Datas) cruzando quantitativos da EAP,
 * produtividade dos pacotes e limites diários das equipes A, B, C...
 * Quando a EAP ainda está vazia/zerada, aplica Estimativa Paramétrica Inteligente por área (fallback 180 m²).
 */
export function generateIntelligentFloorLobMatrix(input: {
  startDate: string;
  floors: LobFloorDefinition[];
  servicePackages: FloorMatrixServicePackage[];
  workTeams: FloorMatrixWorkTeam[];
  stageLoads: EapStageFloorLoad[];
  holidaySet: Set<string>;
  existingAllocations?: LobFloorAllocationItem[];
  preserveLocked?: boolean;
  builtAreaM2?: number;
}): {
  allocations: LobFloorAllocationItem[];
  scheduledPackagesCount: number;
  skippedNoLoadPackages: number[];
  endDate: string;
  usedParametricFallback: boolean;
} {
  const orderedFloors = [...input.floors].sort((a, b) => a.floorOrder - b.floorOrder);
  const activePackages = [...input.servicePackages]
    .filter((p) => p.isActive)
    .sort((a, b) => a.packageNumber - b.packageNumber);

  const stageLoadMap = new Map(input.stageLoads.map((s) => [s.stageCode, s]));
  const teamMap = new Map(input.workTeams.map((t) => [t.teamCode.toUpperCase(), t]));

  const hasAnyEapQuantity = input.stageLoads.some((st) =>
    Object.values(st.floorQuantities).some((v) => Math.max(0, Number(v) || 0) > 0)
  );
  const effectiveAreaM2 =
    typeof input.builtAreaM2 === "number" && input.builtAreaM2 > 0 ? input.builtAreaM2 : 180;
  const areaFactor = Math.max(0.7, Math.min(3.5, effectiveAreaM2 / 180));

  const lockedAllocations = input.preserveLocked
    ? (input.existingAllocations ?? []).filter((a) => a.isLocked)
    : [];

  const resultMap = new Map<string, LobFloorAllocationItem>();
  const teamOccupancy = new Map<string, Set<string>>(); // "teamCode::dateIso" -> Set<"floorId::pkg">
  const pkgEndByFloor = new Map<string, string>(); // "floorId::pkgNumber" -> maxDateIso
  const lockedFloorDate = new Set<string>(); // "floorId::dateIso"

  for (const alloc of lockedAllocations) {
    const key = `${alloc.floorId}::${alloc.dateIso}::${alloc.teamCode}::${alloc.packageNumber}`;
    resultMap.set(key, alloc);
    lockedFloorDate.add(`${alloc.floorId}::${alloc.dateIso}`);

    const occKey = `${alloc.teamCode}::${alloc.dateIso}`;
    const occSet = teamOccupancy.get(occKey) ?? new Set<string>();
    occSet.add(`${alloc.floorId}::${alloc.packageNumber}`);
    teamOccupancy.set(occKey, occSet);

    const endKey = `${alloc.floorId}::${alloc.packageNumber}`;
    const prevEnd = pkgEndByFloor.get(endKey);
    if (!prevEnd || alloc.dateIso > prevEnd) {
      pkgEndByFloor.set(endKey, alloc.dateIso);
    }
  }

  const baseStart = stepWorkingDayUTC(input.startDate.slice(0, 10), 0, input.holidaySet);
  const skippedNoLoadPackages: number[] = [];
  let scheduledPackagesCount = 0;
  let maxEndDate = baseStart;

  const packageAppliesToFloorParametric = (
    pkg: FloorMatrixServicePackage,
    floor: LobFloorDefinition
  ): boolean => {
    const text = `${pkg.name} ${pkg.discipline}`.toUpperCase();
    const fid = floor.floorId.toUpperCase();
    if (fid === "FUNDACAO" || fid.includes("FUND")) {
      return (
        pkg.packageNumber <= 3 ||
        /PRELIM|CANTEIRO|FUND|INFRA|TERRA|ESTAC|BALDRAM/.test(text)
      );
    }
    if (fid === "COBERTA" || fid.includes("COBERT")) {
      return /COBERT|TELHAD|IMPERMEAB|ESTRUT|LAJE/.test(text) || pkg.packageNumber === 2;
    }
    if (fid === "AREA_EXTERNA" || fid.includes("EXTERN")) {
      return /EXTERN|PAISAG|MURO|CALCAD|PINTUR|DRENAG/.test(text);
    }
    return true;
  };

  const packagesToSchedule = hasAnyEapQuantity
    ? activePackages
    : activePackages.slice(0, 12);

  for (const pkg of packagesToSchedule) {
    const teamCode = inferDefaultTeamCodeForPackage(pkg, input.workTeams);
    const team = teamMap.get(teamCode);
    const maxFronts = Math.max(1, team?.maxSimultaneousFronts ?? 1);
    const effectiveCap = computeEffectiveDailyCapacity(pkg, team);

    let pkgHasAnyLoad = false;

    for (const floor of orderedFloors) {
      let floorQty = 0;
      for (const stageCode of pkg.linkedEapStageCodes) {
        const load = stageLoadMap.get(stageCode);
        if (load) {
          floorQty += Math.max(0, Number(load.floorQuantities[floor.floorId]) || 0);
        }
      }

      let workingDaysNeeded = 0;
      if (hasAnyEapQuantity) {
        if (floorQty <= 0) continue;
        workingDaysNeeded = Math.max(1, Math.ceil(floorQty / effectiveCap));
      } else {
        if (!packageAppliesToFloorParametric(pkg, floor)) continue;
        const speedRatio = Math.max(
          0.5,
          Math.min(2, effectiveCap / Math.max(1, pkg.productivityPerDay || 1))
        );
        workingDaysNeeded = Math.max(2, Math.min(10, Math.round((3 * areaFactor) / speedRatio)));
      }

      pkgHasAnyLoad = true;

      // Respeita predecessores no mesmo pavimento
      let earliestStart = baseStart;
      for (const predNum of pkg.predecessorNumbers) {
        const predEnd = pkgEndByFloor.get(`${floor.floorId}::${predNum}`);
        if (predEnd) {
          const nextAfterPred = stepWorkingDayUTC(predEnd, 1, input.holidaySet);
          if (nextAfterPred > earliestStart) {
            earliestStart = nextAfterPred;
          }
        }
      }

      // Encontra a primeira janela contínua livre respeitando maxSimultaneousFronts da equipe
      let candidateStart = earliestStart;
      let allocatedDates: string[] = [];
      let guard = 0;

      while (guard < 500) {
        const windowDates: string[] = [];
        let cursor = candidateStart;
        let validWindow = true;

        for (let d = 0; d < workingDaysNeeded; d++) {
          const occKey = `${teamCode}::${cursor}`;
          const usedFronts = teamOccupancy.get(occKey)?.size ?? 0;
          if (usedFronts >= maxFronts) {
            validWindow = false;
            break;
          }
          windowDates.push(cursor);
          cursor = stepWorkingDayUTC(cursor, 1, input.holidaySet);
        }

        if (validWindow) {
          allocatedDates = windowDates;
          break;
        }
        candidateStart = stepWorkingDayUTC(candidateStart, 1, input.holidaySet);
        guard += 1;
      }

      for (const dateIso of allocatedDates) {
        if (input.preserveLocked && lockedFloorDate.has(`${floor.floorId}::${dateIso}`)) {
          continue;
        }
        const key = `${floor.floorId}::${dateIso}::${teamCode}::${pkg.packageNumber}`;
        resultMap.set(key, {
          floorId: floor.floorId,
          floorName: floor.floorName,
          floorOrder: floor.floorOrder,
          dateIso,
          teamCode,
          packageNumber: pkg.packageNumber,
          isOvertime: false,
          isLocked: false,
        });

        const occKey = `${teamCode}::${dateIso}`;
        const occSet = teamOccupancy.get(occKey) ?? new Set<string>();
        occSet.add(`${floor.floorId}::${pkg.packageNumber}`);
        teamOccupancy.set(occKey, occSet);

        const endKey = `${floor.floorId}::${pkg.packageNumber}`;
        const prevEnd = pkgEndByFloor.get(endKey);
        if (!prevEnd || dateIso > prevEnd) {
          pkgEndByFloor.set(endKey, dateIso);
        }
        if (dateIso > maxEndDate) {
          maxEndDate = dateIso;
        }
      }
    }

    if (pkgHasAnyLoad) {
      scheduledPackagesCount += 1;
    } else {
      skippedNoLoadPackages.push(pkg.packageNumber);
    }
  }

  return {
    allocations: Array.from(resultMap.values()),
    scheduledPackagesCount,
    skippedNoLoadPackages,
    endDate: maxEndDate,
    usedParametricFallback: !hasAnyEapQuantity,
  };
}

/**
 * Valida em tempo real a matriz LOB: frentes simultâneas da equipe, precedência no pavimento,
 * capacidade diária e consistência EAP × LOB.
 */
export function analyzeFloorMatrixConflicts(input: {
  allocations: LobFloorAllocationItem[];
  floors: LobFloorDefinition[];
  servicePackages: FloorMatrixServicePackage[];
  workTeams: FloorMatrixWorkTeam[];
  stageLoads: EapStageFloorLoad[];
  holidaySet: Set<string>;
}): FloorMatrixAnalysisResult {
  const conflicts: FloorMatrixConflictItem[] = [];
  const conflictCellKeySet = new Set<string>();
  const teamMap = new Map(input.workTeams.map((t) => [t.teamCode.toUpperCase(), t]));
  const pkgMap = new Map(input.servicePackages.map((p) => [p.packageNumber, p]));
  const floorMap = new Map(input.floors.map((f) => [f.floorId, f]));

  let minDate: string | null = null;
  let maxDate: string | null = null;
  const uniqueWorkingDays = new Set<string>();

  // 1. Agrupa por (teamCode, dateIso) para checar maxSimultaneousFronts
  const teamDayFronts = new Map<string, LobFloorAllocationItem[]>();
  // 2. Agrupa por (floorId, packageNumber) para checar precedência
  const floorPkgBounds = new Map<string, { min: string; max: string }>();
  // 3. Conta dias trabalhados por equipe
  const teamWorkDates = new Map<string, Set<string>>();

  for (const alloc of input.allocations) {
    if (!minDate || alloc.dateIso < minDate) minDate = alloc.dateIso;
    if (!maxDate || alloc.dateIso > maxDate) maxDate = alloc.dateIso;

    if (!isNonWorkingDayUTC(parseUtcDate(alloc.dateIso), input.holidaySet) || alloc.isOvertime) {
      uniqueWorkingDays.add(alloc.dateIso);
    }

    const tc = alloc.teamCode.toUpperCase();
    const tdKey = `${tc}::${alloc.dateIso}`;
    const list = teamDayFronts.get(tdKey) ?? [];
    list.push(alloc);
    teamDayFronts.set(tdKey, list);

    const tDates = teamWorkDates.get(tc) ?? new Set<string>();
    tDates.add(alloc.dateIso);
    teamWorkDates.set(tc, tDates);

    const fpKey = `${alloc.floorId}::${alloc.packageNumber}`;
    const prev = floorPkgBounds.get(fpKey);
    floorPkgBounds.set(fpKey, {
      min: !prev || alloc.dateIso < prev.min ? alloc.dateIso : prev.min,
      max: !prev || alloc.dateIso > prev.max ? alloc.dateIso : prev.max,
    });
  }

  // Verifica sobrecarga de frentes simultâneas da equipe
  for (const [tdKey, items] of teamDayFronts.entries()) {
    const [teamCode, dateIso] = tdKey.split("::");
    const team = teamMap.get(teamCode);
    const maxFronts = Math.max(1, team?.maxSimultaneousFronts ?? 1);
    const distinctFronts = new Set(items.map((i) => `${i.floorId}::${i.packageNumber}`));

    if (distinctFronts.size > maxFronts) {
      for (const item of items) {
        conflictCellKeySet.add(`${item.floorId}::${item.dateIso}`);
      }
      conflicts.push({
        type: "TEAM_OVERLOAD",
        severity: "critical",
        dateIso,
        teamCode,
        message: `Equipe ${teamCode} alocada em ${distinctFronts.size} frentes simultâneas em ${dateIso} (limite: ${maxFronts}).`,
      });
    }
  }

  // Verifica quebra de precedência dentro de cada pavimento
  for (const [fpKey, bounds] of floorPkgBounds.entries()) {
    const [floorId, pkgNumStr] = fpKey.split("::");
    const pkgNumber = Number(pkgNumStr);
    const pkg = pkgMap.get(pkgNumber);
    if (!pkg) continue;

    for (const predNum of pkg.predecessorNumbers) {
      const predBounds = floorPkgBounds.get(`${floorId}::${predNum}`);
      if (predBounds && bounds.min <= predBounds.max) {
        conflictCellKeySet.add(`${floorId}::${bounds.min}`);
        const floorName = floorMap.get(floorId)?.floorName || floorId;
        conflicts.push({
          type: "PRECEDENCE_VIOLATION",
          severity: "critical",
          floorId,
          floorName,
          dateIso: bounds.min,
          packageNumber: pkgNumber,
          message: `${floorName}: Pacote ${pkgNumber} (${pkg.name}) inicia em ${bounds.min} antes do término do predecessor #${predNum} (${predBounds.max}).`,
        });
      }
    }
  }

  // Verifica consistência EAP × LOB (etapas com quantidade > 0 sem pacote alocado)
  const allocatedPkgNumbers = new Set(input.allocations.map((a) => a.packageNumber));
  const unallocatedStages: Array<{ stageCode: string; stageName: string; totalQty: number }> = [];

  for (const st of input.stageLoads) {
    const totalQty = Object.values(st.floorQuantities).reduce((s, v) => s + Math.max(0, v), 0);
    if (totalQty <= 0) continue;

    const linkedPkgs = input.servicePackages.filter((p) =>
      p.linkedEapStageCodes.includes(st.stageCode)
    );
    const hasAllocation = linkedPkgs.some((p) => allocatedPkgNumbers.has(p.packageNumber));
    if (!hasAllocation) {
      unallocatedStages.push({
        stageCode: st.stageCode,
        stageName: st.stageName,
        totalQty: Math.round(totalQty * 100) / 100,
      });
      conflicts.push({
        type: "UNALLOCATED_EAP",
        severity: "warning",
        message: `Etapa EAP ${st.stageCode} (${st.stageName}) possui quantidade (${Math.round(totalQty * 100) / 100}) sem pacote alocado na matriz LOB.`,
      });
    }
  }

  const totalWorkingDays = uniqueWorkingDays.size;
  const totalCalendarDays =
    minDate && maxDate
      ? Math.max(
          1,
          Math.round(
            (parseUtcDate(maxDate).getTime() - parseUtcDate(minDate).getTime()) / 86_400_000
          ) + 1
        )
      : 0;

  const teamSummaries: FloorMatrixTeamSummary[] = input.workTeams.map((team) => {
    const tc = team.teamCode.toUpperCase();
    const workingDays = teamWorkDates.get(tc)?.size ?? 0;
    const headcount = team.workers.reduce((s, w) => s + Math.max(0, Number(w.headcount) || 0), 0);
    const dailyCost = computeTeamDailyCostEstimate(team);
    const totalEstimatedCost = Math.round(workingDays * dailyCost * 100) / 100;
    const occupancyPercent =
      totalWorkingDays > 0
        ? Math.min(100, Math.round((workingDays / totalWorkingDays) * 1000) / 10)
        : 0;

    return {
      teamCode: tc,
      name: team.name,
      workingDays,
      headcount,
      dailyCost,
      totalEstimatedCost,
      occupancyPercent,
      maxSimultaneousFronts: Math.max(1, team.maxSimultaneousFronts),
    };
  });

  return {
    startDate: minDate,
    endDate: maxDate,
    totalWorkingDays,
    totalCalendarDays,
    isValid: conflicts.filter((c) => c.severity === "critical").length === 0,
    conflicts,
    conflictCellKeys: Array.from(conflictCellKeySet),
    teamSummaries,
    unallocatedStages,
  };
}

/**
 * Nivelamento automático de conflitos na Matriz LOB:
 * desloca blocos não-travados que violem precedência ou limite de frentes simultâneas
 * para a próxima janela útil livre (pulando finais de semana e feriados).
 */
export function autoLevelFloorMatrix(input: {
  allocations: LobFloorAllocationItem[];
  floors: LobFloorDefinition[];
  servicePackages: FloorMatrixServicePackage[];
  workTeams: FloorMatrixWorkTeam[];
  holidaySet: Set<string>;
}): {
  allocations: LobFloorAllocationItem[];
  movedCount: number;
} {
  const pkgMap = new Map(input.servicePackages.map((p) => [p.packageNumber, p]));
  const teamMap = new Map(input.workTeams.map((t) => [t.teamCode.toUpperCase(), t]));
  const floorOrderMap = new Map(input.floors.map((f) => [f.floorId, f.floorOrder]));

  const locked = input.allocations.filter((a) => a.isLocked);
  const unlocked = input.allocations.filter((a) => !a.isLocked);

  const occupancy = new Map<string, Set<string>>();
  const pkgEndByFloor = new Map<string, string>();
  const finalList: LobFloorAllocationItem[] = [...locked];

  for (const item of locked) {
    const occKey = `${item.teamCode.toUpperCase()}::${item.dateIso}`;
    const set = occupancy.get(occKey) ?? new Set<string>();
    set.add(`${item.floorId}::${item.packageNumber}`);
    occupancy.set(occKey, set);

    const endKey = `${item.floorId}::${item.packageNumber}`;
    const prev = pkgEndByFloor.get(endKey);
    if (!prev || item.dateIso > prev) pkgEndByFloor.set(endKey, item.dateIso);
  }

  // Agrupa blocos desbloqueados por (floorId, packageNumber, teamCode)
  const blockMap = new Map<string, LobFloorAllocationItem[]>();
  for (const item of unlocked) {
    const bKey = `${item.floorId}::${item.packageNumber}::${item.teamCode.toUpperCase()}`;
    const list = blockMap.get(bKey) ?? [];
    list.push(item);
    blockMap.set(bKey, list);
  }

  const orderedBlocks = Array.from(blockMap.values()).sort((a, b) => {
    const pkgDiff = a[0].packageNumber - b[0].packageNumber;
    if (pkgDiff !== 0) return pkgDiff;
    const flDiff =
      (floorOrderMap.get(a[0].floorId) ?? 0) - (floorOrderMap.get(b[0].floorId) ?? 0);
    if (flDiff !== 0) return flDiff;
    return a[0].dateIso.localeCompare(b[0].dateIso);
  });

  let movedCount = 0;

  for (const block of orderedBlocks) {
    const sorted = [...block].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    const sample = sorted[0];
    const teamCode = sample.teamCode.toUpperCase();
    const maxFronts = Math.max(1, teamMap.get(teamCode)?.maxSimultaneousFronts ?? 1);
    const pkg = pkgMap.get(sample.packageNumber);

    let minAllowedDate = sorted[0].dateIso;
    if (pkg) {
      for (const predNum of pkg.predecessorNumbers) {
        const predEnd = pkgEndByFloor.get(`${sample.floorId}::${predNum}`);
        if (predEnd) {
          const nextWorking = stepWorkingDayUTC(predEnd, 1, input.holidaySet);
          if (nextWorking > minAllowedDate) minAllowedDate = nextWorking;
        }
      }
    }

    let candidateStart = stepWorkingDayUTC(minAllowedDate, 0, input.holidaySet);
    const duration = sorted.length;
    let chosenDates: string[] = [];
    let guard = 0;

    while (guard < 500) {
      const windowDates: string[] = [];
      let cursor = candidateStart;
      let ok = true;

      for (let i = 0; i < duration; i++) {
        const occKey = `${teamCode}::${cursor}`;
        const used = occupancy.get(occKey)?.size ?? 0;
        if (used >= maxFronts) {
          ok = false;
          break;
        }
        windowDates.push(cursor);
        cursor = stepWorkingDayUTC(cursor, 1, input.holidaySet);
      }

      if (ok) {
        chosenDates = windowDates;
        break;
      }
      candidateStart = stepWorkingDayUTC(candidateStart, 1, input.holidaySet);
      guard += 1;
    }

    for (let i = 0; i < sorted.length; i++) {
      const orig = sorted[i];
      const nextDate = chosenDates[i] ?? orig.dateIso;
      if (nextDate !== orig.dateIso) movedCount += 1;

      finalList.push({
        ...orig,
        teamCode,
        dateIso: nextDate,
      });

      const occKey = `${teamCode}::${nextDate}`;
      const set = occupancy.get(occKey) ?? new Set<string>();
      set.add(`${orig.floorId}::${orig.packageNumber}`);
      occupancy.set(occKey, set);

      const endKey = `${orig.floorId}::${orig.packageNumber}`;
      const prev = pkgEndByFloor.get(endKey);
      if (!prev || nextDate > prev) pkgEndByFloor.set(endKey, nextDate);
    }
  }

  return {
    allocations: finalList,
    movedCount,
  };
}
