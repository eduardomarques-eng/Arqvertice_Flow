"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { EapFullscreenShell } from "@/components/admin/eap/eap-fullscreen-shell";
import type {
  ServicePackageDTO,
  WorkTeamDTO,
} from "@/components/admin/eap/eap-teams-and-packages-manager";
import { useHistoryStack } from "@/lib/history-stack";
import {
  analyzeFloorMatrixConflicts,
  autoLevelFloorMatrix,
  buildContinuousLobTimeline,
  CANONICAL_LOB_PACKAGE_RULES,
  DEFAULT_LOB_FLOORS,
  fillFloorAllocationsHorizontally,
  generateIntelligentFloorLobMatrix,
  getLobPackageMeta,
  parseLobCellInput,
  shiftFloorAllocations,
  summarizeLobAllocationsByPackage,
  type EapStageFloorLoad,
  type LobFloorAllocationItem,
  type LobFloorDefinition,
  type LobPackageLike,
  type LobSegmentLike,
  type LobTimeScale,
} from "@/lib/eap-lob-grid";
import {
  DATA_ORIGIN_META,
  normalizeDataOrigin,
  type EapDataOrigin,
} from "@/lib/eap-preliminary-13m";
import { clearLobAllocationsByMode, type EapClearMode } from "@/lib/eap-clear-helpers";

interface ZoneDTO {
  id: string;
  code: string;
  name: string;
  orderIndex: number;
}

interface HolidayDTO {
  id: string;
  date: string;
  name: string;
  type: string;
}

interface EapLobSpreadsheetProps {
  projectId: string;
  builtAreaM2?: number;
  plannedStartDate: string | null;
  analyticsStartDate: string | null;
  analyticsEndDate: string | null;
  zones: ZoneDTO[];
  holidays: HolidayDTO[];
  packages: LobPackageLike[];
  servicePackages?: ServicePackageDTO[];
  workTeams?: WorkTeamDTO[];
  initialFloors?: LobFloorDefinition[];
  initialAllocations?: LobFloorAllocationItem[];
  stageLoads?: EapStageFloorLoad[];
  constraintBlocks?: Record<string, { count: number; criticalCount: number; titles: string[] }>;
  onScheduleMutated: () => Promise<void> | void;
  onOpenSegmentModal?: (pkg: LobPackageLike, seg: LobSegmentLike) => void;
  onAllocationsChange?: (allocs: LobFloorAllocationItem[]) => void;
}

type LobDensity = "COMPACTO" | "PADRAO" | "CONFORTAVEL";

interface MatrixSnapshot {
  floors: LobFloorDefinition[];
  allocations: LobFloorAllocationItem[];
}

interface CellSelection {
  floorIndex: number;
  colIndex: number;
}

const SCALE_LABELS: Record<LobTimeScale, string> = {
  DIARIO: "Diário",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  ANUAL: "Anual",
};

const LOB_DENSITY_CELL: Record<LobDensity, string> = {
  COMPACTO: "h-8 min-w-[44px] text-[11px] font-bold whitespace-nowrap",
  PADRAO: "h-9 min-w-[52px] text-xs font-bold tracking-tight whitespace-nowrap",
  CONFORTAVEL: "h-11 min-w-[62px] text-[13px] font-bold tracking-tight whitespace-nowrap",
};

const LOB_DENSITY_HEADER_WIDTH: Record<LobDensity, string> = {
  COMPACTO: "min-w-[44px] whitespace-nowrap",
  PADRAO: "min-w-[52px] whitespace-nowrap",
  CONFORTAVEL: "min-w-[62px] whitespace-nowrap",
};

const LOB_DENSITY_LABELS: Record<LobDensity, string> = {
  COMPACTO: "Compacto",
  PADRAO: "Padrão",
  CONFORTAVEL: "Confortável",
};

const LOB_PHASE_TITLES: Record<number, string> = {
  1: "Fase 1 — Preliminares & Locação",
  2: "Fase 2 — Terraplanagem & Fundações",
  3: "Fase 3 — Supraestrutura",
  4: "Fase 4 — Alvenaria & Vedações",
  5: "Fase 5 — Cobertura & Impermeabilização",
  6: "Fase 6 — Instalações & Embutidos",
  7: "Fase 7 — Chapisco, Reboco & Regularização",
  8: "Fase 8 — Revestimentos, Esquadrias & Pintura",
  9: "Fase 9 — Acabamentos Finais & Entrega",
};

