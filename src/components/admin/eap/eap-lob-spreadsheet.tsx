"use client";

import {
  memo,
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
import { useHistoryStack } from "@/lib/history-stack";
import {
  analyzeLobConflicts,
  autoLevelConflictingPackages,
  buildLobTimeline,
  getLobPackageMeta,
  scaleUnitsToWorkingDays,
  segmentsToWorkingDaySet,
  shiftSchedulePackages,
  workingDaySetToSegments,
  type LobConflictAnalysis,
  type LobPackageLike,
  type LobSegmentLike,
  type LobTimelineColumn,
  type LobTimeScale,
} from "@/lib/eap-lob-grid";

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
  plannedStartDate: string | null;
  analyticsStartDate: string | null;
  analyticsEndDate: string | null;
  zones: ZoneDTO[];
  holidays: HolidayDTO[];
  packages: LobPackageLike[];
  onScheduleMutated: () => Promise<void> | void;
  onOpenSegmentModal: (pkg: LobPackageLike, seg: LobSegmentLike) => void;
}

interface CellAddress {
  zoneCode: string;
  packageId: string;
  packageNumber: number;
  rowIndex: number;
  colIndex: number;
}

interface ActiveSelection {
  zoneCode: string;
  packageId: string;
  packageNumber: number;
  rowIndex: number;
  anchorCol: number;
  focusCol: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  zoneCode: string;
  packageId: string;
  packageNumber: number;
  colIndex: number;
}

interface LobPackageRowProps {
  zoneCode: string;
  pkg: LobPackageLike;
  rowIndex: number;
  columns: LobTimelineColumn[];
  cellSizeClass: string;
  holidaySet: Set<string>;
  overloadedDaysSet: Set<string>;
  hasPrecedenceConflict: boolean;
  precedenceTooltip: string | null;
  selectedColMin: number | null;
  selectedColMax: number | null;
  activeColIndex: number | null;
  editingText: string | null;
  isSelectedPackage: boolean;
  onSelectCell: (addr: CellAddress, opts?: { extendRange?: boolean; startEdit?: boolean }) => void;
  onStartDragFill: (addr: CellAddress) => void;
  onHoverFill: (rowIndex: number, colIndex: number) => void;
  onContextMenuCell: (e: MouseEvent<HTMLTableCellElement>, addr: CellAddress) => void;
  onEditChange: (val: string) => void;
  onCommitEdit: (addr: CellAddress, raw: string, move?: "left" | "right" | "up" | "down") => void;
  onCancelEdit: () => void;
  onCellKeyDown: (e: KeyboardEvent<HTMLTableCellElement>, addr: CellAddress) => void;
  onLevelPackage: (packageNumber: number) => void;
  onOpenSegment: (pkg: LobPackageLike, seg: LobSegmentLike) => void;
}

type LobDensity = "COMPACTO" | "PADRAO" | "CONFORTAVEL";

const SCALE_LABELS: Record<LobTimeScale, string> = {
  DIARIO: "Diário",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  ANUAL: "Anual",
};

const LOB_DENSITY_CELL: Record<LobDensity, string> = {
  COMPACTO: "h-5 min-w-[20px] text-[8px]",
  PADRAO: "h-6 min-w-[26px] text-[9px]",
  CONFORTAVEL: "h-8 min-w-[34px] text-[10px]",
};

const LOB_DENSITY_DAILY_COL: Record<LobDensity, string> = {
  COMPACTO: "min-w-[20px]",
  PADRAO: "min-w-[26px]",
  CONFORTAVEL: "min-w-[34px]",
};

const LOB_DENSITY_LABELS: Record<LobDensity, string> = {
  COMPACTO: "Compacto",
  PADRAO: "Padrão",
  CONFORTAVEL: "Confortável",
};