export function EapLobSpreadsheet({
  projectId,
  builtAreaM2,
  plannedStartDate,
  analyticsStartDate,
  analyticsEndDate,
  holidays,
  packages,
  servicePackages = [],
  workTeams = [],
  initialFloors,
  initialAllocations = [],
  stageLoads = [],
  constraintBlocks = {},
  onScheduleMutated,
  onAllocationsChange,
}: EapLobSpreadsheetProps) {
  const [scale, setScale] = useState<LobTimeScale>("DIARIO");
  const [density, setDensity] = useState<LobDensity>("PADRAO");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [legendOpenFullscreen, setLegendOpenFullscreen] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [legendSearch, setLegendSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<"ALL" | EapDataOrigin>("ALL");
  const [fillingPreliminary, setFillingPreliminary] = useState(false);

  const [timelineStart, setTimelineStart] = useState<string>(
    plannedStartDate || analyticsStartDate || "2026-04-01"
  );
  const [timelineEnd, setTimelineEnd] = useState<string>(
    analyticsEndDate || plannedStartDate || "2026-06-30"
  );

  const [matrix, setMatrix] = useState<MatrixSnapshot>(() => ({
    floors:
      initialFloors && initialFloors.length > 0 ? initialFloors : DEFAULT_LOB_FLOORS,
    allocations: initialAllocations,
  }));

  const {
    record: recordHistory,
    stepUndo,
    stepRedo,
    clear: clearHistory,
    canUndo,
    canRedo,
  } = useHistoryStack<MatrixSnapshot>(40);

  const pushMatrix = useCallback(
    (next: MatrixSnapshot) => {
      setMatrix((current) => {
        recordHistory(current);
        return next;
      });
    },
    [recordHistory]
  );

  const undo = useCallback(() => {
    const prev = stepUndo(matrix);
    if (prev) {
      setMatrix(prev);
      setDirty(true);
    }
  }, [stepUndo, matrix]);

  const redo = useCallback(() => {
    const next = stepRedo(matrix);
    if (next) {
      setMatrix(next);
      setDirty(true);
    }
  }, [stepRedo, matrix]);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [activeTeamCode, setActiveTeamCode] = useState<string>(
    workTeams[0]?.teamCode || "A"
  );
  const [activePackageNumber, setActivePackageNumber] = useState<number>(
    servicePackages[0]?.packageNumber || packages[0]?.packageNumber || 1
  );

  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [editingCell, setEditingCell] = useState<CellSelection | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [clipboardText, setClipboardText] = useState<string>("");

  const [dragFillStart, setDragFillStart] = useState<CellSelection | null>(null);
  const [dragFillHoverCol, setDragFillHoverCol] = useState<number | null>(null);

  const [shiftDaysInput, setShiftDaysInput] = useState<string>("5");
  const [newFloorName, setNewFloorName] = useState<string>("");
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingFloorDraft, setEditingFloorDraft] = useState<string>("");
  const [preserveLockedOnGenerate, setPreserveLockedOnGenerate] = useState<boolean>(true);
  const [showConflictsDrawer, setShowConflictsDrawer] = useState<boolean>(false);
  const [usedParametricBanner, setUsedParametricBanner] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const nextFloors =
      initialFloors && initialFloors.length > 0 ? initialFloors : DEFAULT_LOB_FLOORS;
    clearHistory();
    setMatrix({
      floors: nextFloors,
      allocations: initialAllocations,
    });
    setDirty(false);
  }, [initialFloors, initialAllocations, clearHistory]);

  useEffect(() => {
    onAllocationsChange?.(matrix.allocations);
  }, [matrix.allocations, onAllocationsChange]);

  useEffect(() => {
    if (plannedStartDate || analyticsStartDate) {
      setTimelineStart(plannedStartDate || analyticsStartDate || "2026-04-01");
    }
    if (analyticsEndDate) {
      setTimelineEnd(analyticsEndDate);
    }
  }, [plannedStartDate, analyticsStartDate, analyticsEndDate]);

  useEffect(() => {
    if (workTeams.length > 0 && !workTeams.some((t) => t.teamCode === activeTeamCode)) {
      setActiveTeamCode(workTeams[0].teamCode);
    }
  }, [workTeams, activeTeamCode]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => h.date.slice(0, 10))),
    [holidays]
  );

  const packageRegistry = useMemo(() => {
    const map = new Map<
      number,
      {
        packageNumber: number;
        name: string;
        discipline: string;
        corHex: string;
        textHex: string;
      }
    >();

    for (const pkg of packages) {
      const meta = getLobPackageMeta(pkg.packageNumber, pkg);
      map.set(pkg.packageNumber, {
        packageNumber: pkg.packageNumber,
        name: pkg.name,
        discipline: pkg.waveName,
        corHex: meta.corHex,
        textHex: meta.textHex,
      });
    }

    for (const sp of servicePackages) {
      map.set(sp.packageNumber, {
        packageNumber: sp.packageNumber,
        name: sp.name,
        discipline: sp.discipline,
        corHex: sp.corHex,
        textHex: sp.textHex,
      });
    }

    return map;
  }, [packages, servicePackages]);

  const packageChips = useMemo(
    () =>
      Array.from(packageRegistry.values()).sort(
        (a, b) => a.packageNumber - b.packageNumber
      ),
    [packageRegistry]
  );

  const allocationSummaryByPkg = useMemo(
    () => summarizeLobAllocationsByPackage(matrix.allocations),
    [matrix.allocations]
  );

  const originCounts = useMemo(() => {
    let prelim = 0;
    let imported = 0;
    let edited = 0;
    for (const a of matrix.allocations) {
      const org = normalizeDataOrigin(a.dataOrigin);
      if (org === "PRELIMINAR_PADRAO") prelim += 1;
      else if (org === "QUANTITATIVO_IMPORTADO") imported += 1;
      else edited += 1;
    }
    return { prelim, imported, edited };
  }, [matrix.allocations]);

  const legendPhaseGroups = useMemo(() => {
    const q = legendSearch.trim().toLowerCase();
    const groups = new Map<
      number,
      {
        phaseOrder: number;
        phaseTitle: string;
        items: Array<{
          packageNumber: number;
          name: string;
          corHex: string;
          textHex: string;
          defaultTeam: string;
          durationDays: number;
        }>;
      }
    >();

    for (const chip of packageChips) {
      const paddedNum = String(chip.packageNumber).padStart(2, "0");
      if (
        q &&
        !`${chip.packageNumber} ${paddedNum} ${chip.name} ${chip.discipline}`
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }

      const rule = CANONICAL_LOB_PACKAGE_RULES[chip.packageNumber];
      const phaseOrder = rule?.phaseOrder ?? 1;
      const phaseTitle =
        LOB_PHASE_TITLES[phaseOrder] ?? `Fase ${phaseOrder}`;
      const summary = allocationSummaryByPkg.get(chip.packageNumber);
      const defaultTeam =
        summary?.teamCodes[0] ?? rule?.defaultTeam ?? "A";
      const durationDays =
        summary ? summary.workingDaysCount : 0;

      const existing = groups.get(phaseOrder) ?? {
        phaseOrder,
        phaseTitle,
        items: [],
      };
      existing.items.push({
        packageNumber: chip.packageNumber,
        name: chip.name,
        corHex: chip.corHex,
        textHex: chip.textHex,
        defaultTeam,
        durationDays,
      });
      groups.set(phaseOrder, existing);
    }

    return Array.from(groups.values()).sort(
      (a, b) => a.phaseOrder - b.phaseOrder
    );
  }, [packageChips, legendSearch, allocationSummaryByPkg]);

  const teamByCode = useMemo(() => {
    const map = new Map<string, WorkTeamDTO>();
    for (const t of workTeams) {
      map.set(t.teamCode.toUpperCase(), t);
    }
    return map;
  }, [workTeams]);

  const activeTeam = teamByCode.get(activeTeamCode.toUpperCase()) ?? workTeams[0] ?? null;

  const effectiveEnd = useMemo(() => {
    let maxDate = timelineEnd >= timelineStart ? timelineEnd : timelineStart;
    for (const alloc of matrix.allocations) {
      if (alloc.dateIso > maxDate) maxDate = alloc.dateIso;
    }
    return maxDate;
  }, [timelineStart, timelineEnd, matrix.allocations]);

  const timeline = useMemo(
    () =>
      buildContinuousLobTimeline({
        scale,
        startDate: timelineStart,
        endDate: effectiveEnd,
        holidays,
        trailingDays: 14,
      }),
    [scale, timelineStart, effectiveEnd, holidays]
  );

  const allocationsByFloorDate = useMemo(() => {
    const map = new Map<string, LobFloorAllocationItem[]>();
    for (const item of matrix.allocations) {
      const key = `${item.floorId}::${item.dateIso}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [matrix.allocations]);

  // Sub-faixas (pistas de frentes) por pavimento: empacota tokens (Equipe+Pacote) não-sobrepostos em 1..4 pistas
  const floorLanesMap = useMemo(() => {
    const map = new Map<string, Array<Set<string>>>();
    for (const floor of matrix.floors) {
      const floorAllocs = matrix.allocations.filter((a) => a.floorId === floor.floorId);
      const tokenBounds = new Map<string, { min: string; max: string }>();
      for (const a of floorAllocs) {
        const tk = `${a.teamCode}${a.packageNumber}`;
        const prev = tokenBounds.get(tk);
        tokenBounds.set(tk, {
          min: !prev || a.dateIso < prev.min ? a.dateIso : prev.min,
          max: !prev || a.dateIso > prev.max ? a.dateIso : prev.max,
        });
      }
      const orderedTokens = Array.from(tokenBounds.entries()).sort((a, b) =>
        a[1].min.localeCompare(b[1].min) || a[0].localeCompare(b[0])
      );
      const laneBounds: Array<{ max: string; tokens: Set<string> }> = [];
      for (const [tk, b] of orderedTokens) {
        let placed = false;
        for (const lane of laneBounds) {
          if (b.min > lane.max) {
            lane.max = b.max;
            lane.tokens.add(tk);
            placed = true;
            break;
          }
        }
        if (!placed) {
          if (laneBounds.length < 4) {
            laneBounds.push({ max: b.max, tokens: new Set([tk]) });
          } else {
            laneBounds[laneBounds.length - 1].tokens.add(tk);
          }
        }
      }
      map.set(
        floor.floorId,
        laneBounds.length > 0 ? laneBounds.map((l) => l.tokens) : [new Set<string>()]
      );
    }
    return map;
  }, [matrix.floors, matrix.allocations]);

  const resolvePackageVisual = useCallback(
    (packageNumber: number) => {
      const live = packageRegistry.get(packageNumber);
      if (live) return live;
      const fallback = getLobPackageMeta(packageNumber);
      return {
        packageNumber,
        name: fallback.name,
        discipline: fallback.disciplina,
        corHex: fallback.corHex,
        textHex: fallback.textHex,
      };
    },
    [packageRegistry]
  );

  const getCellDisplayItems = useCallback(
    (floorId: string, datesIso: string[]): LobFloorAllocationItem[] => {
      const merged = new Map<string, LobFloorAllocationItem>();
      for (const dateIso of datesIso) {
        const items = allocationsByFloorDate.get(`${floorId}::${dateIso}`) ?? [];
        for (const it of items) {
          const tokenKey = `${it.teamCode}${it.packageNumber}`;
          if (!merged.has(tokenKey)) merged.set(tokenKey, it);
        }
      }
      return Array.from(merged.values()).sort((a, b) =>
        `${a.teamCode}${a.packageNumber}`.localeCompare(`${b.teamCode}${b.packageNumber}`)
      );
    },
    [allocationsByFloorDate]
  );

  const commitCellText = useCallback(
    (floorIndex: number, colIndex: number, raw: string) => {
      const floor = matrix.floors[floorIndex];
      const col = timeline.columns[colIndex];
      if (!floor || !col) return;

      const targetDates =
        col.workingDaysIso.length > 0 ? col.workingDaysIso : [col.startIso];
      const tokens = parseLobCellInput(raw, activeTeamCode);
      const targetDateSet = new Set(targetDates);

      const remaining = matrix.allocations.filter(
        (a) => !(a.floorId === floor.floorId && targetDateSet.has(a.dateIso))
      );

      for (const dateIso of targetDates) {
        const isNonWorking = col.isNonWorking;
        for (const tok of tokens) {
          remaining.push({
            floorId: floor.floorId,
            floorName: floor.floorName,
            floorOrder: floor.floorOrder,
            dateIso,
            teamCode: tok.teamCode,
            packageNumber: tok.packageNumber,
            isOvertime: isNonWorking,
            isLocked: true,
            dataOrigin: "EDITADO_USUARIO",
          });
        }
      }

      pushMatrix({
        floors: matrix.floors,
        allocations: remaining,
      });
      setDirty(true);
      setEditingCell(null);
    },
    [matrix, timeline.columns, activeTeamCode, pushMatrix]
  );

  const toggleOvertimeOnCell = useCallback(
    (floorIndex: number, colIndex: number) => {
      const floor = matrix.floors[floorIndex];
      const col = timeline.columns[colIndex];
      if (!floor || !col) return;

      const targetDate = col.startIso;
      const existing = allocationsByFloorDate.get(`${floor.floorId}::${targetDate}`) ?? [];

      if (existing.length > 0) {
        const next = matrix.allocations.map((a) =>
          a.floorId === floor.floorId && a.dateIso === targetDate
            ? { ...a, isOvertime: !a.isOvertime, dataOrigin: "EDITADO_USUARIO" as const }
            : a
        );
        pushMatrix({ floors: matrix.floors, allocations: next });
        setDirty(true);
        return;
      }

      // Se vazio em fim de semana/feriado, preenche com Equipe Ativa + Pacote Ativo marcado como Hora Extra
      const next: LobFloorAllocationItem[] = [
        ...matrix.allocations,
        {
          floorId: floor.floorId,
          floorName: floor.floorName,
          floorOrder: floor.floorOrder,
          dateIso: targetDate,
          teamCode: activeTeamCode.toUpperCase(),
          packageNumber: activePackageNumber,
          isOvertime: true,
          isLocked: true,
          dataOrigin: "EDITADO_USUARIO",
        },
      ];
      pushMatrix({ floors: matrix.floors, allocations: next });
      setDirty(true);
    },
    [
      matrix,
      timeline.columns,
      allocationsByFloorDate,
      activeTeamCode,
      activePackageNumber,
      pushMatrix,
    ]
  );

  // Finaliza alça de preenchimento horizontal (pulando sábados, domingos e feriados)
  useEffect(() => {
    if (!dragFillStart) return;
    const handleMouseUp = () => {
      if (dragFillHoverCol !== null && dragFillHoverCol > dragFillStart.colIndex) {
        const floor = matrix.floors[dragFillStart.floorIndex];
        const startCol = timeline.columns[dragFillStart.colIndex];
        const endCol = timeline.columns[dragFillHoverCol];
        if (floor && startCol && endCol) {
          const sourceItems = getCellDisplayItems(floor.floorId, startCol.allDatesIso);
          const tokens =
            sourceItems.length > 0
              ? sourceItems.map((i) => ({
                  teamCode: i.teamCode,
                  packageNumber: i.packageNumber,
                  code: `${i.teamCode}${i.packageNumber}`,
                }))
              : [
                  {
                    teamCode: activeTeamCode.toUpperCase(),
                    packageNumber: activePackageNumber,
                    code: `${activeTeamCode.toUpperCase()}${activePackageNumber}`,
                  },
                ];

          let workingCount = 0;
          for (let c = dragFillStart.colIndex; c <= dragFillHoverCol; c++) {
            workingCount += Math.max(0, timeline.columns[c]?.workingDaysIso.length ?? 0);
          }

          if (workingCount > 0) {
            const nextAllocations = fillFloorAllocationsHorizontally({
              allocations: matrix.allocations,
              floor,
              startDateIso: startCol.startIso,
              workingDaysCount: workingCount,
              tokens,
              holidaySet,
            });
            pushMatrix({ floors: matrix.floors, allocations: nextAllocations });
            setDirty(true);
          }
        }
      }
      setDragFillStart(null);
      setDragFillHoverCol(null);
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [
    dragFillStart,
    dragFillHoverCol,
    matrix,
    timeline.columns,
    getCellDisplayItems,
    activeTeamCode,
    activePackageNumber,
    holidaySet,
    pushMatrix,
  ]);

  const handleSaveMatrix = useCallback(async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/schedule/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "FLOOR_MATRIX",
          plannedStartDate: timelineStart,
          floors: matrix.floors,
          allocations: matrix.allocations,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar matriz LOB." });
        return;
      }
      setDirty(false);
      setFeedback({
        type: "success",
        text: `Matriz LOB salva (${json.savedAllocationsCount} alocação(ões) persistida(s)).`,
      });
      await onScheduleMutated();
    } catch {
      setFeedback({ type: "error", text: "Falha de conexão ao salvar matriz LOB." });
    } finally {
      setSaving(false);
    }
  }, [projectId, timelineStart, matrix, onScheduleMutated]);

  const handleShiftInterval = useCallback(
    (sign: 1 | -1) => {
      const days = Math.max(1, Math.round(Number(shiftDaysInput) || 1)) * sign;
      const floorIds =
        selectedCell && matrix.floors[selectedCell.floorIndex]
          ? [matrix.floors[selectedCell.floorIndex].floorId]
          : undefined;
      const next = shiftFloorAllocations({
        allocations: matrix.allocations,
        floorIds,
        deltaWorkingDays: days,
        holidaySet,
      });
      pushMatrix({ floors: matrix.floors, allocations: next });
      setDirty(true);
      setFeedback({
        type: "success",
        text: floorIds
          ? `Pavimento deslocado em ${days > 0 ? `+${days}` : days} dia(s) útil(is).`
          : `Toda a matriz deslocada em ${days > 0 ? `+${days}` : days} dia(s) útil(is).`,
      });
    },
    [shiftDaysInput, selectedCell, matrix, holidaySet, pushMatrix]
  );

  const analysis = useMemo(
    () =>
      analyzeFloorMatrixConflicts({
        allocations: matrix.allocations,
        floors: matrix.floors,
        servicePackages: servicePackages.map((sp) => ({
          packageNumber: sp.packageNumber,
          name: sp.name,
          discipline: sp.discipline,
          corHex: sp.corHex,
          textHex: sp.textHex,
          predecessorNumbers: sp.predecessorNumbers,
          productivityPerDay: sp.productivityPerDay,
          productivityUnit: sp.productivityUnit,
          linkedEapStageCodes: sp.linkedEapStageCodes,
          isActive: sp.isActive,
        })),
        workTeams: workTeams.map((wt) => ({
          teamCode: wt.teamCode,
          name: wt.name,
          specialty: wt.specialty,
          maxDailyHours: wt.maxDailyHours,
          maxSimultaneousFronts: wt.maxSimultaneousFronts,
          workers: wt.workers,
        })),
        stageLoads,
        holidaySet,
      }),
    [matrix, servicePackages, workTeams, stageLoads, holidaySet]
  );

  const conflictCellSet = useMemo(
    () => new Set(analysis.conflictCellKeys),
    [analysis.conflictCellKeys]
  );

  const handleGenerateIntelligentMatrix = useCallback(() => {
    const result = generateIntelligentFloorLobMatrix({
      startDate: timelineStart,
      floors: matrix.floors,
      servicePackages: servicePackages.map((sp) => ({
        packageNumber: sp.packageNumber,
        name: sp.name,
        discipline: sp.discipline,
        corHex: sp.corHex,
        textHex: sp.textHex,
        predecessorNumbers: sp.predecessorNumbers,
        productivityPerDay: sp.productivityPerDay,
        productivityUnit: sp.productivityUnit,
        linkedEapStageCodes: sp.linkedEapStageCodes,
        isActive: sp.isActive,
      })),
      workTeams: workTeams.map((wt) => ({
        teamCode: wt.teamCode,
        name: wt.name,
        specialty: wt.specialty,
        maxDailyHours: wt.maxDailyHours,
        maxSimultaneousFronts: wt.maxSimultaneousFronts,
        workers: wt.workers,
      })),
      stageLoads,
      holidaySet,
      existingAllocations: matrix.allocations,
      preserveLocked: preserveLockedOnGenerate,
      builtAreaM2,
    });

    pushMatrix({ floors: matrix.floors, allocations: result.allocations });
    if (result.endDate) setTimelineEnd(result.endDate);
    setDirty(true);
    setUsedParametricBanner(result.usedParametricFallback);
    setFeedback({
      type: "success",
      text: result.usedParametricFallback
        ? `Matriz LOB gerada por Estimativa Paramétrica Inteligente (${builtAreaM2 && builtAreaM2 > 0 ? builtAreaM2 : 180} m²): ${result.scheduledPackagesCount} pacote(s) alocado(s).`
        : `Matriz LOB gerada da EAP: ${result.scheduledPackagesCount} pacote(s) alocado(s) (${preserveLockedOnGenerate ? "preservando células travadas/manuais" : "regeração completa"}).`,
    });
  }, [
    timelineStart,
    matrix,
    servicePackages,
    workTeams,
    stageLoads,
    holidaySet,
    preserveLockedOnGenerate,
    builtAreaM2,
    pushMatrix,
  ]);

  const handleAutoLevelConflicts = useCallback(() => {
    const leveled = autoLevelFloorMatrix({
      allocations: matrix.allocations,
      floors: matrix.floors,
      servicePackages: servicePackages.map((sp) => ({
        packageNumber: sp.packageNumber,
        name: sp.name,
        discipline: sp.discipline,
        corHex: sp.corHex,
        textHex: sp.textHex,
        predecessorNumbers: sp.predecessorNumbers,
        productivityPerDay: sp.productivityPerDay,
        productivityUnit: sp.productivityUnit,
        linkedEapStageCodes: sp.linkedEapStageCodes,
        isActive: sp.isActive,
      })),
      workTeams: workTeams.map((wt) => ({
        teamCode: wt.teamCode,
        name: wt.name,
        specialty: wt.specialty,
        maxDailyHours: wt.maxDailyHours,
        maxSimultaneousFronts: wt.maxSimultaneousFronts,
        workers: wt.workers,
      })),
      holidaySet,
    });
    pushMatrix({ floors: matrix.floors, allocations: leveled.allocations });
    setDirty(true);
    setFeedback({
      type: "success",
      text:
        leveled.movedCount > 0
          ? `Nivelamento concluído: ${leveled.movedCount} alocação(ões) ajustada(s) para janelas livres.`
          : "Nenhum conflito deslocável encontrado.",
    });
  }, [matrix, servicePackages, workTeams, holidaySet, pushMatrix]);

  const handleAddFloor = useCallback(() => {
    const clean = newFloorName.trim();
    if (!clean) return;
    const slug =
      clean
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 30) || `PAV_${matrix.floors.length + 1}`;
    const uniqueId = matrix.floors.some((f) => f.floorId === slug)
      ? `${slug}_${matrix.floors.length + 1}`
      : slug;
    const nextFloors: LobFloorDefinition[] = [
      ...matrix.floors,
      {
        floorId: uniqueId,
        floorName: clean,
        floorOrder: matrix.floors.length + 1,
      },
    ];
    pushMatrix({ floors: nextFloors, allocations: matrix.allocations });
    setDirty(true);
    setNewFloorName("");
    setShowAddFloor(false);
  }, [newFloorName, matrix, pushMatrix]);

  const handleRenameFloor = useCallback(
    (floorId: string) => {
      const clean = editingFloorDraft.trim();
      if (!clean) {
        setEditingFloorId(null);
        return;
      }
      const nextFloors = matrix.floors.map((f) =>
        f.floorId === floorId ? { ...f, floorName: clean } : f
      );
      const nextAllocations = matrix.allocations.map((a) =>
        a.floorId === floorId ? { ...a, floorName: clean } : a
      );
      pushMatrix({ floors: nextFloors, allocations: nextAllocations });
      setDirty(true);
      setEditingFloorId(null);
    },
    [editingFloorDraft, matrix, pushMatrix]
  );

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (editingCell) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (!selectedCell) return;
      const { floorIndex, colIndex } = selectedCell;
      const floor = matrix.floors[floorIndex];
      const col = timeline.columns[colIndex];
      if (!floor || !col) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const items = getCellDisplayItems(floor.floorId, col.allDatesIso);
        setClipboardText(items.map((i) => `${i.teamCode}${i.packageNumber}`).join(", "));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboardText) {
        e.preventDefault();
        commitCellText(floorIndex, colIndex, clipboardText);
        return;
      }

      if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        setSelectedCell({
          floorIndex,
          colIndex: Math.min(timeline.columns.length - 1, colIndex + 1),
        });
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedCell({ floorIndex, colIndex: Math.max(0, colIndex - 1) });
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCell({
          floorIndex: Math.min(matrix.floors.length - 1, floorIndex + 1),
          colIndex,
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCell({ floorIndex: Math.max(0, floorIndex - 1), colIndex });
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        commitCellText(floorIndex, colIndex, "");
        return;
      }
      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        const items = getCellDisplayItems(floor.floorId, col.allDatesIso);
        setEditingCell({ floorIndex, colIndex });
        setEditingText(items.map((i) => `${i.teamCode}${i.packageNumber}`).join(", "));
        return;
      }

      // Digitação direta de A1, B3 ou número de pacote
      if (/^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setEditingCell({ floorIndex, colIndex });
        setEditingText(e.key.toUpperCase());
      }
    },
    [
      editingCell,
      selectedCell,
      matrix.floors,
      timeline.columns,
      clipboardText,
      getCellDisplayItems,
      commitCellText,
      undo,
      redo,
    ]
  );

  const handleClearLob = useCallback(
    (mode: EapClearMode) => {
      const selectedKeys = new Set<string>();
      if (mode === "SELECTED") {
        if (selectedCell) {
          const floor = matrix.floors[selectedCell.floorIndex];
          const col = timeline.columns[selectedCell.colIndex];
          if (floor && col) {
            for (const d of col.allDatesIso) {
              selectedKeys.add(`${floor.floorId}::${d}`);
            }
          }
        }
        if (dragFillStart && dragFillHoverCol !== null) {
          const floor = matrix.floors[dragFillStart.floorIndex];
          if (floor) {
            for (let ci = dragFillStart.colIndex; ci <= dragFillHoverCol; ci++) {
              const col = timeline.columns[ci];
              if (!col) continue;
              for (const d of col.allDatesIso) {
                selectedKeys.add(`${floor.floorId}::${d}`);
              }
            }
          }
        }
        if (selectedKeys.size === 0) {
          setFeedback({
            type: "error",
            text: "Clique em uma célula da matriz antes de limpar a seleção.",
          });
          setShowClearMenu(false);
          return;
        }
      }

      const { nextAllocations, removedCount } = clearLobAllocationsByMode(
        matrix.allocations,
        mode,
        selectedKeys
      );

      setShowClearMenu(false);
      setConfirmClearAll(false);

      if (removedCount === 0) {
        setFeedback({
          type: "success",
          text: "Nenhuma alocação correspondente para limpar.",
        });
        return;
      }

      pushMatrix({
        floors: matrix.floors,
        allocations: nextAllocations,
      });
      setDirty(true);
      setFeedback({
        type: "success",
        text: `${removedCount} alocação(ões) limpa(s). Use Desfazer (Ctrl+Z) para reverter.`,
      });
    },
    [selectedCell, dragFillStart, dragFillHoverCol, matrix, timeline.columns, pushMatrix]
  );

  const renderMatrixContent = (fullMode: boolean) => (
    <div
      tabIndex={0}
      onKeyDown={handleGlobalKeyDown}
      className={`outline-none ${
        fullMode
          ? "relative flex flex-1 min-h-0 flex-col gap-2.5 p-2"
          : "flex flex-col gap-3"
      }`}
    >
      {/* Faixa Superior: Controles + Equipe Ativa + Pacotes 1..N */}
      <div className="shrink-0 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xs backdrop-blur-md space-y-2.5 dark:border-zinc-800 dark:bg-[#16161D]/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
              Início:
              <input
                type="date"
                value={timelineStart}
                onChange={(e) => {
                  setTimelineStart(e.target.value);
                  setDirty(true);
                }}
                className="ml-1.5 h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              {(Object.keys(SCALE_LABELS) as LobTimeScale[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition cursor-pointer ${
                    scale === s
                      ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                      : "text-slate-700 hover:text-slate-950 dark:text-zinc-300"
                  }`}
                >
                  {SCALE_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              {(Object.keys(LOB_DENSITY_LABELS) as LobDensity[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  className={`h-7 rounded-lg px-2 text-[10px] font-semibold transition cursor-pointer ${
                    density === d
                      ? "bg-white text-slate-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  {LOB_DENSITY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z)"
              className="apple-glass-btn h-8 px-2.5 py-0 text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Y)"
              className="apple-glass-btn h-8 px-2.5 py-0 text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
            >
              ↷
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClearMenu((v) => !v)}
                title="Limpar células, preliminares ou grade LOB (reversível com Ctrl+Z)"
                className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              >
                🧹 Limpar
              </button>
              {showClearMenu && (
                <div className="absolute right-0 top-9 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleClearLob("SELECTED")}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Limpar Células Selecionadas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearLob("PRELIMINARY")}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer dark:text-amber-300 dark:hover:bg-amber-950/40"
                  >
                    Limpar Somente Preliminares (Est.)
                  </button>
                  {!confirmClearAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      Limpar Toda a Grade LOB
                    </button>
                  ) : (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 dark:border-rose-900/60 dark:bg-rose-950/40 space-y-1.5">
                      <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                        Esvaziar todas as alocações do calendário? (Reversível com Ctrl+Z)
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleClearLob("ALL")}
                          className="flex-1 rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700 cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearAll(false)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {fullMode && (
              <button
                type="button"
                onClick={() => setLegendOpenFullscreen((v) => !v)}
                className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                🎨 {legendOpenFullscreen ? "Fechar Legenda" : `Legenda (${packageChips.length})`}
              </button>
            )}

            <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white/75 px-2 py-1 backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/70">
              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                Deslocar:
              </span>
              <input
                type="number"
                min="1"
                max="180"
                value={shiftDaysInput}
                onChange={(e) => setShiftDaysInput(e.target.value)}
                className="h-6 w-11 rounded border border-zinc-200 bg-transparent px-1 text-center font-mono text-[11px] tabular-nums text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => handleShiftInterval(-1)}
                className="h-6 rounded-lg bg-zinc-100/90 px-1.5 text-[10px] font-semibold text-zinc-800 hover:bg-zinc-200/90 cursor-pointer dark:bg-zinc-800 dark:text-zinc-200"
              >
                -d.u.
              </button>
              <button
                type="button"
                onClick={() => handleShiftInterval(1)}
                className="h-6 rounded-lg bg-zinc-100/90 px-1.5 text-[10px] font-semibold text-zinc-800 hover:bg-zinc-200/90 cursor-pointer dark:bg-zinc-800 dark:text-zinc-200"
              >
                +d.u.
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveMatrix()}
              disabled={saving}
              className={`h-8 rounded-xl px-3.5 text-[11px] font-semibold text-white transition-all duration-150 active:scale-[0.985] cursor-pointer ${
                dirty
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                  : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950"
              }`}
            >
              {saving ? "Salvando..." : dirty ? "💾 Salvar Matriz*" : "💾 Matriz Salva"}
            </button>

            {!fullMode && (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="apple-glass-btn h-8 px-3 py-0 text-[11px] font-semibold cursor-pointer"
              >
                ⛶ Ampliar Planilha
              </button>
            )}
          </div>
        </div>

        {/* Seletor Rápido de Equipe Ativa (A, B, C...) + Resumo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Equipe Ativa:
            </span>
            {(workTeams.length > 0
              ? workTeams
              : [{ id: "A", teamCode: "A", name: "Equipe A", workers: [], maxDailyHours: 8, maxSimultaneousFronts: 2 }]
            ).map((team) => {
              const active = team.teamCode.toUpperCase() === activeTeamCode.toUpperCase();
              return (
                <button
                  key={team.teamCode}
                  type="button"
                  onClick={() => setActiveTeamCode(team.teamCode.toUpperCase())}
                  className={`h-7 rounded-lg px-2.5 text-[11px] font-bold transition cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white shadow-xs dark:bg-amber-500 dark:text-zinc-950"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {team.teamCode} · {team.name.split("—")[0].trim()}
                </button>
              );
            })}
            {activeTeam && (
              <span className="ml-1 text-[11px] text-slate-600 dark:text-zinc-400">
                ({activeTeam.workers.reduce((s, w) => s + w.headcount, 0)} trab. · máx.{" "}
                {activeTeam.maxDailyHours}h/dia · {activeTeam.maxSimultaneousFronts} frente(s))
              </span>
            )}
          </div>

          <div className="text-[10px] text-slate-500 dark:text-zinc-400">
            Digite <kbd className="rounded border px-1">A1</kbd>,{" "}
            <kbd className="rounded border px-1">B4</kbd> ou{" "}
            <kbd className="rounded border px-1">A5, B15</kbd> · Clique direito no FDS para{" "}
            <strong>Hora Extra</strong>
          </div>
        </div>

        {/* Painel de Legenda Funcional de Pacotes (Agrupado por Fase) — flutuante sobreposto em tela cheia quando aberto */}
        {(!fullMode || legendOpenFullscreen) && (
        <div
          className={`space-y-2 pt-2.5 pb-1 dark:border-zinc-800 ${
            fullMode
              ? "absolute top-14 left-4 right-4 z-40 max-h-[55dvh] overflow-y-auto shadow-2xl backdrop-blur-xl rounded-2xl border border-slate-200/90 bg-white/95 p-3 dark:border-zinc-700 dark:bg-zinc-900/95"
              : "border-t border-slate-200/80"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                Legenda de Pacotes ({packageChips.length})
              </span>
              <input
                type="text"
                value={legendSearch}
                onChange={(e) => setLegendSearch(e.target.value)}
                placeholder="Buscar nº ou nome do pacote..."
                className="h-7 w-52 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {legendSearch && (
                <button
                  type="button"
                  onClick={() => setLegendSearch("")}
                  className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Limpar
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setLegendExpanded((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {legendExpanded || legendSearch.trim().length > 0
                ? "Modo Compacto"
                : `Expandir Todas (${legendPhaseGroups.length} fases)`}
            </button>
            {fullMode && (
              <button
                type="button"
                onClick={() => setLegendOpenFullscreen(false)}
                className="h-7 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                Fechar
              </button>
            )}
          </div>

          <div
            className={`grid gap-2 ${
              legendExpanded || legendSearch.trim().length > 0
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                : "grid-cols-1 md:grid-cols-2"
            }`}
          >
            {(legendExpanded || legendSearch.trim().length > 0
              ? legendPhaseGroups
              : legendPhaseGroups.filter(
                  (grp) =>
                    grp.items.some((i) => i.packageNumber === activePackageNumber) ||
                    grp.phaseOrder <= 2
                )
            ).map((group) => (
              <div
                key={group.phaseOrder}
                className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  <span>{group.phaseTitle}</span>
                  <span>{group.items.length} pct</span>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const isActive = item.packageNumber === activePackageNumber;
                    return (
                      <button
                        key={item.packageNumber}
                        type="button"
                        onClick={() => setActivePackageNumber(item.packageNumber)}
                        title={`Selecionar Pacote ${String(item.packageNumber).padStart(2, "0")} — ${item.name} (Eq. ${item.defaultTeam} · ${item.durationDays}d) e destacar no calendário`}
                        className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left transition cursor-pointer ${
                          isActive
                            ? "border-slate-900 bg-white shadow-xs ring-1 ring-slate-900 dark:border-amber-400 dark:bg-zinc-900 dark:ring-amber-400"
                            : "border-slate-200/80 bg-white/90 hover:border-slate-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            style={{ backgroundColor: item.corHex, color: item.textHex }}
                            className="inline-flex h-5 min-w-[24px] shrink-0 items-center justify-center rounded px-1 font-mono text-[10px] font-extrabold"
                          >
                            {String(item.packageNumber).padStart(2, "0")}
                          </span>
                          <span className="text-[10px] font-semibold leading-tight text-slate-800 dark:text-zinc-100">
                            {item.name}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                          {item.defaultTeam}·{item.durationDays}d
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Painel Sincronizado Fase 10: Prazos, Validação, Nivelamento & Equipes */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span>
              Previsão Término:{" "}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                {analysis.endDate || "—"}
              </strong>
            </span>
            <span>
              Prazo Total:{" "}
              <strong className="font-mono text-slate-900 dark:text-zinc-100">
                {analysis.totalWorkingDays} d.u. · {analysis.totalCalendarDays} d.c.
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowConflictsDrawer((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer ${
                analysis.isValid && analysis.conflicts.length === 0
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
              }`}
            >
              {analysis.isValid && analysis.conflicts.length === 0
                ? "✓ 100% Validado — Sem Conflitos"
                : `⚠ ${analysis.conflicts.length} alerta(s) de validação`}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={preserveLockedOnGenerate ? "PRESERVE" : "REGENERATE"}
              onChange={(e) => setPreserveLockedOnGenerate(e.target.value === "PRESERVE")}
              className="h-7 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="PRESERVE">Manter células travadas/manuais</option>
              <option value="REGENERATE">Regerar matriz completa</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                setFillingPreliminary(true);
                setFeedback(null);
                try {
                  const res = await fetch(`/api/eap/projects/${projectId}/preliminary-fill`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      startDate: timelineStart,
                      overwritePreliminary: false,
                    }),
                  });
                  const json = await res.json();
                  if (res.ok && json.ok) {
                    setDirty(false);
                    setFeedback({
                      type: "success",
                      text: `Preliminar 13 meses aplicado (${json.workingDaysSpan} d.u. · ${json.lobAllocationsCount} células).`,
                    });
                    await onScheduleMutated();
                  } else {
                    setFeedback({
                      type: "error",
                      text: json.error || "Erro ao gerar preliminar de 13 meses.",
                    });
                  }
                } finally {
                  setFillingPreliminary(false);
                }
              }}
              disabled={fillingPreliminary}
              className="h-7 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {fillingPreliminary ? "Gerando..." : "⚡ Preencher Preliminar (13 Meses)"}
            </button>
            <button
              type="button"
              onClick={handleGenerateIntelligentMatrix}
              className="h-7 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700 cursor-pointer"
            >
              ⚡ Gerar / Recalcular da EAP
            </button>
            <button
              type="button"
              onClick={handleAutoLevelConflicts}
              className="h-7 rounded-lg bg-amber-600 px-3 text-[11px] font-semibold text-white hover:bg-amber-700 cursor-pointer"
            >
              ⚡ Nivelar Conflitos
            </button>
          </div>
        </div>

        {/* Mini-legenda + Filtro rápido por origem no LOB */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: "Todos" },
                { id: "PRELIMINAR_PADRAO", label: "Somente Preliminares (a revisar)" },
                { id: "QUANTITATIVO_IMPORTADO", label: "Quantitativos" },
                { id: "EDITADO_USUARIO", label: "Editados" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setOriginFilter(chip.id)}
                className={`h-7 rounded-lg px-2.5 text-[10px] font-semibold cursor-pointer ${
                  originFilter === chip.id
                    ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <strong>{originCounts.prelim}</strong> preliminares
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <strong>{originCounts.imported}</strong> quantitativos
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <strong>{originCounts.edited}</strong> editados
            </span>
          </div>
        </div>

        {usedParametricBanner && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>Estimativa Paramétrica Inteligente:</strong> A EAP ainda não possui quantitativos preenchidos. O cronograma inicial foi calculado pela área construída ({builtAreaM2 && builtAreaM2 > 0 ? builtAreaM2 : 180} m²), produtividade dos pacotes e capacidade das equipes. Edite qualquer célula livremente ou preencha a EAP para recalcular.
          </div>
        )}

        {/* Resumo por Equipe (A, B, C...) */}
        {analysis.teamSummaries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-zinc-400">
            {analysis.teamSummaries.map((ts) => (
              <span
                key={ts.teamCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <strong className="font-mono text-slate-900 dark:text-zinc-100">
                  Eq. {ts.teamCode}
                </strong>
                <span>{ts.workingDays}d</span>
                <span>·</span>
                <span>{ts.headcount} trab.</span>
                <span>·</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {ts.totalEstimatedCost.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <span>({ts.occupancyPercent}%)</span>
              </span>
            ))}
          </div>
        )}

        {showConflictsDrawer && analysis.conflicts.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-[11px] space-y-1 dark:border-rose-900/60 dark:bg-rose-950/40">
            {analysis.conflicts.map((c, idx) => (
              <div
                key={`${c.type}-${idx}`}
                className={
                  c.severity === "critical"
                    ? "font-semibold text-rose-800 dark:text-rose-300"
                    : "text-amber-800 dark:text-amber-300"
                }
              >
                {c.severity === "critical" ? "⛔" : "⚠"} {c.message}
              </div>
            ))}
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* Grade Matricial Pavimentos × Datas Contínuas */}
      <div
        className={`relative w-full overflow-x-auto overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#14141B] ${
          fullMode ? "flex-1 min-h-0" : "max-h-[620px]"
        }`}
      >
        <table className="border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-slate-950 text-white">
            <tr>
              <th
                rowSpan={3}
                className="sticky left-0 z-40 w-[220px] min-w-[220px] max-w-[220px] border-b border-r border-slate-800 bg-slate-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Pavimento / Setor</span>
                  <button
                    type="button"
                    onClick={() => setShowAddFloor((v) => !v)}
                    className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-slate-700 cursor-pointer"
                  >
                    + Pavimento
                  </button>
                </div>
                {showAddFloor && (
                  <div className="mt-2 flex gap-1">
                    <input
                      value={newFloorName}
                      onChange={(e) => setNewFloorName(e.target.value)}
                      placeholder="Ex.: Subsolo"
                      className="h-7 w-full rounded border border-slate-700 bg-slate-900 px-2 text-[11px] font-normal text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddFloor}
                      className="h-7 rounded bg-emerald-600 px-2 text-[10px] font-bold text-white cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                )}
              </th>
              {timeline.topGroups.map((grp) => (
                <th
                  key={grp.key}
                  colSpan={grp.count}
                  className="border-b border-r border-slate-800 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-200"
                >
                  {grp.label}
                </th>
              ))}
            </tr>
            <tr>
              {timeline.columns.map((col) => (
                <th
                  key={`dow-${col.key}`}
                  className={`border-b border-r border-slate-800 px-1 py-0.5 text-center text-[9px] font-bold ${LOB_DENSITY_HEADER_WIDTH[density]} ${
                    col.isHoliday
                      ? "bg-slate-700 text-amber-300"
                      : col.isWeekend
                        ? "bg-stone-700/80 text-stone-200"
                        : "bg-slate-900 text-slate-300"
                  }`}
                >
                  {col.weekdayInitial}
                </th>
              ))}
            </tr>
            <tr>
              {timeline.columns.map((col) => (
                <th
                  key={`dt-${col.key}`}
                  title={col.holidayName || (col.isWeekend ? "Fim de semana (sem trabalho)" : col.startIso)}
                  className={`border-b border-r border-slate-800 px-1 py-1 text-center font-mono text-[9px] font-semibold tabular-nums ${LOB_DENSITY_HEADER_WIDTH[density]} ${
                    col.isHoliday
                      ? "bg-slate-700 text-amber-200"
                      : col.isWeekend
                        ? "bg-stone-700/80 text-stone-300"
                        : "bg-slate-900 text-slate-100"
                  }`}
                >
                  {col.dateShort}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800">
            {matrix.floors.map((floor, floorIndex) => {
              const lanes = floorLanesMap.get(floor.floorId) ?? [new Set<string>()];
              return lanes.map((laneTokens, laneIdx) => (
                <tr key={`${floor.floorId}-lane-${laneIdx}`} className="group">
                  {laneIdx === 0 && (
                    <td
                      rowSpan={lanes.length}
                      className="sticky left-0 z-30 w-[220px] min-w-[220px] max-w-[220px] border-r border-slate-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-slate-900 align-middle shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      {editingFloorId === floor.floorId ? (
                        <input
                          autoFocus
                          value={editingFloorDraft}
                          onChange={(e) => setEditingFloorDraft(e.target.value)}
                          onBlur={() => handleRenameFloor(floor.floorId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameFloor(floor.floorId);
                            if (e.key === "Escape") setEditingFloorId(null);
                          }}
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      ) : (
                        <div
                          onDoubleClick={() => {
                            setEditingFloorId(floor.floorId);
                            setEditingFloorDraft(floor.floorName);
                          }}
                          title="Duplo clique para renomear pavimento"
                          className="flex items-center justify-between gap-2 cursor-text"
                        >
                          <span>{floor.floorName}</span>
                          <div className="flex items-center gap-1">
                            {lanes.length > 1 && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {lanes.length} pistas
                              </span>
                            )}
                            <Badge tone="neutral">{floorIndex + 1}</Badge>
                          </div>
                        </div>
                      )}
                    </td>
                  )}

                  {timeline.columns.map((col, colIndex) => {
                    const isSelected =
                      selectedCell?.floorIndex === floorIndex &&
                      selectedCell?.colIndex === colIndex;
                    const isEditing =
                      editingCell?.floorIndex === floorIndex &&
                      editingCell?.colIndex === colIndex;
                    const isDragHighlighted =
                      dragFillStart !== null &&
                      dragFillStart.floorIndex === floorIndex &&
                      dragFillHoverCol !== null &&
                      colIndex >= dragFillStart.colIndex &&
                      colIndex <= dragFillHoverCol;

                    const allFloorCellItems = getCellDisplayItems(floor.floorId, col.allDatesIso);
                    const cellItems =
                      lanes.length === 1
                        ? allFloorCellItems
                        : allFloorCellItems.filter((it) =>
                            laneTokens.has(`${it.teamCode}${it.packageNumber}`)
                          );
                    const hasOvertime = cellItems.some((i) => i.isOvertime);
                    const cellConstraintAlerts = cellItems
                      .map((i) => constraintBlocks[`${floor.floorId}::${i.packageNumber}`])
                      .filter(Boolean);
                    const hasConstraintBlock = cellConstraintAlerts.length > 0;
                    const hasCriticalBlock = cellConstraintAlerts.some((b) => b.criticalCount > 0);
                    const hasConflict = col.allDatesIso.some((d) =>
                      conflictCellSet.has(`${floor.floorId}::${d}`)
                    );

                    const tooltipText =
                      cellItems.length > 0
                        ? cellItems
                            .map((i) => {
                              const pkg = resolvePackageVisual(i.packageNumber);
                              const team = teamByCode.get(i.teamCode.toUpperCase());
                              const workersStr = team
                                ? team.workers.map((w) => `${w.headcount} ${w.roleName}`).join(", ")
                                : `Equipe ${i.teamCode}`;
                              return `${floor.floorName} • ${col.label} • Equipe ${i.teamCode} (${workersStr}) • Pacote ${pkg.packageNumber} (${pkg.name} — ${pkg.discipline})${i.isOvertime ? " [HORA EXTRA]" : ""}`;
                            })
                            .join("\n")
                        : `${floor.floorName} • ${col.label}${col.holidayName ? ` • Feriado: ${col.holidayName}` : col.isWeekend ? " • Fim de semana (clique direito para Hora Extra)" : ""}`;

                    return (
                      <td
                        key={`${floor.floorId}-${laneIdx}-${col.key}`}
                        title={tooltipText}
                        onClick={() => {
                          setSelectedCell({ floorIndex, colIndex });
                          setEditingCell(null);
                        }}
                        onDoubleClick={() => {
                          setSelectedCell({ floorIndex, colIndex });
                          setEditingCell({ floorIndex, colIndex });
                          setEditingText(
                            allFloorCellItems.map((i) => `${i.teamCode}${i.packageNumber}`).join(", ")
                          );
                        }}
                        onContextMenu={(e: MouseEvent<HTMLTableCellElement>) => {
                          if (col.isNonWorking) {
                            e.preventDefault();
                            toggleOvertimeOnCell(floorIndex, colIndex);
                          }
                        }}
                        onMouseEnter={() => {
                          if (dragFillStart && dragFillStart.floorIndex === floorIndex) {
                            setDragFillHoverCol(colIndex);
                          }
                        }}
                        className={`relative border-r border-slate-200/80 p-0.5 text-center align-middle transition select-none dark:border-zinc-800 ${
                          LOB_DENSITY_CELL[density]
                        } ${
                          col.isHoliday
                            ? "bg-zinc-500/85 text-white dark:bg-zinc-700/90"
                            : col.isWeekend
                              ? "bg-stone-200/75 dark:bg-zinc-800/75"
                              : "bg-white dark:bg-[#14141B]"
                        } ${
                          hasConflict
                            ? "ring-2 ring-inset ring-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                            : isSelected && laneIdx === 0
                              ? "ring-2 ring-inset ring-blue-600 dark:ring-amber-400"
                              : ""
                        } ${
                          isDragHighlighted && laneIdx === 0
                            ? "bg-blue-100/70 dark:bg-amber-950/40"
                            : ""
                        }`}
                      >
                        {isEditing && laneIdx === 0 ? (
                          <input
                            ref={inputRef}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => commitCellText(floorIndex, colIndex, editingText)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                commitCellText(floorIndex, colIndex, editingText);
                                setSelectedCell({
                                  floorIndex,
                                  colIndex: Math.min(timeline.columns.length - 1, colIndex + 1),
                                });
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingCell(null);
                              }
                            }}
                            className="h-full w-full rounded bg-white px-1 text-center font-mono text-[10px] font-bold uppercase text-slate-950 outline-none dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        ) : cellItems.length > 0 ? (
                          <div className="flex flex-wrap items-center justify-center gap-0.5">
                            {cellItems.map((it) => {
                              const pkg = resolvePackageVisual(it.packageNumber);
                              const blk = constraintBlocks[`${floor.floorId}::${it.packageNumber}`];
                              const org = normalizeDataOrigin(it.dataOrigin);
                              const orgMeta = DATA_ORIGIN_META[org];
                              const dimmedByOrigin =
                                originFilter !== "ALL" && org !== originFilter;
                              const isHighlightedPkg =
                                it.packageNumber === activePackageNumber;
                              return (
                                <span
                                  key={`${it.teamCode}-${it.packageNumber}`}
                                  style={{ backgroundColor: pkg.corHex, color: pkg.textHex }}
                                  title={
                                    blk
                                      ? `Restrições pendentes: ${blk.titles.join(" | ")} • ${orgMeta.tooltip}`
                                      : `${orgMeta.label} (${orgMeta.shortBadge}) — ${orgMeta.tooltip}`
                                  }
                                  className={`relative inline-flex items-center justify-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-extrabold leading-none shadow-2xs transition ${
                                    blk?.criticalCount
                                      ? "ring-1 ring-rose-400"
                                      : isHighlightedPkg
                                        ? "ring-2 ring-slate-950 dark:ring-white scale-[1.04]"
                                        : org === "PRELIMINAR_PADRAO"
                                          ? "ring-1 ring-amber-300/80"
                                          : ""
                                  } ${dimmedByOrigin ? "opacity-25" : ""}`}
                                >
                                  {it.teamCode}
                                  {it.packageNumber}
                                  <span
                                    className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
                                      org === "PRELIMINAR_PADRAO"
                                        ? "bg-amber-300"
                                        : org === "QUANTITATIVO_IMPORTADO"
                                          ? "bg-sky-300"
                                          : "bg-emerald-300"
                                    }`}
                                  />
                                  {blk ? (
                                    <span
                                      className={
                                        blk.criticalCount > 0
                                          ? "text-rose-200"
                                          : "text-amber-200"
                                      }
                                    >
                                      ⚠
                                    </span>
                                  ) : null}
                                </span>
                              );
                            })}
                            {hasConstraintBlock && hasCriticalBlock && (
                              <span className="sr-only">Restrição crítica pendente</span>
                            )}
                            {hasOvertime && (
                              <span
                                title="Hora extra autorizada"
                                className="text-[8px] font-bold text-amber-600 dark:text-amber-300"
                              >
                                ★
                              </span>
                            )}
                          </div>
                        ) : col.isHoliday ? (
                          <span className="font-mono text-[10px] font-bold text-white/90">-</span>
                        ) : col.isWeekend ? (
                          <span className="text-[9px] text-slate-400 dark:text-zinc-500">·</span>
                        ) : null}

                        {isSelected && laneIdx === 0 && !isEditing && (
                          <button
                            type="button"
                            aria-label="Arrastar para preencher dias úteis"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDragFillStart({ floorIndex, colIndex });
                              setDragFillHoverCol(colIndex);
                            }}
                            className="absolute right-0 bottom-0 h-2 w-2 cursor-crosshair bg-blue-600 dark:bg-amber-400"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>

          {/* Rodapé Calendário Espelhado */}
          <tfoot className="sticky bottom-0 z-20 bg-slate-950 text-white">
            <tr>
              <th
                rowSpan={3}
                className="sticky left-0 z-40 w-[220px] min-w-[220px] max-w-[220px] border-t border-r border-slate-800 bg-slate-950 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
              >
                Calendário Espelhado
              </th>
              {timeline.columns.map((col) => (
                <th
                  key={`ft-dt-${col.key}`}
                  className={`border-t border-r border-slate-800 px-1 py-1 text-center font-mono text-[9px] ${
                    col.isHoliday
                      ? "bg-slate-700 text-amber-200"
                      : col.isWeekend
                        ? "bg-stone-700/80 text-stone-300"
                        : "bg-slate-900 text-slate-200"
                  }`}
                >
                  {col.dateShort}
                </th>
              ))}
            </tr>
            <tr>
              {timeline.columns.map((col) => (
                <th
                  key={`ft-dow-${col.key}`}
                  className={`border-t border-r border-slate-800 px-1 py-0.5 text-center text-[9px] font-bold ${
                    col.isHoliday
                      ? "bg-slate-700 text-amber-300"
                      : col.weekdayInitial === "D"
                        ? "bg-rose-950/70 text-rose-300"
                        : col.isWeekend
                          ? "bg-stone-700/80 text-stone-200"
                          : "bg-slate-900 text-slate-300"
                  }`}
                >
                  {col.weekdayInitial}
                </th>
              ))}
            </tr>
            <tr>
              {timeline.topGroups.map((grp) => (
                <th
                  key={`ft-grp-${grp.key}`}
                  colSpan={grp.count}
                  className="border-t border-r border-slate-800 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-200"
                >
                  {grp.label}
                </th>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {renderMatrixContent(false)}

      <EapFullscreenShell
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title="ArqVértice OS — Matriz LOB (Pavimentos × Datas Contínuas)"
        subtitle="Finais de semana sombreados · Células Equipe+Pacote (A1, B3) · Ctrl+Z / Ctrl+Y"
      >
        {renderMatrixContent(true)}
      </EapFullscreenShell>
    </>
  );
}