const LobPackageRow = memo(function LobPackageRow({
  zoneCode,
  pkg,
  rowIndex,
  columns,
  cellSizeClass,
  holidaySet,
  overloadedDaysSet,
  hasPrecedenceConflict,
  precedenceTooltip,
  selectedColMin,
  selectedColMax,
  activeColIndex,
  editingText,
  isSelectedPackage,
  onSelectCell,
  onStartDragFill,
  onHoverFill,
  onContextMenuCell,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onCellKeyDown,
  onLevelPackage,
  onOpenSegment,
}: LobPackageRowProps) {
  const zoneSegments = useMemo(
    () => pkg.segments.filter((s) => s.zoneCode === zoneCode),
    [pkg.segments, zoneCode]
  );

  const activeDays = useMemo(
    () => segmentsToWorkingDaySet(zoneSegments, holidaySet),
    [zoneSegments, holidaySet]
  );

  const meta = useMemo(() => getLobPackageMeta(pkg.packageNumber, pkg), [pkg]);
  const zoneWorkingDays = activeDays.size;

  return (
    <tr
      className={`border-b border-slate-100 dark:border-zinc-800/80 ${
        isSelectedPackage ? "bg-blue-50/30 dark:bg-amber-950/10" : "hover:bg-slate-50/70 dark:hover:bg-zinc-900/40"
      }`}
    >
      <td
        className={`sticky left-0 z-10 min-w-[260px] max-w-[260px] border-r border-slate-200 px-2.5 py-1 dark:border-zinc-800 ${
          hasPrecedenceConflict
            ? "bg-rose-50 dark:bg-rose-950/40"
            : isSelectedPackage
              ? "bg-blue-50 dark:bg-zinc-900"
              : "bg-white dark:bg-[#16161D]"
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => {
              const firstSeg = zoneSegments[0];
              if (firstSeg) {
                onOpenSegment(pkg, firstSeg);
              } else {
                const firstEditable = Math.max(
                  0,
                  columns.findIndex((c) => c.editable)
                );
                onSelectCell({
                  zoneCode,
                  packageId: pkg.id,
                  packageNumber: pkg.packageNumber,
                  rowIndex,
                  colIndex: firstEditable,
                });
              }
            }}
            title={
              precedenceTooltip
                ? `${pkg.name}\n⚠ ${precedenceTooltip}`
                : `${pkg.name} · ${pkg.teamsCount} eq. · Predecessoras: ${
                    pkg.predecessorNumbers.length > 0 ? pkg.predecessorNumbers.join(", ") : "nenhuma"
                  }`
            }
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-pointer"
          >
            <span
              style={{ backgroundColor: meta.corHex, color: meta.textHex }}
              className="inline-flex h-4 w-5 shrink-0 items-center justify-center rounded font-mono text-[9px] font-bold"
            >
              {pkg.packageNumber}
            </span>
            <span className="truncate text-[10px] font-semibold text-slate-900 dark:text-zinc-100">
              {pkg.name}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {hasPrecedenceConflict && (
              <button
                type="button"
                onClick={() => onLevelPackage(pkg.packageNumber)}
                title={`${precedenceTooltip ?? "Conflito de sequência/equipe"}\nClique para nivelar este pacote automaticamente`}
                className="rounded bg-rose-600 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                ⚠ Nivelar
              </button>
            )}
            <span
              title={`${pkg.teamsCount} equipe(s) · ${zoneWorkingDays} dias úteis nesta zona`}
              className="font-mono text-[9px] font-semibold text-slate-500 dark:text-zinc-400"
            >
              {pkg.teamsCount}eq·{zoneWorkingDays}d
            </span>
          </div>
        </div>
      </td>

      {columns.map((col, colIndex) => {
        if (!col.editable || col.isHoliday) {
          return (
            <td
              key={`${pkg.id}-${zoneCode}-${col.key}`}
              title={col.holidayName ? `Feriado: ${col.holidayName} (${col.label})` : `${col.label} (não editável)`}
              className={`${cellSizeClass} select-none border-r border-slate-300 bg-slate-400/60 text-center font-mono font-bold text-slate-800 dark:border-zinc-700 dark:bg-zinc-600/80 dark:text-zinc-100`}
            >
              -
            </td>
          );
        }

        const activeCountInCol = col.workingDaysIso.reduce(
          (acc, d) => (activeDays.has(d) ? acc + 1 : acc),
          0
        );
        const isCellActive = activeCountInCol > 0;
        const isPartialInCol =
          isCellActive && activeCountInCol < col.workingDaysIso.length && col.workingDaysIso.length > 1;
        const hasTeamOverloadInCol =
          isCellActive && col.workingDaysIso.some((d) => activeDays.has(d) && overloadedDaysSet.has(d));

        const isInRange =
          selectedColMin !== null &&
          selectedColMax !== null &&
          colIndex >= selectedColMin &&
          colIndex <= selectedColMax;
        const isFocusedCell = activeColIndex === colIndex;
        const isEditingThisCell = isFocusedCell && editingText !== null;

        // Cor dinâmica enquanto digita um número de pacote na célula
        let bgStyle: { backgroundColor?: string; color?: string } = {};
        if (isEditingThisCell) {
          const typedNum = Number(editingText.trim());
          if (Number.isInteger(typedNum) && typedNum > 0) {
            const liveMeta = getLobPackageMeta(typedNum);
            bgStyle = { backgroundColor: liveMeta.corHex, color: liveMeta.textHex };
          }
        } else if (isCellActive) {
          bgStyle = { backgroundColor: meta.corHex, color: meta.textHex };
        }

        const addr: CellAddress = {
          zoneCode,
          packageId: pkg.id,
          packageNumber: pkg.packageNumber,
          rowIndex,
          colIndex,
        };

        return (
          <td
            key={`${pkg.id}-${zoneCode}-${col.key}`}
            tabIndex={0}
            data-lob-cell={`${rowIndex}:${colIndex}`}
            style={bgStyle}
            onClick={(e) =>
              onSelectCell(addr, { extendRange: e.shiftKey, startEdit: isFocusedCell })
            }
            onDoubleClick={() => onSelectCell(addr, { startEdit: true })}
            onMouseEnter={(e) => {
              if (e.buttons === 1) {
                onHoverFill(rowIndex, colIndex);
              }
            }}
            onContextMenu={(e) => onContextMenuCell(e, addr)}
            onKeyDown={(e) => onCellKeyDown(e, addr)}
            title={
              isCellActive
                ? `PCT ${String(pkg.packageNumber).padStart(2, "0")} — ${pkg.name} (${col.label})\n${activeCountInCol}/${col.workingDaysIso.length} d.u. · ${pkg.teamsCount} eq.${
                    hasTeamOverloadInCol ? "\n⚠ Excesso de equipe nesta coluna!" : ""
                  }${hasPrecedenceConflict ? `\n⚠ ${precedenceTooltip}` : ""}`
                : `${col.label} — Clique e digite ${pkg.packageNumber} (ou outro pacote)`
            }
            className={`relative ${cellSizeClass} select-none border-r text-center font-mono font-extrabold outline-none cursor-cell ${
              hasTeamOverloadInCol || (isCellActive && hasPrecedenceConflict)
                ? "ring-2 ring-inset ring-rose-500 border-rose-400"
                : isFocusedCell
                  ? "ring-2 ring-inset ring-slate-950 dark:ring-amber-300 border-slate-300"
                  : isInRange
                    ? "ring-1 ring-inset ring-blue-500 bg-blue-100/60 dark:bg-blue-900/30 border-slate-200 dark:border-zinc-800"
                    : "border-slate-200/70 dark:border-zinc-800/70"
            }`}
          >
            {isEditingThisCell ? (
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={editingText}
                onChange={(e) => onEditChange(e.target.value)}
                onBlur={() => onCommitEdit(addr, editingText)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelEdit();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    onCommitEdit(addr, editingText, e.shiftKey ? "up" : "down");
                  } else if (e.key === "Tab") {
                    e.preventDefault();
                    onCommitEdit(addr, editingText, e.shiftKey ? "left" : "right");
                  }
                }}
                style={bgStyle}
                className="h-full w-full border-0 bg-transparent p-0 text-center font-mono text-[10px] font-extrabold focus:outline-none"
              />
            ) : isCellActive ? (
              <span className={isPartialInCol ? "opacity-80" : ""}>{pkg.packageNumber}</span>
            ) : null}

            {/* Alça de preenchimento horizontal (■) */}
            {isFocusedCell && !isEditingThisCell && (
              <span
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStartDragFill(addr);
                }}
                title="Arraste horizontalmente para preencher ou limpar"
                className="absolute -bottom-0.5 -right-0.5 z-20 h-2 w-2 cursor-crosshair border border-white bg-blue-600 dark:bg-amber-400"
              />
            )}
          </td>
        );
      })}
    </tr>
  );
});

export function EapLobSpreadsheet({
  projectId,
  plannedStartDate,
  analyticsStartDate,
  analyticsEndDate,
  zones,
  holidays,
  packages,
  onScheduleMutated,
  onOpenSegmentModal,
}: EapLobSpreadsheetProps) {
  const [localPackages, setLocalPackages] = useState<LobPackageLike[]>(packages);
  const [scale, setScale] = useState<LobTimeScale>("DIARIO");
  const [density, setDensity] = useState<LobDensity>("PADRAO");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [packageSearch, setPackageSearch] = useState<string>("");
  const [maxTeamsLimit, setMaxTeamsLimit] = useState<number>(6);
  const [shiftUnitsInput, setShiftUnitsInput] = useState<string>("1");
  const [cascadeDependents, setCascadeDependents] = useState<boolean>(true);
  const [expandedAllInZone, setExpandedAllInZone] = useState<Record<string, boolean>>({});
  const [showLegend, setShowLegend] = useState(false);
  const history = useHistoryStack<LobPackageLike[]>(40);

  const [selection, setSelection] = useState<ActiveSelection | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [dragFillOrigin, setDragFillOrigin] = useState<CellAddress | null>(null);
  const [clipboardCells, setClipboardCells] = useState<boolean[] | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [syncState, setSyncState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [dirtyPkgIds, setDirtyPkgIds] = useState<string[]>([]);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const dirtySetRef = useRef<Set<string>>(new Set());
  const localPackagesRef = useRef<LobPackageLike[]>(localPackages);
  localPackagesRef.current = localPackages;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega limite de equipes salvo por projeto
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`arqvertice_lob_max_teams_${projectId}`);
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 50) {
          setMaxTeamsLimit(parsed);
        }
      }
    } catch {
      // ignora
    }
  }, [projectId]);

  useEffect(() => {
    if (dirtySetRef.current.size === 0) {
      setLocalPackages(packages);
    }
  }, [packages]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    const stopDrag = () => setDragFillOrigin(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("mouseup", stopDrag);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => h.date.slice(0, 10))),
    [holidays]
  );

  // Calcula janela global abrangendo todos os trechos locais + margem para pintura/deslocamento
  const timelineBounds = useMemo(() => {
    let minStart = analyticsStartDate || plannedStartDate || "2026-04-01";
    let maxEnd = analyticsEndDate || minStart;
    for (const pkg of localPackages) {
      for (const seg of pkg.segments) {
        if (seg.startDate < minStart) minStart = seg.startDate;
        if (seg.endDate > maxEnd) maxEnd = seg.endDate;
      }
    }
    return { minStart, maxEnd };
  }, [localPackages, analyticsStartDate, analyticsEndDate, plannedStartDate]);

  const timeline = useMemo(
    () =>
      buildLobTimeline({
        scale,
        startDate: timelineBounds.minStart,
        endDate: timelineBounds.maxEnd,
        holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
        trailingWorkingDays: scale === "DIARIO" ? 15 : 30,
      }),
    [scale, timelineBounds, holidays]
  );

  const conflicts: LobConflictAnalysis = useMemo(
    () =>
      analyzeLobConflicts({
        packages: localPackages,
        holidaySet,
        maxTeamsLimit,
      }),
    [localPackages, holidaySet, maxTeamsLimit]
  );

  const overloadedDaysSet = useMemo(
    () => new Set(conflicts.overloadedDays.map((d) => d.iso)),
    [conflicts.overloadedDays]
  );

  const precedenceByPackageNum = useMemo(() => {
    const map = new Map<number, string>();
    for (const v of conflicts.precedenceViolations) {
      const msg = `Inicia em ${v.packageStartDate} antes do término do PCT ${String(v.predecessorNumber).padStart(2, "0")} (${v.predecessorEndDate})`;
      const prev = map.get(v.packageNumber);
      map.set(v.packageNumber, prev ? `${prev}; ${msg}` : msg);
    }
    return map;
  }, [conflicts.precedenceViolations]);

  // Carga máxima de equipes por coluna visível
  const columnMaxTeams = useMemo(
    () =>
      timeline.columns.map((col) => {
        if (!col.editable || col.workingDaysIso.length === 0) return 0;
        let peak = 0;
        for (const d of col.workingDaysIso) {
          const val = conflicts.teamsByDay[d] ?? 0;
          if (val > peak) peak = val;
        }
        return peak;
      }),
    [timeline.columns, conflicts.teamsByDay]
  );

  // Monta linhas visíveis agrupadas pelas 4 Zonas (com filtro por zona e busca por pacote)
  const groupedZoneRows = useMemo(() => {
    const anySegmentOverall = localPackages.some((p) => p.segments.length > 0);
    const q = packageSearch.trim().toLowerCase();
    let runningRowIdx = 0;

    return zones
      .filter((z) => zoneFilter === "ALL" || z.code === zoneFilter)
      .map((zone) => {
        const showAll = Boolean(expandedAllInZone[zone.code]) || Boolean(q);
        const pkgsForZone = localPackages.filter((pkg) => {
          if (q && !`${pkg.packageNumber} ${pkg.name} ${pkg.waveName}`.toLowerCase().includes(q)) {
            return false;
          }
          if (showAll) return true;
          if (!anySegmentOverall && zone.code === "FUND_TERREO") return true;
          return pkg.segments.some((s) => s.zoneCode === zone.code);
        });

        const rows = pkgsForZone.map((pkg) => ({
          zoneCode: zone.code,
          pkg,
          rowIndex: runningRowIdx++,
        }));

        return { zone, rows };
      });
  }, [zones, localPackages, expandedAllInZone, zoneFilter, packageSearch]);

  const flatRows = useMemo(
    () => groupedZoneRows.flatMap((g) => g.rows),
    [groupedZoneRows]
  );

  const flushSyncToDb = useCallback(
    async (explicit = false) => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const ids = Array.from(dirtySetRef.current);
      if (ids.length === 0) {
        if (explicit) setSyncState("saved");
        return;
      }

      const pkgMap = new Map(localPackagesRef.current.map((p) => [p.id, p]));
      const updates = ids
        .map((id) => pkgMap.get(id))
        .filter((p): p is LobPackageLike => Boolean(p))
        .map((pkg) => ({
          packageId: pkg.id,
          durationWorkingDays: Math.max(1, pkg.durationWorkingDays || 1),
          teamsCount: Math.max(1, pkg.teamsCount || 1),
          segments: pkg.segments.map((s, idx) => ({
            zoneCode: s.zoneCode as "FUND_TERREO" | "PAV_SUPERIOR" | "COBERTURA" | "EXTERNO",
            segmentOrder: s.segmentOrder || idx + 1,
            startDate: s.startDate,
            endDate: s.endDate,
            workingDays: Math.max(1, s.workingDays || 1),
            parallelLane: Math.max(1, s.parallelLane || 1),
            notes: s.notes ?? null,
          })),
        }));

      if (updates.length === 0) return;

      setSyncState("saving");
      try {
        const res = await fetch(`/api/eap/projects/${projectId}/schedule/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          setSyncState("error");
          setBannerMsg({ type: "error", text: json.error || "Erro ao sincronizar cronograma." });
          return;
        }
        for (const id of ids) {
          dirtySetRef.current.delete(id);
        }
        setDirtyPkgIds(Array.from(dirtySetRef.current));
        setSyncState("saved");
        if (explicit) {
          setBannerMsg({
            type: "success",
            text: `${updates.length} pacote(s) salvo(s) no cronograma LOB.`,
          });
        }
        await onScheduleMutated();
      } catch {
        setSyncState("error");
      }
    },
    [projectId, onScheduleMutated]
  );

  const scheduleAutoSync = useCallback(
    (touchedPackageIds: string[]) => {
      for (const id of touchedPackageIds) {
        dirtySetRef.current.add(id);
      }
      setDirtyPkgIds(Array.from(dirtySetRef.current));
      setSyncState("dirty");
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        void flushSyncToDb(false);
      }, 750);
    },
    [flushSyncToDb]
  );

  const restoreHistoryPackages = useCallback(
    (restored: LobPackageLike[], current: LobPackageLike[]) => {
      const currById = new Map(current.map((p) => [p.id, p]));
      const changedIds: string[] = [];
      for (const pkg of restored) {
        const old = currById.get(pkg.id);
        if (!old || JSON.stringify(old.segments) !== JSON.stringify(pkg.segments)) {
          changedIds.push(pkg.id);
        }
      }
      setLocalPackages(restored);
      if (changedIds.length > 0) {
        scheduleAutoSync(changedIds);
      }
    },
    [scheduleAutoSync]
  );

  const handleUndoLob = useCallback(() => {
    const current = localPackagesRef.current;
    const restored = history.stepUndo(current);
    if (restored) {
      restoreHistoryPackages(restored, current);
      setBannerMsg({ type: "success", text: "Ação desfeita na grade LOB." });
    }
  }, [history, restoreHistoryPackages]);

  const handleRedoLob = useCallback(() => {
    const current = localPackagesRef.current;
    const restored = history.stepRedo(current);
    if (restored) {
      restoreHistoryPackages(restored, current);
      setBannerMsg({ type: "success", text: "Ação refeita na grade LOB." });
    }
  }, [history, restoreHistoryPackages]);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndoLob();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedoLob();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndoLob, handleRedoLob]);

  const focusCellDom = useCallback((rowIndex: number, colIndex: number) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-lob-cell="${rowIndex}:${colIndex}"]`);
      el?.focus();
    });
  }, []);

  /**
   * Aplica ativação ou remoção de dias úteis para `(zoneCode, pkg)` sobre colunas `[colStart..colEnd]`.
   */
  const applyColumnsToPackageZone = useCallback(
    (input: {
      zoneCode: string;
      packageNumber: number;
      colStart: number;
      colEnd: number;
      active: boolean;
      skipHistory?: boolean;
    }) => {
      const { zoneCode, packageNumber, colStart, colEnd, active, skipHistory } = input;
      const minC = Math.max(0, Math.min(colStart, colEnd));
      const maxC = Math.min(timeline.columns.length - 1, Math.max(colStart, colEnd));

      const targetDays: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        const col = timeline.columns[c];
        if (!col || !col.editable) continue;
        targetDays.push(...col.workingDaysIso);
      }
      if (targetDays.length === 0) return;

      if (!skipHistory) {
        history.record(localPackagesRef.current);
      }

      const touchedIds: string[] = [];
      setLocalPackages((prev) =>
        prev.map((pkg) => {
          if (pkg.packageNumber !== packageNumber) return pkg;
          touchedIds.push(pkg.id);

          const otherZoneSegs = pkg.segments.filter((s) => s.zoneCode !== zoneCode);
          const sameZoneSegs = pkg.segments.filter((s) => s.zoneCode === zoneCode);
          const daySet = segmentsToWorkingDaySet(sameZoneSegs, holidaySet);

          for (const d of targetDays) {
            if (active) daySet.add(d);
            else daySet.delete(d);
          }

          const rebuiltSameZone = workingDaySetToSegments({
            zoneCode,
            activeIsoSet: daySet,
            holidaySet,
            parallelLane: sameZoneSegs[0]?.parallelLane ?? 1,
            notes: sameZoneSegs[0]?.notes ?? null,
          });

          const nextSegments = [...otherZoneSegs, ...rebuiltSameZone];
          const nextDuration = Math.max(
            1,
            nextSegments.reduce((acc, s) => acc + s.workingDays, 0)
          );

          return {
            ...pkg,
            durationWorkingDays: nextDuration,
            segments: nextSegments,
          };
        })
      );

      if (touchedIds.length > 0) {
        scheduleAutoSync(touchedIds);
      }
    },
    [timeline.columns, holidaySet, scheduleAutoSync, history]
  );

  const handleSelectCell = useCallback(
    (addr: CellAddress, opts?: { extendRange?: boolean; startEdit?: boolean }) => {
      setEditingText(opts?.startEdit ? String(addr.packageNumber) : null);
      setSelection((prev) => {
        if (opts?.extendRange && prev && prev.packageId === addr.packageId && prev.zoneCode === addr.zoneCode) {
          return {
            ...prev,
            focusCol: addr.colIndex,
          };
        }
        return {
          zoneCode: addr.zoneCode,
          packageId: addr.packageId,
          packageNumber: addr.packageNumber,
          rowIndex: addr.rowIndex,
          anchorCol: addr.colIndex,
          focusCol: addr.colIndex,
        };
      });
    },
    []
  );

  const handleMoveSelection = useCallback(
    (fromRow: number, fromCol: number, dir: "left" | "right" | "up" | "down", extendRange = false) => {
      if (flatRows.length === 0 || timeline.columns.length === 0) return;
      let nextRow = fromRow;
      let nextCol = fromCol;

      if (dir === "up") {
        nextRow = Math.max(0, fromRow - 1);
      } else if (dir === "down") {
        nextRow = Math.min(flatRows.length - 1, fromRow + 1);
      } else if (dir === "left") {
        let c = fromCol - 1;
        while (c >= 0 && !timeline.columns[c]?.editable) c -= 1;
        if (c >= 0) nextCol = c;
      } else if (dir === "right") {
        let c = fromCol + 1;
        while (c < timeline.columns.length && !timeline.columns[c]?.editable) c += 1;
        if (c < timeline.columns.length) nextCol = c;
      }

      const targetRow = flatRows[nextRow];
      if (!targetRow) return;

      setEditingText(null);
      setSelection((prev) => {
        if (extendRange && prev && prev.rowIndex === nextRow && (dir === "left" || dir === "right")) {
          return { ...prev, focusCol: nextCol };
        }
        return {
          zoneCode: targetRow.zoneCode,
          packageId: targetRow.pkg.id,
          packageNumber: targetRow.pkg.packageNumber,
          rowIndex: targetRow.rowIndex,
          anchorCol: nextCol,
          focusCol: nextCol,
        };
      });
      focusCellDom(nextRow, nextCol);
    },
    [flatRows, timeline.columns, focusCellDom]
  );

  const handleCommitEdit = useCallback(
    (addr: CellAddress, raw: string, moveAfter?: "left" | "right" | "up" | "down") => {
      setEditingText(null);
      const trimmed = raw.trim();
      if (!trimmed) {
        applyColumnsToPackageZone({
          zoneCode: addr.zoneCode,
          packageNumber: addr.packageNumber,
          colStart: addr.colIndex,
          colEnd: addr.colIndex,
          active: false,
        });
      } else {
        const typedNum = Number(trimmed);
        if (Number.isInteger(typedNum) && typedNum > 0) {
          const targetExists = localPackagesRef.current.some((p) => p.packageNumber === typedNum);
          if (targetExists) {
            if (typedNum !== addr.packageNumber) {
              // Limpa da linha atual se havia bloco e ativa no pacote digitado nesta mesma zona
              applyColumnsToPackageZone({
                zoneCode: addr.zoneCode,
                packageNumber: addr.packageNumber,
                colStart: addr.colIndex,
                colEnd: addr.colIndex,
                active: false,
              });
            }
            applyColumnsToPackageZone({
              zoneCode: addr.zoneCode,
              packageNumber: typedNum,
              colStart: addr.colIndex,
              colEnd: addr.colIndex,
              active: true,
            });
          } else {
            setBannerMsg({
              type: "error",
              text: `Pacote ${typedNum} não encontrado no cronograma da obra.`,
            });
          }
        }
      }

      if (moveAfter) {
        handleMoveSelection(addr.rowIndex, addr.colIndex, moveAfter, false);
      } else {
        focusCellDom(addr.rowIndex, addr.colIndex);
      }
    },
    [applyColumnsToPackageZone, handleMoveSelection, focusCellDom]
  );

  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableCellElement>, addr: CellAddress) => {
      const selMin =
        selection && selection.rowIndex === addr.rowIndex
          ? Math.min(selection.anchorCol, selection.focusCol)
          : addr.colIndex;
      const selMax =
        selection && selection.rowIndex === addr.rowIndex
          ? Math.max(selection.anchorCol, selection.focusCol)
          : addr.colIndex;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        applyColumnsToPackageZone({
          zoneCode: addr.zoneCode,
          packageNumber: addr.packageNumber,
          colStart: selMin,
          colEnd: selMax,
          active: false,
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const pkg = localPackagesRef.current.find((p) => p.id === addr.packageId);
        if (!pkg) return;
        const daySet = segmentsToWorkingDaySet(
          pkg.segments.filter((s) => s.zoneCode === addr.zoneCode),
          holidaySet
        );
        const copied: boolean[] = [];
        for (let c = selMin; c <= selMax; c++) {
          const col = timeline.columns[c];
          if (!col || !col.editable) continue;
          copied.push(col.workingDaysIso.some((d) => daySet.has(d)));
        }
        setClipboardCells(copied);
        setBannerMsg({ type: "success", text: `${copied.length} célula(s) copiada(s).` });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboardCells) {
        e.preventDefault();
        let pasteIdx = 0;
        for (let c = addr.colIndex; c < timeline.columns.length && pasteIdx < clipboardCells.length; c++) {
          const col = timeline.columns[c];
          if (!col || !col.editable) continue;
          applyColumnsToPackageZone({
            zoneCode: addr.zoneCode,
            packageNumber: addr.packageNumber,
            colStart: c,
            colEnd: c,
            active: clipboardCells[pasteIdx],
          });
          pasteIdx += 1;
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleMoveSelection(addr.rowIndex, selection?.focusCol ?? addr.colIndex, "left", e.shiftKey);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleMoveSelection(addr.rowIndex, selection?.focusCol ?? addr.colIndex, "right", e.shiftKey);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleMoveSelection(addr.rowIndex, addr.colIndex, "up", false);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        handleMoveSelection(addr.rowIndex, addr.colIndex, e.shiftKey ? "up" : "down", false);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleMoveSelection(addr.rowIndex, addr.colIndex, e.shiftKey ? "left" : "right", false);
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        // Se um intervalo horizontal foi selecionado e digitar dígito único da própria linha ou tecla,
        // entra em edição na célula se intervalo = 1, ou preenche o intervalo inteiro se multi-célula
        if (selMax > selMin && Number(e.key) === addr.packageNumber) {
          applyColumnsToPackageZone({
            zoneCode: addr.zoneCode,
            packageNumber: addr.packageNumber,
            colStart: selMin,
            colEnd: selMax,
            active: true,
          });
        } else {
          setEditingText(e.key);
        }
      }
    },
    [
      selection,
      applyColumnsToPackageZone,
      holidaySet,
      timeline.columns,
      clipboardCells,
      handleMoveSelection,
    ]
  );

  const handleStartDragFill = useCallback(
    (addr: CellAddress) => {
      history.record(localPackagesRef.current);
      setDragFillOrigin(addr);
    },
    [history]
  );

  const handleHoverFill = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (dragFillOrigin && dragFillOrigin.rowIndex === rowIndex) {
        // Preenchimento contínuo a partir da alça ■
        const pkg = localPackagesRef.current.find((p) => p.id === dragFillOrigin.packageId);
        if (!pkg) return;
        const daySet = segmentsToWorkingDaySet(
          pkg.segments.filter((s) => s.zoneCode === dragFillOrigin.zoneCode),
          holidaySet
        );
        const originCol = timeline.columns[dragFillOrigin.colIndex];
        const originActive = originCol
          ? originCol.workingDaysIso.some((d) => daySet.has(d))
          : true;

        applyColumnsToPackageZone({
          zoneCode: dragFillOrigin.zoneCode,
          packageNumber: dragFillOrigin.packageNumber,
          colStart: dragFillOrigin.colIndex,
          colEnd: colIndex,
          active: originActive,
          skipHistory: true,
        });
        setSelection({
          zoneCode: dragFillOrigin.zoneCode,
          packageId: dragFillOrigin.packageId,
          packageNumber: dragFillOrigin.packageNumber,
          rowIndex,
          anchorCol: dragFillOrigin.colIndex,
          focusCol: colIndex,
        });
        return;
      }

      setSelection((prev) => {
        if (!prev || prev.rowIndex !== rowIndex) return prev;
        return { ...prev, focusCol: colIndex };
      });
    },
    [dragFillOrigin, holidaySet, timeline.columns, applyColumnsToPackageZone]
  );

  const handleShiftSelected = useCallback(
    (unitsOverride?: number, pkgNumberOverride?: number) => {
      const targetNum = pkgNumberOverride ?? selection?.packageNumber;
      if (!targetNum) {
        setBannerMsg({
          type: "error",
          text: "Selecione um pacote ou célula na grade antes de usar Deslocar Intervalo.",
        });
        return;
      }
      const rawUnits = unitsOverride ?? Number(shiftUnitsInput);
      if (!Number.isFinite(rawUnits) || rawUnits === 0) return;

      const deltaWorkingDays = scaleUnitsToWorkingDays(scale, rawUnits);
      history.record(localPackagesRef.current);
      const { packages: shifted, movedPackageNumbers } = shiftSchedulePackages({
        packages: localPackagesRef.current,
        targetPackageNumbers: [targetNum],
        deltaWorkingDays,
        holidaySet,
        cascadeDependents,
      });

      const movedIdSet = new Set(
        shifted
          .filter((p) => movedPackageNumbers.includes(p.packageNumber))
          .map((p) => p.id)
      );

      setLocalPackages(shifted);
      if (movedIdSet.size > 0) {
        scheduleAutoSync(Array.from(movedIdSet));
        setBannerMsg({
          type: "success",
          text: `PCT ${String(targetNum).padStart(2, "0")} deslocado em ${
            rawUnits > 0 ? `+${rawUnits}` : rawUnits
          } (${SCALE_LABELS[scale].toLowerCase()}) — ${movedPackageNumbers.length} pacote(s) atualizado(s).`,
        });
      }
    },
    [selection?.packageNumber, shiftUnitsInput, scale, holidaySet, cascadeDependents, scheduleAutoSync]
  );

  const handleAutoLevel = useCallback(
    (focusPackageNum?: number) => {
      const { packages: leveled, leveledPackageNumbers } = autoLevelConflictingPackages({
        packages: localPackagesRef.current,
        holidaySet,
        maxTeamsLimit,
        focusPackageNumbers: focusPackageNum ? [focusPackageNum] : undefined,
      });

      if (leveledPackageNumbers.length === 0) {
        setBannerMsg({
          type: "success",
          text: "Nenhum pacote precisou ser deslocado dentro do limite de equipes atual.",
        });
        return;
      }

      history.record(localPackagesRef.current);
      const leveledIds = leveled
        .filter((p) => leveledPackageNumbers.includes(p.packageNumber))
        .map((p) => p.id);

      setLocalPackages(leveled);
      scheduleAutoSync(leveledIds);
      setBannerMsg({
        type: "success",
        text: `Nivelamento concluído: ${leveledPackageNumbers.length} pacote(s) realocado(s) para janelas livres (≤ ${maxTeamsLimit} eq./dia).`,
      });
    },
    [holidaySet, maxTeamsLimit, scheduleAutoSync]
  );

  const totalConflictsCount =
    conflicts.overloadedDays.length + conflicts.precedenceViolations.length;
  const cellSizeClass = LOB_DENSITY_CELL[density];
  const dailyColWidthClass = LOB_DENSITY_DAILY_COL[density];

  const scaleSelector = (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
      {(["DIARIO", "SEMANAL", "MENSAL", "ANUAL"] as const).map((sc) => (
        <button
          key={sc}
          type="button"
          onClick={() => {
            setScale(sc);
            setSelection(null);
            setEditingText(null);
          }}
          className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer transition ${
            scale === sc
              ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
              : "text-slate-600 hover:text-slate-900 dark:text-zinc-300"
          }`}
        >
          {SCALE_LABELS[sc]}
        </button>
      ))}
    </div>
  );

  const undoRedoControls = (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
      <button
        type="button"
        onClick={handleUndoLob}
        disabled={!history.canUndo}
        title="Desfazer (Ctrl+Z)"
        className="h-7 rounded-lg px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        ↶
      </button>
      <button
        type="button"
        onClick={handleRedoLob}
        disabled={!history.canRedo}
        title="Refazer (Ctrl+Y)"
        className="h-7 rounded-lg px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        ↷
      </button>
    </div>
  );

  const densityControls = (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
      {(["COMPACTO", "PADRAO", "CONFORTAVEL"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDensity(d)}
          className={`h-7 rounded-lg px-2 text-[10px] font-semibold cursor-pointer ${
            density === d
              ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
              : "text-slate-600 dark:text-zinc-300"
          }`}
        >
          {LOB_DENSITY_LABELS[d]}
        </button>
      ))}
    </div>
  );

  const shiftControls = (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950">
      <span className="text-[11px] font-bold text-rose-700 dark:text-amber-400">
        Deslocar Intervalo
      </span>
      <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400">
        {selection ? `PCT ${String(selection.packageNumber).padStart(2, "0")}` : "Selecione PCT"}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleShiftSelected(-5)}
          disabled={!selection}
          className="h-6 rounded border border-slate-300 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
        >
          -5
        </button>
        <button
          type="button"
          onClick={() => handleShiftSelected(-1)}
          disabled={!selection}
          className="h-6 rounded border border-slate-300 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
        >
          -1
        </button>
        <input
          type="number"
          value={shiftUnitsInput}
          onChange={(e) => setShiftUnitsInput(e.target.value)}
          className="h-6 w-11 rounded border border-slate-300 bg-transparent px-1 text-center font-mono text-[11px] font-bold text-slate-900 dark:border-zinc-700 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => handleShiftSelected(1)}
          disabled={!selection}
          className="h-6 rounded border border-slate-300 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => handleShiftSelected(5)}
          disabled={!selection}
          className="h-6 rounded border border-slate-300 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
        >
          +5
        </button>
        <button
          type="button"
          onClick={() => handleShiftSelected()}
          disabled={!selection}
          className="h-6 rounded-md bg-rose-700 px-2 text-[10px] font-bold text-white hover:bg-rose-800 disabled:opacity-40 cursor-pointer"
        >
          Aplicar
        </button>
      </div>
      <label className="flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={cascadeDependents}
          onChange={(e) => setCascadeDependents(e.target.checked)}
        />
        Cascata
      </label>
    </div>
  );

  const capacityControls = (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950">
        <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
          Máx. Eq.:
        </span>
        <input
          type="number"
          min={1}
          max={50}
          value={maxTeamsLimit}
          onChange={(e) => {
            const next = Math.max(1, Math.min(50, Number(e.target.value) || 1));
            setMaxTeamsLimit(next);
            try {
              window.localStorage.setItem(`arqvertice_lob_max_teams_${projectId}`, String(next));
            } catch {
              // ignora
            }
          }}
          className="h-6 w-10 rounded border border-slate-300 bg-transparent text-center font-mono text-[11px] font-bold text-slate-900 dark:border-zinc-700 dark:text-zinc-100"
        />
        <Badge tone={totalConflictsCount > 0 ? "amber" : "green"}>
          {totalConflictsCount > 0
            ? `${conflicts.overloadedDays.length} exc. eq · ${conflicts.precedenceViolations.length} prec.`
            : "Sem conflitos ✓"}
        </Badge>
      </div>

      {totalConflictsCount > 0 && (
        <button
          type="button"
          onClick={() => handleAutoLevel()}
          className="h-8 rounded-xl bg-amber-600 px-2.5 text-[11px] font-bold text-white hover:bg-amber-700 cursor-pointer"
        >
          ⚡ Nivelar
        </button>
      )}
    </div>
  );

  const saveButton = (
    <button
      type="button"
      onClick={() => void flushSyncToDb(true)}
      disabled={syncState === "saving"}
      className={`h-8 rounded-xl px-3 text-[11px] font-semibold cursor-pointer ${
        dirtyPkgIds.length > 0
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
      }`}
    >
      {syncState === "saving"
        ? "Salvando..."
        : dirtyPkgIds.length > 0
          ? `Salvar (${dirtyPkgIds.length})`
          : syncState === "saved"
            ? "Salvo ✓"
            : "Salvar"}
    </button>
  );

  const lobMatrixTable =
    timeline.columns.length > 0 ? (
      <table className="border-collapse text-[10px]">
        <thead className="sticky top-0 z-20 bg-slate-900 text-white dark:bg-zinc-950">
          <tr>
            <th
              rowSpan={4}
              className="sticky left-0 z-30 min-w-[260px] max-w-[260px] border-r border-slate-700 bg-slate-900 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider dark:bg-zinc-950"
            >
              Zona / Pacote LOB ({SCALE_LABELS[scale]})
            </th>
            {timeline.topGroups.map((tg) => (
              <th
                key={`top-g-${tg.key}`}
                colSpan={tg.count}
                className="border-b border-r border-slate-700 px-1.5 py-1 text-center font-bold lowercase tracking-wide"
              >
                {tg.label}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-800 text-slate-200 dark:bg-zinc-900">
            {timeline.columns.map((col) => (
              <th
                key={`top-s-${col.key}`}
                className={`${dailyColWidthClass} border-b border-r border-slate-700/70 py-0.5 text-center font-mono text-[9px] ${
                  col.isHoliday ? "bg-slate-600 text-white dark:bg-zinc-600" : ""
                }`}
              >
                {col.subLabel}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
            {timeline.columns.map((col) => (
              <th
                key={`top-l-${col.key}`}
                title={col.holidayName ? `Feriado: ${col.holidayName} (${col.label})` : col.label}
                className={`border-b border-r border-slate-200 p-0.5 font-mono text-[9px] font-medium dark:border-zinc-800 ${
                  scale === "DIARIO" ? `h-16 ${dailyColWidthClass}` : "h-7 min-w-[52px] px-1"
                } ${col.isHoliday ? "bg-slate-500 text-white dark:bg-zinc-600" : ""}`}
              >
                {scale === "DIARIO" ? (
                  <div
                    style={{ writingMode: "vertical-rl" }}
                    className="mx-auto rotate-180 whitespace-nowrap leading-none"
                  >
                    {col.label}
                  </div>
                ) : (
                  <span className="whitespace-nowrap">{col.label}</span>
                )}
              </th>
            ))}
          </tr>
          {/* Linha de Capacidade de Equipe por Coluna */}
          <tr className="bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
            {timeline.columns.map((col, idx) => {
              const activeTeams = columnMaxTeams[idx] || 0;
              const overloaded = activeTeams > maxTeamsLimit;
              return (
                <th
                  key={`top-eq-${col.key}`}
                  title={
                    col.isHoliday
                      ? `Feriado: ${col.holidayName ?? ""}`
                      : overloaded
                        ? `ALERTA DE CAPACIDADE: ${activeTeams} equipe(s) alocada(s) > limite de ${maxTeamsLimit} em ${col.label}`
                        : `Efetivo em ${col.label}: ${activeTeams}/${maxTeamsLimit} equipe(s)`
                  }
                  className={`border-b border-r border-slate-300 py-0.5 text-center font-mono text-[9px] font-bold dark:border-zinc-700 ${
                    col.isHoliday
                      ? "bg-slate-500 text-white"
                      : overloaded
                        ? "bg-rose-600 text-white"
                        : activeTeams > 0
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-slate-400"
                  }`}
                >
                  {col.isHoliday ? "-" : activeTeams > 0 ? activeTeams : ""}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {groupedZoneRows.flatMap(({ zone, rows }) => {
            const showAll = Boolean(expandedAllInZone[zone.code]);
            const zoneHeader = (
              <tr key={`z-hdr-${zone.id}`} className="bg-slate-200/90 dark:bg-zinc-800">
                <td className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-200 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-zinc-100">
                      {zone.name} ({rows.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAllInZone((prev) => ({
                          ...prev,
                          [zone.code]: !prev[zone.code],
                        }))
                      }
                      className="rounded border border-slate-400/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 hover:bg-white cursor-pointer dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      {showAll ? "Só ativos" : "+ Todos PCTs"}
                    </button>
                  </div>
                </td>
                {timeline.columns.map((col, idx) => {
                  const overloaded = (columnMaxTeams[idx] || 0) > maxTeamsLimit;
                  return (
                    <td
                      key={`zh-${zone.id}-${col.key}`}
                      className={`border-b border-r border-slate-300/60 dark:border-zinc-700/60 ${
                        col.isHoliday
                          ? "bg-slate-400/70 dark:bg-zinc-600/80"
                          : overloaded
                            ? "bg-rose-100/60 dark:bg-rose-950/30"
                            : ""
                      }`}
                    />
                  );
                })}
              </tr>
            );

            const pkgRows = rows.map(({ pkg, rowIndex }) => {
              const isSelRow =
                selection?.packageId === pkg.id && selection?.zoneCode === zone.code;
              const selMin = isSelRow
                ? Math.min(selection.anchorCol, selection.focusCol)
                : null;
              const selMax = isSelRow
                ? Math.max(selection.anchorCol, selection.focusCol)
                : null;
              const activeCol = isSelRow ? selection.focusCol : null;
              const precTooltip = precedenceByPackageNum.get(pkg.packageNumber) ?? null;

              return (
                <LobPackageRow
                  key={`${zone.code}-${pkg.id}`}
                  zoneCode={zone.code}
                  pkg={pkg}
                  rowIndex={rowIndex}
                  columns={timeline.columns}
                  cellSizeClass={cellSizeClass}
                  holidaySet={holidaySet}
                  overloadedDaysSet={overloadedDaysSet}
                  hasPrecedenceConflict={Boolean(precTooltip)}
                  precedenceTooltip={precTooltip}
                  selectedColMin={selMin}
                  selectedColMax={selMax}
                  activeColIndex={activeCol}
                  editingText={isSelRow ? editingText : null}
                  isSelectedPackage={selection?.packageId === pkg.id}
                  onSelectCell={handleSelectCell}
                  onStartDragFill={handleStartDragFill}
                  onHoverFill={handleHoverFill}
                  onContextMenuCell={(e, addr) => {
                    e.preventDefault();
                    handleSelectCell(addr);
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      zoneCode: addr.zoneCode,
                      packageId: addr.packageId,
                      packageNumber: addr.packageNumber,
                      colIndex: addr.colIndex,
                    });
                  }}
                  onEditChange={(val) => setEditingText(val)}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={() => {
                    setEditingText(null);
                    if (selection) focusCellDom(selection.rowIndex, selection.focusCol);
                  }}
                  onCellKeyDown={handleCellKeyDown}
                  onLevelPackage={(pkgNum) => handleAutoLevel(pkgNum)}
                  onOpenSegment={onOpenSegmentModal}
                />
              );
            });

            return [zoneHeader, ...pkgRows];
          })}
        </tbody>

        <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white dark:bg-zinc-950">
          <tr className="bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
            <th
              rowSpan={3}
              className="sticky left-0 z-30 border-t border-r border-slate-700 bg-slate-900 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-white dark:bg-zinc-950"
            >
              Rodapé Calendário
            </th>
            {timeline.columns.map((col) => (
              <th
                key={`bot-l-${col.key}`}
                className={`border-t border-r border-slate-200 p-0.5 font-mono text-[9px] font-medium dark:border-zinc-800 ${
                  scale === "DIARIO" ? `h-16 ${dailyColWidthClass}` : "h-7 min-w-[52px] px-1"
                } ${col.isHoliday ? "bg-slate-500 text-white dark:bg-zinc-600" : ""}`}
              >
                {scale === "DIARIO" ? (
                  <div
                    style={{ writingMode: "vertical-rl" }}
                    className="mx-auto rotate-180 whitespace-nowrap leading-none"
                  >
                    {col.label}
                  </div>
                ) : (
                  <span className="whitespace-nowrap">{col.label}</span>
                )}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-800 text-slate-200 dark:bg-zinc-900">
            {timeline.columns.map((col) => (
              <th
                key={`bot-s-${col.key}`}
                className={`${dailyColWidthClass} border-t border-r border-slate-700/70 py-0.5 text-center font-mono text-[9px] ${
                  col.isHoliday ? "bg-slate-600 text-white dark:bg-zinc-600" : ""
                }`}
              >
                {col.subLabel}
              </th>
            ))}
          </tr>
          <tr>
            {timeline.topGroups.map((tg) => (
              <th
                key={`bot-g-${tg.key}`}
                colSpan={tg.count}
                className="border-t border-r border-slate-700 px-1.5 py-1 text-center font-bold lowercase tracking-wide"
              >
                {tg.label}
              </th>
            ))}
          </tr>
        </tfoot>
      </table>
    ) : (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
        Clique em &quot;⚡ Gerar / Recalcular da EAP&quot; ou ative &quot;+ Todos PCTs&quot; para preencher a grade LOB.
      </p>
    );

  return (
    <div className="space-y-3">
      {/* Barra Superior: Escalas Temporais, Deslocar Intervalo, Limite de Equipe, Ampliar & Salvar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/50 bg-white/80 p-3 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">Escala:</span>
          {scaleSelector}
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className="h-7 rounded-lg border border-slate-300 bg-white px-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {showLegend ? "Ocultar Legenda" : "Legenda Cores"}
          </button>
        </div>

        {shiftControls}

        <div className="flex flex-wrap items-center gap-2">
          {capacityControls}
          {undoRedoControls}
          {densityControls}
          {saveButton}
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            title="Ampliar grade LOB para tela cheia (100vw × 100vh)"
            className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Ampliar Planilha
          </button>
        </div>
      </div>

      {/* Filtro rápido e dicas */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={packageSearch}
            onChange={(e) => setPackageSearch(e.target.value)}
            placeholder="Filtrar pacote..."
            className="h-7 w-40 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="h-7 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="ALL">Todas as Zonas (4)</option>
            {zones.map((z) => (
              <option key={z.id} value={z.code}>
                {z.name}
              </option>
            ))}
          </select>
          <span>
            Digite nº do pacote (<code>1..38</code>) na célula · <kbd className="rounded border px-1">Del</kbd> limpa ·{" "}
            <kbd className="rounded border px-1">Shift+Setas</kbd> intervalo · arraste{" "}
            <span className="font-mono font-bold text-blue-600">■</span>.
          </span>
        </div>
        <span className="font-mono">
          {syncState === "dirty"
            ? `${dirtyPkgIds.length} pacote(s) pendente(s)...`
            : syncState === "saving"
              ? "Gravando no banco..."
              : syncState === "saved"
                ? "Cronograma sincronizado ✓"
                : `${timeline.columns.length} colunas (${SCALE_LABELS[scale]})`}
        </span>
      </div>

      {bannerMsg && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-medium ${
            bannerMsg.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          }`}
        >
          {bannerMsg.text}
        </div>
      )}

      {/* Legenda de Cores por Pacote */}
      {showLegend && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          {localPackages.map((pkg) => {
            const meta = getLobPackageMeta(pkg.packageNumber, pkg);
            return (
              <span
                key={pkg.id}
                style={{ backgroundColor: meta.corHex, color: meta.textHex }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold"
              >
                <span>{pkg.packageNumber}</span>
                <span className="font-normal opacity-95">{pkg.name.slice(0, 24)}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Matriz Editável LOB (Visualização Normal ou Modo Tela Cheia) */}
      {!isFullscreen && (
        <div className="overflow-auto max-h-[720px] rounded-2xl border border-slate-200 dark:border-zinc-800">
          {lobMatrixTable}
        </div>
      )}

      <EapFullscreenShell
        open={isFullscreen}
        title="Planejamento LOB & Cronograma — Modo Ampliado"
        subtitle={`Escala: ${SCALE_LABELS[scale]} · ${timeline.columns.length} coluna(s) · ${
          totalConflictsCount > 0
            ? `${conflicts.overloadedDays.length} exc. equipe, ${conflicts.precedenceViolations.length} precedência`
            : "Sem conflitos ✓"
        }`}
        onClose={() => setIsFullscreen(false)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              placeholder="Filtrar pacote..."
              className="h-8 w-36 rounded-xl border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">Todas Zonas</option>
              {zones.map((z) => (
                <option key={z.id} value={z.code}>
                  {z.name}
                </option>
              ))}
            </select>
            {scaleSelector}
            {shiftControls}
            {capacityControls}
            {undoRedoControls}
            {densityControls}
            {saveButton}
          </div>
        }
      >
        <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          {lobMatrixTable}
        </div>
      </EapFullscreenShell>

      {/* Menu de Contexto da Célula / Pacote */}
      {contextMenu && (
        <div
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 220),
          }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[120] w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="px-2 py-1 font-mono text-[10px] font-bold text-slate-500 dark:text-zinc-400">
            PCT {String(contextMenu.packageNumber).padStart(2, "0")} · {SCALE_LABELS[scale]}
          </div>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              handleShiftSelected(1, contextMenu.packageNumber);
            }}
            className="block w-full rounded-lg px-2.5 py-1.5 text-left font-medium text-slate-800 hover:bg-slate-100 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            → Deslocar +1 ({SCALE_LABELS[scale]})
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              handleShiftSelected(-1, contextMenu.packageNumber);
            }}
            className="block w-full rounded-lg px-2.5 py-1.5 text-left font-medium text-slate-800 hover:bg-slate-100 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ← Deslocar -1 ({SCALE_LABELS[scale]})
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              const selMin =
                selection && selection.packageId === contextMenu.packageId
                  ? Math.min(selection.anchorCol, selection.focusCol)
                  : contextMenu.colIndex;
              const selMax =
                selection && selection.packageId === contextMenu.packageId
                  ? Math.max(selection.anchorCol, selection.focusCol)
                  : contextMenu.colIndex;
              applyColumnsToPackageZone({
                zoneCode: contextMenu.zoneCode,
                packageNumber: contextMenu.packageNumber,
                colStart: selMin,
                colEnd: selMax,
                active: false,
              });
            }}
            className="block w-full rounded-lg px-2.5 py-1.5 text-left font-medium text-rose-700 hover:bg-rose-50 cursor-pointer dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            × Limpar célula / seleção
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              handleAutoLevel(contextMenu.packageNumber);
            }}
            className="block w-full rounded-lg px-2.5 py-1.5 text-left font-medium text-amber-700 hover:bg-amber-50 cursor-pointer dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            ⚡ Nivelar este pacote
          </button>
          <button
            type="button"
            onClick={() => {
              const pkg = localPackages.find((p) => p.id === contextMenu.packageId);
              const seg = pkg?.segments.find((s) => s.zoneCode === contextMenu.zoneCode) ?? pkg?.segments[0];
              setContextMenu(null);
              if (pkg && seg) {
                onOpenSegmentModal(pkg, seg);
              }
            }}
            className="block w-full rounded-lg px-2.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-100 cursor-pointer dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ✎ Editar datas do trecho
          </button>
        </div>
      )}
    </div>
  );
}
