"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EapFullscreenShell } from "@/components/admin/eap/eap-fullscreen-shell";
import { EapTeamsAndPackagesManager } from "@/components/admin/eap/eap-teams-and-packages-manager";
import { useHistoryStack } from "@/lib/history-stack";
import {
  applyCommercialUnitPrice,
  createDuplicateItemPayload,
  formatPtBrCurrency,
  formatPtBrDecimalInput,
  formatPtBrQty,
  parseClipboardMatrix,
  parsePtBrNumber,
  recomputeTreeTotals,
  reorderItemsInList,
} from "@/lib/eap-spreadsheet";
import type {
  ComputedEapItemDTO,
  ComputedEapStageDTO,
  ConferenceGateResult,
  EapTreeIndicatorsDTO,
} from "@/server/eap/workbench";

interface EapTreeResponse {
  id: string;
  projectId: string;
  cityId: string;
  cityLabel: string;
  title: string;
  builtAreaM2: number;
  bdiPercent: number;
  plannedStartDate: string | null;
  status: string;
  currentRevision: number;
  premises: string[];
  exclusions: string[];
  zones: Array<{ id: string; code: string; name: string; orderIndex: number }>;
  stages: ComputedEapStageDTO[];
  indicators: EapTreeIndicatorsDTO;
  conferenceGate: ConferenceGateResult;
}

interface CatalogMaterialOption {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  defaultLossPercent: number;
  eapStageCode: string;
  materialUnitCost: number;
  thirdPartyUnitCost: number;
}

type QuickFilter = "ALL" | "WITH_QTY" | "NO_PRICE" | "SANITY" | "MODIFIED";
type SpreadsheetDensity = "COMPACTO" | "PADRAO" | "CONFORTAVEL";

const DENSITY_INPUT_HEIGHT: Record<SpreadsheetDensity, string> = {
  COMPACTO: "h-6 text-[10px] px-1.5",
  PADRAO: "h-8 text-[11px] px-2",
  CONFORTAVEL: "h-10 text-xs px-2.5",
};

const DENSITY_LABELS: Record<SpreadsheetDensity, string> = {
  COMPACTO: "Compacto",
  PADRAO: "Padrão",
  CONFORTAVEL: "Confortável",
};

const INPUT_TEXT =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

function fmtBRL(v: number): string {
  return formatPtBrCurrency(v, false);
}

interface SheetCellProps {
  rowIndex: number;
  colIndex: number;
  displayValue: string;
  editValue: string;
  placeholder?: string;
  align?: "left" | "center" | "right";
  className?: string;
  onCommit: (raw: string) => void;
  onFocusCell?: (rowIndex: number, colIndex: number) => void;
  onPasteMatrix?: (rowIndex: number, colIndex: number, matrix: string[][]) => void;
  onNavigate: (
    rowIndex: number,
    colIndex: number,
    direction: "left" | "right" | "up" | "down"
  ) => void;
  registerRef: (rowIndex: number, colIndex: number, el: HTMLInputElement | null) => void;
}

function SpreadsheetCell({
  rowIndex,
  colIndex,
  displayValue,
  editValue,
  placeholder,
  align = "right",
  className = "",
  onCommit,
  onFocusCell,
  onPasteMatrix,
  onNavigate,
  registerRef,
}: SheetCellProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committedInKeyRef = useRef(false);

  const assignRef = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      registerRef(rowIndex, colIndex, el);
    },
    [rowIndex, colIndex, registerRef]
  );

  function commitIfChanged() {
    if (draft !== editValue) {
      onCommit(draft);
    }
  }

  function handleFocus() {
    committedInKeyRef.current = false;
    setDraft(editValue);
    setFocused(true);
    onFocusCell?.(rowIndex, colIndex);
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }

  function handleBlur() {
    setFocused(false);
    if (committedInKeyRef.current) {
      committedInKeyRef.current = false;
      return;
    }
    commitIfChanged();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      committedInKeyRef.current = true;
      setDraft(editValue);
      setFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      committedInKeyRef.current = true;
      commitIfChanged();
      onNavigate(rowIndex, colIndex, e.shiftKey ? "up" : "down");
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      committedInKeyRef.current = true;
      commitIfChanged();
      onNavigate(rowIndex, colIndex, e.shiftKey ? "left" : "right");
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      committedInKeyRef.current = true;
      commitIfChanged();
      onNavigate(rowIndex, colIndex, "up");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      committedInKeyRef.current = true;
      commitIfChanged();
      onNavigate(rowIndex, colIndex, "down");
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const el = inputRef.current;
      if (!el) return;
      const selStart = el.selectionStart ?? 0;
      const selEnd = el.selectionEnd ?? 0;
      const len = el.value.length;
      if (e.key === "ArrowLeft" && selStart === 0 && selEnd === 0) {
        e.preventDefault();
        committedInKeyRef.current = true;
        commitIfChanged();
        onNavigate(rowIndex, colIndex, "left");
      } else if (e.key === "ArrowRight" && selStart === len && selEnd === len) {
        e.preventDefault();
        committedInKeyRef.current = true;
        commitIfChanged();
        onNavigate(rowIndex, colIndex, "right");
      }
    }
  }

  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <input
      ref={assignRef}
      type="text"
      inputMode={align === "right" ? "decimal" : "text"}
      value={focused ? draft : displayValue}
      placeholder={placeholder}
      onFocus={handleFocus}
      onChange={(e) => setDraft(e.target.value)}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text/plain");
        if (text && (text.includes("\t") || text.includes("\n"))) {
          e.preventDefault();
          committedInKeyRef.current = true;
          setFocused(false);
          onPasteMatrix?.(rowIndex, colIndex, parseClipboardMatrix(text));
        }
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`w-full rounded-none border border-transparent bg-transparent text-slate-900 transition-colors hover:bg-blue-50/40 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600/30 dark:text-zinc-100 dark:hover:bg-zinc-800/40 dark:focus:border-amber-400 dark:focus:bg-zinc-900 dark:focus:ring-amber-400/30 ${alignClass} ${className}`}
    />
  );
}

export function EapConferenceWorkbench({
  projectId,
  cityId,
  onValidated,
  onOpenCostReport,
}: {
  projectId: string;
  cityId: string;
  onValidated?: () => void;
  onOpenCostReport?: () => void;
}) {
  const [tree, setTree] = useState<EapTreeResponse | null>(null);
  const [catalogMaterials, setCatalogMaterials] = useState<CatalogMaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [gateBlockers, setGateBlockers] = useState<string[]>([]);

  // Filtros, expansão, tela cheia e densidade
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QuickFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [globalBdiInput, setGlobalBdiInput] = useState("22");
  const [viewMode, setViewMode] = useState<"EXECUTIVE" | "DETAILED">("EXECUTIVE");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [density, setDensity] = useState<SpreadsheetDensity>("PADRAO");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeRowItemId, setActiveRowItemId] = useState<string | null>(null);
  const [needsPlanningSync, setNeedsPlanningSync] = useState(false);
  const history = useHistoryStack<EapTreeResponse>(40);

  // Menu de contexto discreto na linha (⋮)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modal + Nova Linha (discreto global ou inserir abaixo)
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [newItem, setNewItem] = useState({
    stageCode: "04",
    newGroupName: "",
    materialCatalogId: "",
    code: "",
    description: "",
    unit: "m²",
    category: "ALVENARIA",
    FUND_TERREO: "",
    PAV_SUPERIOR: "",
    COBERTURA: "",
    EXTERNO: "",
    lossPercent: "0",
    materialUnitCost: "",
    laborUnitCost: "",
    thirdPartyUnitCost: "",
    teamsCount: "1",
    saveToCityCatalog: false,
  });

  // Premissas & Exclusões
  const [showPremises, setShowPremises] = useState(false);
  const [premisesText, setPremisesText] = useState("");
  const [exclusionsText, setExclusionsText] = useState("");

  // Referências para navegação por teclado estilo Excel
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const treeRef = useRef<EapTreeResponse | null>(null);
  treeRef.current = tree;
  const dirtySetRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, matRes] = await Promise.all([
        fetch(`/api/eap/projects/${projectId}/tree`, { cache: "no-store" }),
        fetch(`/api/eap/catalog/materials?cityId=${encodeURIComponent(cityId)}`, { cache: "no-store" }),
      ]);
      const [treeJson, matJson] = await Promise.all([treeRes.json(), matRes.json()]);
      if (treeJson.ok && treeJson.tree) {
        const t = treeJson.tree as EapTreeResponse;
        setTree(t);
        setGlobalBdiInput(String(t.bdiPercent));
        setPremisesText(t.premises.join("\n"));
        setExclusionsText(t.exclusions.join("\n"));
        setExpandedStages((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const initial: Record<string, boolean> = {};
          const anyWithQty = t.stages.some((st) =>
            st.groups.some((g) => g.items.some((it) => it.totalQtyWithLoss > 0))
          );
          for (const st of t.stages) {
            if (anyWithQty) {
              initial[st.code] = st.groups.some((g) => g.items.some((it) => it.totalQtyWithLoss > 0));
            } else {
              initial[st.code] = st.itemsCount > 0;
            }
          }
          return initial;
        });
      }
      if (matJson.ok && Array.isArray(matJson.items)) {
        setCatalogMaterials(matJson.items);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, cityId]);

  useEffect(() => {
    void loadTree();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [loadTree]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogMaterials.slice(0, 12);
    return catalogMaterials
      .filter((m) => `${m.code} ${m.name} ${m.category}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [catalogMaterials, catalogSearch]);

  const matchesFilter = useCallback(
    (item: ComputedEapItemDTO): boolean => {
      const q = search.trim().toLowerCase();
      if (
        q &&
        !`${item.code || ""} ${item.description} ${item.sourceSoftware}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filter === "WITH_QTY") return item.totalQtyWithLoss > 0;
      if (filter === "NO_PRICE") return item.totalQtyWithLoss > 0 && item.unitDirectCost <= 0;
      if (filter === "SANITY") return Boolean(item.sanityFlag);
      if (filter === "MODIFIED") return item.revisionTag !== "ORIGINAL";
      return true;
    },
    [search, filter]
  );

  // Calcula quantidade total de colunas editáveis por linha (depende do viewMode)
  // EXECUTIVE: 0=CÓDIGO, 1=DESCRIÇÃO, 2=UNID, 3=TÉRREO, 4=SUPERIOR, 5=COBERTA, 6=EXTERNO, 7=PR.UNITÁRIO (8 colunas)
  // DETAILED: 0..6 iguais, 7=PERDA%, 8=MAT, 9=MO, 10=TERC, 11=M.UP, 12=EQ., 13=PR.UNITÁRIO (14 colunas)
  const editableColCount = viewMode === "DETAILED" ? 14 : 8;

  // Mapeia índice linear das linhas visíveis na tela para navegação de teclado
  const visibleRowOrder = useMemo(() => {
    if (!tree) return [] as string[];
    const ids: string[] = [];
    for (const st of tree.stages) {
      if (stageFilter !== "ALL" && st.code !== stageFilter) continue;
      const isOpen =
        Boolean(expandedStages[st.code]) ||
        Boolean(search.trim()) ||
        filter !== "ALL" ||
        stageFilter !== "ALL";
      if (!isOpen) continue;
      for (const grp of st.groups) {
        for (const it of grp.items) {
          if (matchesFilter(it)) ids.push(it.id);
        }
      }
    }
    return ids;
  }, [tree, expandedStages, search, filter, stageFilter, matchesFilter]);

  const rowIndexByItemId = useMemo(() => {
    const map = new Map<string, number>();
    visibleRowOrder.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [visibleRowOrder]);

  const registerCellRef = useCallback(
    (rowIndex: number, colIndex: number, el: HTMLInputElement | null) => {
      const key = `${rowIndex}:${colIndex}`;
      if (el) {
        cellRefs.current.set(key, el);
      } else {
        cellRefs.current.delete(key);
      }
    },
    []
  );

  const navigateCell = useCallback(
    (rowIndex: number, colIndex: number, direction: "left" | "right" | "up" | "down") => {
      const maxRow = visibleRowOrder.length - 1;
      const maxCol = editableColCount - 1;
      if (maxRow < 0) return;

      let nextRow = rowIndex;
      let nextCol = colIndex;

      if (direction === "left") {
        if (colIndex > 0) {
          nextCol = colIndex - 1;
        } else if (rowIndex > 0) {
          nextRow = rowIndex - 1;
          nextCol = maxCol;
        }
      } else if (direction === "right") {
        if (colIndex < maxCol) {
          nextCol = colIndex + 1;
        } else if (rowIndex < maxRow) {
          nextRow = rowIndex + 1;
          nextCol = 0;
        }
      } else if (direction === "up") {
        nextRow = Math.max(0, rowIndex - 1);
      } else if (direction === "down") {
        nextRow = Math.min(maxRow, rowIndex + 1);
      }

      const target = cellRefs.current.get(`${nextRow}:${nextCol}`);
      if (target) {
        target.focus();
      }
    },
    [visibleRowOrder.length, editableColCount]
  );

  const persistSingleItem = useCallback(
    async (item: ComputedEapItemDTO, extra?: { clearSanityFlag?: boolean }): Promise<boolean> => {
      try {
        const res = await fetch(`/api/eap/projects/${projectId}/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: item.code,
            description: item.description,
            unit: item.unit,
            zoneQuantities: item.zoneQuantities,
            lossPercent: item.lossPercent,
            materialUnitCost: item.materialUnitCost,
            laborUnitCost: item.laborUnitCost,
            thirdPartyUnitCost: item.thirdPartyUnitCost,
            markupMultiplier: item.markupMultiplier,
            teamsCount: item.teamsCount,
            clearSanityFlag: extra?.clearSanityFlag,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          setFeedback({
            type: "error",
            text: json.error || `Erro ao salvar "${item.description.slice(0, 32)}".`,
          });
          return false;
        }
        // Atualiza revisionTag/sanityFlag vindos do servidor sem interromper o foco
        if (json.item) {
          setTree((prev) => {
            if (!prev) return prev;
            const nextTree: EapTreeResponse = {
              ...prev,
              stages: prev.stages.map((st) => ({
                ...st,
                groups: st.groups.map((g) => ({
                  ...g,
                  items: g.items.map((it) =>
                    it.id === item.id
                      ? {
                        ...it,
                        revisionTag: String(json.item.revisionTag || it.revisionTag),
                        sanityFlag: json.item.sanityFlag ?? null,
                      }
                      : it
                  ),
                })),
              })),
            };
            return recomputeTreeTotals(nextTree);
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [projectId]
  );

  const flushDirtyItems = useCallback(
    async (explicit = false) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const ids = Array.from(dirtySetRef.current);
      if (ids.length === 0) {
        if (explicit) {
          setAutoSaveState("saved");
        }
        return;
      }

      const currentTree = treeRef.current;
      if (!currentTree) return;

      const itemsById = new Map<string, ComputedEapItemDTO>();
      for (const st of currentTree.stages) {
        for (const g of st.groups) {
          for (const it of g.items) {
            itemsById.set(it.id, it);
          }
        }
      }

      setAutoSaveState("saving");
      if (explicit) setSavingId("flush-all");
      let allOk = true;
      for (const id of ids) {
        const item = itemsById.get(id);
        if (!item) {
          dirtySetRef.current.delete(id);
          continue;
        }
        const ok = await persistSingleItem(item);
        if (ok) {
          dirtySetRef.current.delete(id);
        } else {
          allOk = false;
        }
      }

      const remaining = Array.from(dirtySetRef.current);
      setDirtyIds(remaining);
      setSavingId(null);

      if (allOk && remaining.length === 0) {
        setAutoSaveState("saved");
        if (explicit) {
          setFeedback({ type: "success", text: "Todas as alterações da planilha foram salvas no banco." });
        }
      } else {
        setAutoSaveState("error");
      }
    },
    [persistSingleItem]
  );

  const markRestoredDiffsAndSave = useCallback(
    (prevTree: EapTreeResponse, restored: EapTreeResponse) => {
      const prevById = new Map<string, ComputedEapItemDTO>();
      for (const st of prevTree.stages) {
        for (const g of st.groups) {
          for (const it of g.items) prevById.set(it.id, it);
        }
      }
      for (const st of restored.stages) {
        for (const g of st.groups) {
          for (const it of g.items) {
            const old = prevById.get(it.id);
            if (!old || JSON.stringify(old) !== JSON.stringify(it)) {
              dirtySetRef.current.add(it.id);
            }
          }
        }
      }
      setTree(recomputeTreeTotals(restored));
      setDirtyIds(Array.from(dirtySetRef.current));
      if (dirtySetRef.current.size > 0) {
        setAutoSaveState("dirty");
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          void flushDirtyItems(false);
        }, 850);
      }
    },
    [flushDirtyItems]
  );

  const handleUndo = useCallback(() => {
    const current = treeRef.current;
    if (!current) return;
    const restored = history.stepUndo(current);
    if (restored) {
      markRestoredDiffsAndSave(current, restored);
    }
  }, [history, markRestoredDiffsAndSave]);

  const handleRedo = useCallback(() => {
    const current = treeRef.current;
    if (!current) return;
    const restored = history.stepRedo(current);
    if (restored) {
      markRestoredDiffsAndSave(current, restored);
    }
  }, [history, markRestoredDiffsAndSave]);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "textarea") return;
      const key = e.key.toLowerCase();
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const currItem = activeRowItemId
          ? treeRef.current?.stages
              .flatMap((s) => s.groups.flatMap((g) => g.items))
              .find((it) => it.id === activeRowItemId)
          : null;
        void handleQuickAddInStage(currItem?.stageCode || "04", currItem?.groupId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && activeRowItemId) {
        e.preventDefault();
        const currItem = treeRef.current?.stages
          .flatMap((s) => s.groups.flatMap((g) => g.items))
          .find((it) => it.id === activeRowItemId);
        if (currItem) void handleDuplicateItem(currItem);
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && activeRowItemId) {
        e.preventDefault();
        const currItem = treeRef.current?.stages
          .flatMap((s) => s.groups.flatMap((g) => g.items))
          .find((it) => it.id === activeRowItemId);
        if (currItem) {
          void handleReorderItem(
            currItem.groupId,
            currItem.id,
            e.key === "ArrowUp" ? "up" : "down"
          );
        }
      } else if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  function updateCellAndQueueSave(
    itemId: string,
    updater: (item: ComputedEapItemDTO) => ComputedEapItemDTO
  ) {
    if (treeRef.current) {
      history.record(treeRef.current);
    }
    setTree((prev) => {
      if (!prev) return prev;
      const updated: EapTreeResponse = {
        ...prev,
        stages: prev.stages.map((st) => ({
          ...st,
          groups: st.groups.map((g) => ({
            ...g,
            items: g.items.map((it) => {
              if (it.id !== itemId) return it;
              const nextIt = updater(it);
              if (nextIt.revisionTag === "ORIGINAL") {
                return { ...nextIt, revisionTag: "EDITADO_MANUAL" };
              }
              return nextIt;
            }),
          })),
        })),
      };
      return recomputeTreeTotals(updated);
    });

    dirtySetRef.current.add(itemId);
    setDirtyIds(Array.from(dirtySetRef.current));
    setAutoSaveState("dirty");
    setNeedsPlanningSync(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void flushDirtyItems(false);
    }, 850);
  }

  const handleQuickAddInStage = useCallback(
    async (stageCode: string, groupId?: string) => {
      setSavingId(`quick-add-${stageCode}`);
      setFeedback(null);
      try {
        const res = await fetch(`/api/eap/projects/${projectId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stageCode,
            groupId,
            description: "Novo serviço",
            unit: "unid",
            zoneQuantities: { FUND_TERREO: 0, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
            lossPercent: 0,
            materialUnitCost: 0,
            laborUnitCost: 0,
            thirdPartyUnitCost: 0,
            teamsCount: 1,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setFeedback({ type: "error", text: json.error || "Erro ao adicionar item." });
          return;
        }
        setExpandedStages((prev) => ({ ...prev, [stageCode]: true }));
        setNeedsPlanningSync(true);
        await loadTree();
        if (json.item?.id) {
          setActiveRowItemId(json.item.id);
          requestAnimationFrame(() => {
            const idx = visibleRowOrder.indexOf(json.item.id);
            if (idx >= 0) {
              cellRefs.current.get(`${idx}:1`)?.focus();
            }
          });
        }
      } finally {
        setSavingId(null);
      }
    },
    [projectId, loadTree, visibleRowOrder]
  );

  const handleDuplicateItem = useCallback(
    async (item: ComputedEapItemDTO) => {
      setOpenMenuId(null);
      setSavingId(`dup-${item.id}`);
      try {
        const payload = createDuplicateItemPayload(item);
        const res = await fetch(`/api/eap/projects/${projectId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setFeedback({ type: "error", text: json.error || "Erro ao duplicar linha." });
          return;
        }
        setNeedsPlanningSync(true);
        setFeedback({ type: "success", text: `Linha "${item.description.slice(0, 32)}" duplicada.` });
        await loadTree();
      } finally {
        setSavingId(null);
      }
    },
    [projectId, loadTree]
  );

  const handleReorderItem = useCallback(
    async (groupId: string, itemId: string, direction: "up" | "down") => {
      setOpenMenuId(null);
      const currentTree = treeRef.current;
      if (!currentTree) return;
      let orderedIds: string[] = [];
      history.record(currentTree);
      setTree((prev) => {
        if (!prev) return prev;
        const next: EapTreeResponse = {
          ...prev,
          stages: prev.stages.map((st) => ({
            ...st,
            groups: st.groups.map((g) => {
              if (g.id !== groupId) return g;
              const reordered = reorderItemsInList(g.items, itemId, direction);
              orderedIds = reordered.map((it) => it.id);
              return { ...g, items: reordered };
            }),
          })),
        };
        return recomputeTreeTotals(next);
      });
      if (orderedIds.length > 0) {
        await fetch(`/api/eap/projects/${projectId}/items/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REORDER", groupId, orderedItemIds: orderedIds }),
        });
      }
    },
    [projectId, history]
  );

  const handleBatchAction = useCallback(
    async (action: "DELETE" | "CLEAR_QUANTITIES") => {
      if (selectedItemIds.length === 0) return;
      setSavingId("batch");
      try {
        const res = await fetch(`/api/eap/projects/${projectId}/items/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, itemIds: selectedItemIds }),
        });
        if (res.ok) {
          setSelectedItemIds([]);
          setNeedsPlanningSync(true);
          setFeedback({
            type: "success",
            text:
              action === "DELETE"
                ? "Itens selecionados removidos."
                : "Quantidades dos itens selecionados zeradas.",
          });
          await loadTree();
        }
      } finally {
        setSavingId(null);
      }
    },
    [projectId, selectedItemIds, loadTree]
  );

  const handlePasteMatrix = useCallback(
    (startRow: number, startCol: number, matrix: string[][]) => {
      const currentTree = treeRef.current;
      if (!currentTree || matrix.length === 0) return;
      history.record(currentTree);

      const touchedIds = new Set<string>();
      const updatesByItemId = new Map<string, Array<{ colIdx: number; raw: string }>>();

      for (let r = 0; r < matrix.length; r++) {
        const targetItemId = visibleRowOrder[startRow + r];
        if (!targetItemId) continue;
        const rowCells = matrix[r];
        for (let c = 0; c < rowCells.length; c++) {
          const targetCol = startCol + c;
          if (targetCol >= editableColCount) break;
          touchedIds.add(targetItemId);
          const list = updatesByItemId.get(targetItemId) ?? [];
          list.push({ colIdx: targetCol, raw: rowCells[c] });
          updatesByItemId.set(targetItemId, list);
        }
      }

      if (touchedIds.size === 0) return;

      setTree((prev) => {
        if (!prev) return prev;
        const next: EapTreeResponse = {
          ...prev,
          stages: prev.stages.map((st) => ({
            ...st,
            groups: st.groups.map((g) => ({
              ...g,
              items: g.items.map((it) => {
                const ops = updatesByItemId.get(it.id);
                if (!ops) return it;
                let nextIt = { ...it, zoneQuantities: { ...it.zoneQuantities } };
                for (const { colIdx, raw } of ops) {
                  if (colIdx === 0) nextIt.code = raw.trim().toUpperCase() || null;
                  else if (colIdx === 1 && raw.trim()) nextIt.description = raw.trim();
                  else if (colIdx === 2 && raw.trim()) nextIt.unit = raw.trim();
                  else if (colIdx === 3) nextIt.zoneQuantities.FUND_TERREO = parsePtBrNumber(raw);
                  else if (colIdx === 4) nextIt.zoneQuantities.PAV_SUPERIOR = parsePtBrNumber(raw);
                  else if (colIdx === 5) nextIt.zoneQuantities.COBERTURA = parsePtBrNumber(raw);
                  else if (colIdx === 6) nextIt.zoneQuantities.EXTERNO = parsePtBrNumber(raw);
                  else if (
                    (viewMode === "EXECUTIVE" && colIdx === 7) ||
                    (viewMode === "DETAILED" && colIdx === 13)
                  ) {
                    const split = applyCommercialUnitPrice(nextIt, parsePtBrNumber(raw));
                    nextIt = { ...nextIt, ...split };
                  }
                }
                if (nextIt.revisionTag === "ORIGINAL") {
                  nextIt.revisionTag = "EDITADO_MANUAL";
                }
                return nextIt;
              }),
            })),
          })),
        };
        return recomputeTreeTotals(next);
      });

      for (const id of touchedIds) dirtySetRef.current.add(id);
      setDirtyIds(Array.from(dirtySetRef.current));
      setAutoSaveState("dirty");
      setNeedsPlanningSync(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        void flushDirtyItems(false);
      }, 850);
    },
    [visibleRowOrder, editableColCount, viewMode, history, flushDirtyItems]
  );

  async function handleConfirmSanity(item: ComputedEapItemDTO) {
    setOpenMenuId(null);
    setSavingId(item.id);
    const ok = await persistSingleItem(item, { clearSanityFlag: true });
    setSavingId(null);
    if (ok) {
      dirtySetRef.current.delete(item.id);
      setDirtyIds(Array.from(dirtySetRef.current));
      setFeedback({ type: "success", text: `Valor de "${item.description.slice(0, 36)}" confirmado.` });
    }
  }

  async function deleteItem(itemId: string) {
    setOpenMenuId(null);
    setSavingId(itemId);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        dirtySetRef.current.delete(itemId);
        setDirtyIds(Array.from(dirtySetRef.current));
        setFeedback({ type: "success", text: "Linha removida da planilha EAP." });
        await loadTree();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setSavingId("add-item");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageCode: newItem.stageCode,
          groupId: selectedGroupId || undefined,
          newGroupName: selectedGroupId ? undefined : newItem.newGroupName.trim() || undefined,
          materialCatalogId: newItem.materialCatalogId || null,
          code: newItem.code.trim() || null,
          description: newItem.description.trim(),
          unit: newItem.unit.trim(),
          category: newItem.category,
          zoneQuantities: {
            FUND_TERREO: parsePtBrNumber(newItem.FUND_TERREO),
            PAV_SUPERIOR: parsePtBrNumber(newItem.PAV_SUPERIOR),
            COBERTURA: parsePtBrNumber(newItem.COBERTURA),
            EXTERNO: parsePtBrNumber(newItem.EXTERNO),
          },
          lossPercent: parsePtBrNumber(newItem.lossPercent),
          materialUnitCost: parsePtBrNumber(newItem.materialUnitCost),
          laborUnitCost: parsePtBrNumber(newItem.laborUnitCost),
          thirdPartyUnitCost: parsePtBrNumber(newItem.thirdPartyUnitCost),
          teamsCount: Math.max(1, Math.round(parsePtBrNumber(newItem.teamsCount) || 1)),
          saveToCityCatalog: newItem.saveToCityCatalog,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao adicionar linha." });
        return;
      }
      setShowAddModal(false);
      setSelectedGroupId(null);
      setExpandedStages((prev) => ({ ...prev, [newItem.stageCode]: true }));
      setFeedback({ type: "success", text: "Nova linha inserida na planilha EAP." });
      await loadTree();
    } finally {
      setSavingId(null);
    }
  }

  async function handleApplyGlobalBdi() {
    await flushDirtyItems(false);
    const val = parsePtBrNumber(globalBdiInput);
    if (!Number.isFinite(val) || val < 0) return;
    setSavingId("bdi");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bdiPercent: val, applyBdiToAllItems: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao aplicar BDI global." });
        return;
      }
      setFeedback({ type: "success", text: `BDI Global (${val}%) aplicado em lote a todas as linhas.` });
      await loadTree();
    } finally {
      setSavingId(null);
    }
  }

  async function handleSavePremises() {
    setSavingId("premises");
    try {
      const premises = premisesText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const exclusions = exclusionsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const res = await fetch(`/api/eap/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premisesJson: premises, exclusionsJson: exclusions }),
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Premissas e Exclusões salvas." });
        await loadTree();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleValidateConference() {
    await flushDirtyItems(false);
    setSavingId("validate");
    setFeedback(null);
    setGateBlockers([]);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/validate-conference`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.approved) {
        setGateBlockers(Array.isArray(json.blockers) ? json.blockers : [json.error || "Pendências encontradas."]);
        setFeedback({ type: "error", text: "Conferência bloqueada: resolva os itens listados abaixo." });
        return;
      }
      setFeedback({
        type: "success",
        text: "Conferência da EAP homologada (CONFERENCIA_OK)! Aba Planejamento liberada.",
      });
      await loadTree();
      onValidated?.();
    } finally {
      setSavingId(null);
    }
  }

  function toggleAllStages(expand: boolean) {
    if (!tree) return;
    const next: Record<string, boolean> = {};
    for (const st of tree.stages) next[st.code] = expand;
    setExpandedStages(next);
  }

  if (loading || !tree) {
    return (
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
        Carregando Planilha EAP & Custos...
      </Card>
    );
  }

  const ind = tree.indicators;
  const bdiValue = Math.max(0, ind.totalCommercialPrice - ind.totalDirectCost);
  const totalCols = viewMode === "DETAILED" ? 18 : 12;
  const cellDensityClass = DENSITY_INPUT_HEIGHT[density];

  const saveButton = (
    <button
      type="button"
      onClick={() => void flushDirtyItems(true)}
      disabled={autoSaveState === "saving"}
      className={`h-8 rounded-xl px-3 text-[11px] font-semibold cursor-pointer transition ${dirtyIds.length > 0
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        }`}
    >
      {autoSaveState === "saving"
        ? "Salvando..."
        : dirtyIds.length > 0
          ? `Salvar (${dirtyIds.length})`
          : autoSaveState === "saved"
            ? "Salvo ✓"
            : "Salvar"}
    </button>
  );

  const undoRedoControls = (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={handleUndo}
        disabled={!history.canUndo}
        title="Desfazer (Ctrl+Z)"
        className="h-7 rounded-lg px-2 text-[11px] font-semibold text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        ↶
      </button>
      <button
        type="button"
        onClick={handleRedo}
        disabled={!history.canRedo}
        title="Refazer (Ctrl+Y)"
        className="h-7 rounded-lg px-2 text-[11px] font-semibold text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        ↷
      </button>
    </div>
  );

  const densityControls = (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {(["COMPACTO", "PADRAO", "CONFORTAVEL"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDensity(d)}
          className={`h-7 rounded-lg px-2 text-[10px] font-semibold cursor-pointer ${density === d
            ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
            : "text-slate-600 dark:text-zinc-300"
            }`}
        >
          {DENSITY_LABELS[d]}
        </button>
      ))}
    </div>
  );

  const spreadsheetTable = (
    <table className="w-full border-collapse text-left text-[11px]">
      <thead className="sticky top-0 z-30 bg-slate-900 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm dark:bg-zinc-950">
        <tr>
          <th className="sticky left-0 z-40 w-[72px] min-w-[72px] max-w-[72px] border-r border-slate-700/80 bg-slate-900 px-2.5 py-2.5 whitespace-nowrap dark:bg-zinc-950">
            Item
          </th>
          <th className="sticky left-[72px] z-40 w-[108px] min-w-[108px] max-w-[108px] border-r border-slate-700/80 bg-slate-900 px-2 py-2.5 whitespace-nowrap dark:bg-zinc-950">
            Código
          </th>
          <th className="sticky left-[180px] z-40 w-[290px] min-w-[290px] max-w-[290px] border-r border-slate-700/80 bg-slate-900 px-3 py-2.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.35)] dark:bg-zinc-950">
            Discriminação dos Serviços
          </th>
          <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-center whitespace-nowrap w-[64px]">
            Unid
          </th>
          <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[88px]">
            Qtd. Térreo
          </th>
          <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[92px]">
            Qtd. Superior
          </th>
          <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[92px]">
            Qtd. Coberta
          </th>
          <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[92px]">
            Qtd. Externo
          </th>
          {viewMode === "DETAILED" && (
            <>
              <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[64px]">
                Perda%
              </th>
              <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[86px]">
                Mat R$
              </th>
              <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[86px]">
                MO R$
              </th>
              <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[86px]">
                Terc R$
              </th>
              <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[64px]">
                M.Up
              </th>
              <th className="border-r border-slate-700/70 px-1.5 py-2.5 text-right whitespace-nowrap w-[54px]">
                Eq.
              </th>
            </>
          )}
          <th className="border-r border-slate-700/70 bg-slate-800/80 px-2 py-2.5 text-right whitespace-nowrap w-[92px]">
            Qtd. Total
          </th>
          <th className="border-r border-slate-700/70 px-2 py-2.5 text-right whitespace-nowrap w-[108px]">
            Pr. Unitário
          </th>
          <th className="border-r border-slate-700/70 bg-slate-800/80 px-2.5 py-2.5 text-right whitespace-nowrap w-[118px]">
            Pr. Total
          </th>
          <th className="px-1.5 py-2.5 text-center whitespace-nowrap w-[36px]">⋮</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800">
        {tree.stages.map((stage) => {
          if (stageFilter !== "ALL" && stage.code !== stageFilter) return null;
          const forceExpand = Boolean(search.trim()) || filter !== "ALL" || stageFilter !== "ALL";
          const isOpen = forceExpand || Boolean(expandedStages[stage.code]);
          const stageFilteredItems = stage.groups.flatMap((g) => g.items.filter(matchesFilter));
          if ((Boolean(search.trim()) || filter !== "ALL") && stageFilteredItems.length === 0) {
            return null;
          }

          return (
            <Fragment key={stage.id}>
              {/* Nível 1: Macro-Etapa (com painéis congelados à esquerda) */}
              <tr
                onClick={() =>
                  setExpandedStages((prev) => ({ ...prev, [stage.code]: !prev[stage.code] }))
                }
                className="cursor-pointer bg-slate-100 hover:bg-slate-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800/90"
              >
                <td className="sticky left-0 z-10 w-[72px] min-w-[72px] max-w-[72px] border-r border-slate-200/80 bg-slate-100 px-2.5 py-2 font-mono font-bold text-slate-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-amber-400">
                  {isOpen ? "▼" : "▶"} {stage.code}
                </td>
                <td className="sticky left-[72px] z-10 w-[108px] min-w-[108px] max-w-[108px] border-r border-slate-200/80 bg-slate-100 px-2 py-2 font-mono text-[10px] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
                  ETAPA
                </td>
                <td className="sticky left-[180px] z-10 w-[290px] min-w-[290px] max-w-[290px] border-r border-slate-200/80 bg-slate-100 px-3 py-2 shadow-[2px_0_5px_-2px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-950 dark:text-zinc-100">
                      {stage.name}
                    </span>
                    <Badge tone="neutral">{stage.itemsCount}</Badge>
                    {stage.weightPercent > 0 && (
                      <span className="font-mono text-[10px] font-semibold text-blue-700 dark:text-amber-400">
                        {stage.weightPercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </td>
                <td colSpan={totalCols - 5} className="border-r border-slate-200/80 dark:border-zinc-800" />
                <td
                  colSpan={2}
                  className="px-2.5 py-2 text-right font-mono text-xs font-extrabold tabular-nums text-slate-950 dark:text-zinc-100 whitespace-nowrap"
                >
                  {fmtBRL(stage.totalCommercialPrice)}
                </td>
              </tr>

              {/* Nível 2 & 3: Subgrupos e Linhas Editáveis */}
              {isOpen &&
                stage.groups.map((group) => {
                  const groupItems = group.items.filter(matchesFilter);
                  if ((Boolean(search.trim()) || filter !== "ALL") && groupItems.length === 0) {
                    return null;
                  }

                  return (
                    <Fragment key={group.id}>
                      <tr className="bg-slate-50 dark:bg-zinc-950">
                        <td className="sticky left-0 z-10 w-[72px] min-w-[72px] max-w-[72px] border-r border-slate-200/70 bg-slate-50 px-2.5 py-1 pl-4 font-mono text-[10px] font-bold text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                          {group.code}
                        </td>
                        <td className="sticky left-[72px] z-10 w-[108px] min-w-[108px] max-w-[108px] border-r border-slate-200/70 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-400 dark:border-zinc-800 dark:bg-zinc-950">
                          —
                        </td>
                        <td className="sticky left-[180px] z-10 w-[290px] min-w-[290px] max-w-[290px] border-r border-slate-200/70 bg-slate-50 px-3 py-1 shadow-[2px_0_5px_-2px_rgba(15,23,42,0.1)] dark:border-zinc-800 dark:bg-zinc-950">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                            {group.name}
                          </span>
                        </td>
                        <td colSpan={totalCols - 5} className="border-r border-slate-200/70 dark:border-zinc-800" />
                        <td
                          colSpan={2}
                          className="px-2.5 py-1 text-right font-mono text-[11px] font-bold tabular-nums text-slate-700 dark:text-zinc-300 whitespace-nowrap"
                        >
                          {group.totalCommercialPrice > 0 ? fmtBRL(group.totalCommercialPrice) : "—"}
                        </td>
                      </tr>

                      {groupItems.map((item, itemIdx) => {
                        const rIdx = rowIndexByItemId.get(item.id) ?? 0;
                        const isDirty = dirtyIds.includes(item.id);
                        const colOffsetDetailed = viewMode === "DETAILED" ? 6 : 0;
                        const rowBgClass = item.sanityFlag
                          ? "bg-rose-50 dark:bg-rose-950/30"
                          : isDirty
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : "bg-white dark:bg-[#16161D]";

                        return (
                          <tr
                            key={item.id}
                            className={`group transition-colors ${rowBgClass} hover:bg-slate-50/90 dark:hover:bg-zinc-900/60`}
                          >
                            {/* ITEM (congelado à esquerda) */}
                            <td
                              className={`sticky left-0 z-10 w-[72px] min-w-[72px] max-w-[72px] border-r border-slate-200/70 px-2 py-0.5 pl-4 font-mono text-[10px] text-slate-500 whitespace-nowrap dark:border-zinc-800 ${rowBgClass}`}
                            >
                              {group.code}.{itemIdx + 1}
                            </td>

                            {/* CÓDIGO (congelado à esquerda) */}
                            <td
                              className={`sticky left-[72px] z-10 w-[108px] min-w-[108px] max-w-[108px] border-r border-slate-200/70 p-0 dark:border-zinc-800 ${rowBgClass}`}
                            >
                              <SpreadsheetCell
                                rowIndex={rIdx}
                                colIndex={0}
                                displayValue={item.code || ""}
                                editValue={item.code || ""}
                                placeholder="—"
                                align="left"
                                className={`${cellDensityClass} font-mono uppercase text-slate-600 dark:text-zinc-300`}
                                registerRef={registerCellRef}
                                onNavigate={navigateCell}
                                onCommit={(raw) =>
                                  updateCellAndQueueSave(item.id, (curr) => ({
                                    ...curr,
                                    code: raw.trim().toUpperCase() || null,
                                  }))
                                }
                              />
                            </td>

                            {/* DISCRIMINAÇÃO DOS SERVIÇOS (congelado à esquerda) */}
                            <td
                              className={`sticky left-[180px] z-10 w-[290px] min-w-[290px] max-w-[290px] border-r border-slate-200/70 p-0 shadow-[2px_0_5px_-2px_rgba(15,23,42,0.1)] dark:border-zinc-800 ${rowBgClass}`}
                            >
                              <div className="flex items-center gap-1 pr-1.5">
                                <SpreadsheetCell
                                  rowIndex={rIdx}
                                  colIndex={1}
                                  displayValue={item.description}
                                  editValue={item.description}
                                  align="left"
                                  className={`${cellDensityClass} font-medium text-slate-900 dark:text-zinc-100`}
                                  registerRef={registerCellRef}
                                  onNavigate={navigateCell}
                                  onCommit={(raw) => {
                                    const trimmed = raw.trim();
                                    if (!trimmed) return;
                                    updateCellAndQueueSave(item.id, (curr) => ({
                                      ...curr,
                                      description: trimmed,
                                    }));
                                  }}
                                />
                                {item.sourceSoftware !== "TEMPLATE" && (
                                  <span
                                    title={`Origem: ${item.sourceSoftware}${item.sourcePage ? ` p.${item.sourcePage}` : ""}`}
                                    className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                                  >
                                    {item.sourceSoftware}
                                  </span>
                                )}
                                {item.revisionTag !== "ORIGINAL" && (
                                  <span
                                    title={`Status: ${item.revisionTag}`}
                                    className="shrink-0 rounded bg-blue-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  >
                                    EDIT
                                  </span>
                                )}
                                {item.sanityFlag && (
                                  <button
                                    type="button"
                                    title={item.sanityFlag}
                                    onClick={() => void handleConfirmSanity(item)}
                                    className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white cursor-pointer"
                                  >
                                    ⚠
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* UNID */}
                            <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                              <SpreadsheetCell
                                rowIndex={rIdx}
                                colIndex={2}
                                displayValue={item.unit}
                                editValue={item.unit}
                                align="center"
                                className={`${cellDensityClass} font-mono`}
                                registerRef={registerCellRef}
                                onNavigate={navigateCell}
                                onCommit={(raw) => {
                                  const trimmed = raw.trim();
                                  if (!trimmed) return;
                                  updateCellAndQueueSave(item.id, (curr) => ({
                                    ...curr,
                                    unit: trimmed,
                                  }));
                                }}
                              />
                            </td>

                            {/* 4 ZONAS: QTD. TÉRREO | QTD. SUPERIOR | QTD. COBERTA | QTD. EXTERNO */}
                            {(["FUND_TERREO", "PAV_SUPERIOR", "COBERTURA", "EXTERNO"] as const).map(
                              (zKey, zIdx) => {
                                const val = item.zoneQuantities[zKey];
                                return (
                                  <td
                                    key={zKey}
                                    className="border-r border-slate-200/70 p-0 dark:border-zinc-800"
                                  >
                                    <SpreadsheetCell
                                      rowIndex={rIdx}
                                      colIndex={3 + zIdx}
                                      displayValue={formatPtBrQty(val, true)}
                                      editValue={formatPtBrDecimalInput(val, true)}
                                      align="right"
                                      className={`${cellDensityClass} font-mono tabular-nums`}
                                      registerRef={registerCellRef}
                                      onNavigate={navigateCell}
                                      onCommit={(raw) => {
                                        const nextVal = parsePtBrNumber(raw);
                                        updateCellAndQueueSave(item.id, (curr) => ({
                                          ...curr,
                                          zoneQuantities: {
                                            ...curr.zoneQuantities,
                                            [zKey]: nextVal,
                                          },
                                        }));
                                      }}
                                    />
                                  </td>
                                );
                              }
                            )}

                            {/* COMPOSIÇÃO INTERNA OPCIONAL */}
                            {viewMode === "DETAILED" && (
                              <>
                                <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                                  <SpreadsheetCell
                                    rowIndex={rIdx}
                                    colIndex={7}
                                    displayValue={formatPtBrQty(item.lossPercent, true)}
                                    editValue={formatPtBrDecimalInput(item.lossPercent, true)}
                                    align="right"
                                    className={`${cellDensityClass} font-mono tabular-nums`}
                                    registerRef={registerCellRef}
                                    onNavigate={navigateCell}
                                    onCommit={(raw) => {
                                      const nextVal = Math.min(100, parsePtBrNumber(raw));
                                      updateCellAndQueueSave(item.id, (curr) => ({
                                        ...curr,
                                        lossPercent: nextVal,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                                  <SpreadsheetCell
                                    rowIndex={rIdx}
                                    colIndex={8}
                                    displayValue={formatPtBrCurrency(item.materialUnitCost, true)}
                                    editValue={formatPtBrDecimalInput(item.materialUnitCost, true)}
                                    align="right"
                                    className={`${cellDensityClass} font-mono tabular-nums`}
                                    registerRef={registerCellRef}
                                    onNavigate={navigateCell}
                                    onCommit={(raw) => {
                                      const nextVal = parsePtBrNumber(raw);
                                      updateCellAndQueueSave(item.id, (curr) => ({
                                        ...curr,
                                        materialUnitCost: nextVal,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                                  <SpreadsheetCell
                                    rowIndex={rIdx}
                                    colIndex={9}
                                    displayValue={formatPtBrCurrency(item.laborUnitCost, true)}
                                    editValue={formatPtBrDecimalInput(item.laborUnitCost, true)}
                                    align="right"
                                    className={`${cellDensityClass} font-mono tabular-nums`}
                                    registerRef={registerCellRef}
                                    onNavigate={navigateCell}
                                    onCommit={(raw) => {
                                      const nextVal = parsePtBrNumber(raw);
                                      updateCellAndQueueSave(item.id, (curr) => ({
                                        ...curr,
                                        laborUnitCost: nextVal,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                                  <SpreadsheetCell
                                    rowIndex={rIdx}
                                    colIndex={10}
                                    displayValue={formatPtBrCurrency(item.thirdPartyUnitCost, true)}
                                    editValue={formatPtBrDecimalInput(item.thirdPartyUnitCost, true)}
                                    align="right"
                                    className={`${cellDensityClass} font-mono tabular-nums`}
                                    registerRef={registerCellRef}
                                    onNavigate={navigateCell}
                                    onCommit={(raw) => {
                                      const nextVal = parsePtBrNumber(raw);
                                      updateCellAndQueueSave(item.id, (curr) => ({
                                        ...curr,
                                        thirdPartyUnitCost: nextVal,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                                  <SpreadsheetCell
                                    rowIndex={rIdx}
                                    colIndex={11}
                                    displayValue={item.markupMultiplier.toFixed(2).replace(".", ",")}
                                    editValue={formatPtBrDecimalInput(item.markupMultiplier, false)}
                                    align="right"
                                    className={`${cellDensityClass} font-mono tabular-nums`}
                                    registerRef={registerCellRef}
                                    onNavigate={navigateCell}
                                    onCommit={(raw) => {
                                      const nextVal = Math.max(1, parsePtBrNumber(raw) || 1);
                                      updateCellAndQueueSave(item.id, (curr) => ({
                                        ...curr,
                                        markupMultiplier: nextVal,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                                  <SpreadsheetCell
                                    rowIndex={rIdx}
                                    colIndex={12}
                                    displayValue={String(item.teamsCount)}
                                    editValue={String(item.teamsCount)}
                                    align="right"
                                    className={`${cellDensityClass} font-mono tabular-nums`}
                                    registerRef={registerCellRef}
                                    onNavigate={navigateCell}
                                    onCommit={(raw) => {
                                      const nextVal = Math.max(1, Math.round(parsePtBrNumber(raw) || 1));
                                      updateCellAndQueueSave(item.id, (curr) => ({
                                        ...curr,
                                        teamsCount: nextVal,
                                      }));
                                    }}
                                  />
                                </td>
                              </>
                            )}

                            {/* QTD. TOTAL */}
                            <td
                              title={
                                item.lossPercent > 0 && item.rawQuantity > 0
                                  ? `Soma das zonas: ${formatPtBrQty(item.rawQuantity, false)} · c/ ${item.lossPercent}% perda: ${formatPtBrQty(item.totalQtyWithLoss, false)}`
                                  : undefined
                              }
                              className="border-r border-slate-200/70 bg-slate-50/70 px-2 py-1 text-right font-mono font-semibold tabular-nums whitespace-nowrap text-slate-900 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100"
                            >
                              {formatPtBrQty(item.rawQuantity, true)}
                            </td>

                            {/* PR. UNITÁRIO */}
                            <td className="border-r border-slate-200/70 p-0 dark:border-zinc-800">
                              <SpreadsheetCell
                                rowIndex={rIdx}
                                colIndex={7 + colOffsetDetailed}
                                displayValue={formatPtBrCurrency(item.unitCommercialPrice, true)}
                                editValue={formatPtBrDecimalInput(item.unitCommercialPrice, true)}
                                align="right"
                                className={`${cellDensityClass} font-mono tabular-nums text-slate-800 dark:text-zinc-200`}
                                registerRef={registerCellRef}
                                onNavigate={navigateCell}
                                onCommit={(raw) => {
                                  const nextCommPrice = parsePtBrNumber(raw);
                                  updateCellAndQueueSave(item.id, (curr) => {
                                    const split = applyCommercialUnitPrice(curr, nextCommPrice);
                                    return {
                                      ...curr,
                                      ...split,
                                    };
                                  });
                                }}
                              />
                            </td>

                            {/* PR. TOTAL */}
                            <td className="border-r border-slate-200/70 bg-slate-50/70 px-2.5 py-1 text-right font-mono font-bold tabular-nums whitespace-nowrap text-slate-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100">
                              {item.totalCommercialPrice > 0 ? fmtBRL(item.totalCommercialPrice) : ""}
                            </td>

                            {/* MENU DISCRETO DE LINHA (⋮) */}
                            <td className="relative px-1 py-0.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId((curr) => (curr === item.id ? null : item.id));
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                                title="Opções da linha"
                              >
                                ⋮
                              </button>
                              {openMenuId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-2 top-7 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setSelectedGroupId(group.id);
                                      setNewItem((prev) => ({
                                        ...prev,
                                        stageCode: stage.code,
                                        newGroupName: "",
                                      }));
                                      setShowAddModal(true);
                                    }}
                                    className="block w-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  >
                                    + Inserir linha nesta etapa
                                  </button>
                                  {item.sanityFlag && (
                                    <button
                                      type="button"
                                      onClick={() => void handleConfirmSanity(item)}
                                      className="block w-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50 cursor-pointer dark:text-amber-300 dark:hover:bg-amber-950/40"
                                    >
                                      ✓ Confirmar alerta
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={savingId === item.id}
                                    onClick={() => void deleteItem(item.id)}
                                    className="block w-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 cursor-pointer dark:text-rose-400 dark:hover:bg-rose-950/40"
                                  >
                                    × Excluir linha
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
      </tbody>
      <tfoot className="sticky bottom-0 z-30 border-t-2 border-slate-300 bg-slate-900 text-xs font-bold text-white dark:border-zinc-700 dark:bg-zinc-950">
        <tr>
          <td
            colSpan={totalCols - 3}
            className="px-3 py-2.5 text-right uppercase tracking-wide"
          >
            <span className="mr-4 text-[10px] font-semibold text-slate-300">
              Custo Direto: {fmtBRL(ind.totalDirectCost)} · BDI ({tree.bdiPercent}%): {fmtBRL(bdiValue)}
            </span>
            Total Geral (Com BDI)
          </td>
          <td
            colSpan={3}
            className="px-3 py-2.5 text-right font-mono text-sm tabular-nums whitespace-nowrap text-emerald-300"
          >
            {fmtBRL(ind.totalCommercialPrice)}
          </td>
        </tr>
      </tfoot>
    </table>
  );

  return (
    <div className="space-y-5">
      {/* KPIs & Indicadores de Engenharia em Tempo Real */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Geral (Com BDI)
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtBRL(ind.totalCommercialPrice)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
            {fmtBRL(ind.costPerM2)} / m² ({ind.builtAreaM2} m²)
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Subtotal Direto + BDI ({tree.bdiPercent}%)
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtBRL(ind.totalDirectCost)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-zinc-400">
            BDI: {fmtBRL(bdiValue)} · {fmtBRL(ind.directCostPerM2)}/m²
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Composição Material × MO × Terceiros
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-xs font-bold tabular-nums">
            <span className="text-blue-700 dark:text-blue-400">Mat {ind.materialSharePercent}%</span>
            <span className="text-emerald-700 dark:text-emerald-400">MO {ind.laborSharePercent}%</span>
            <span className="text-amber-700 dark:text-amber-400">Terc {ind.thirdPartySharePercent}%</span>
          </div>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div style={{ width: `${ind.materialSharePercent}%` }} className="bg-blue-600" />
            <div style={{ width: `${ind.laborSharePercent}%` }} className="bg-emerald-500" />
            <div style={{ width: `${ind.thirdPartySharePercent}%` }} className="bg-amber-500" />
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Indicadores de Engenharia
          </p>
          <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums text-slate-800 dark:text-zinc-200">
            <div className="flex justify-between">
              <span>Taxa de Aço:</span>
              <span className="font-bold">{ind.steelRateKgPerM3} kg/m³</span>
            </div>
            <div className="flex justify-between">
              <span>Concreto / m²:</span>
              <span className="font-bold">{ind.concreteM3PerM2} m³/m²</span>
            </div>
            <div className="flex justify-between">
              <span>Alvenaria / m²:</span>
              <span className="font-bold">{ind.masonryM2PerM2} m²/m²</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Ferramentas, Filtros & Auto-Save */}
      <Card className="rounded-3xl border border-white/50 bg-white/80 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por item, código ou serviço..."
              className={`${INPUT_TEXT} w-56`}
            />
            {(
              [
                { id: "ALL", label: "Todos" },
                { id: "WITH_QTY", label: "Com Qtd" },
                { id: "NO_PRICE", label: `Sem Preço (${tree.conferenceGate.summary.itemsWithoutPriceCount})` },
                { id: "SANITY", label: `Alertas (${tree.conferenceGate.summary.sanityAlertsCount})` },
                { id: "MODIFIED", label: "Editados" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`h-8 rounded-xl px-3 text-[11px] font-semibold cursor-pointer ${filter === chip.id
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">BDI %</span>
              <input
                type="text"
                inputMode="decimal"
                value={globalBdiInput}
                onChange={(e) => setGlobalBdiInput(e.target.value)}
                className="w-12 bg-transparent text-right font-mono text-xs font-bold text-slate-900 focus:outline-none dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleApplyGlobalBdi}
                disabled={savingId === "bdi"}
                className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
              >
                Aplicar
              </button>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setViewMode("EXECUTIVE")}
                className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer ${viewMode === "EXECUTIVE"
                  ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                  : "text-slate-600 dark:text-zinc-300"
                  }`}
              >
                Planilha Padrão
              </button>
              <button
                type="button"
                onClick={() => setViewMode("DETAILED")}
                className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer ${viewMode === "DETAILED"
                  ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                  : "text-slate-600 dark:text-zinc-300"
                  }`}
              >
                Composição
              </button>
            </div>

            <button
              type="button"
              onClick={() => toggleAllStages(true)}
              className="h-8 rounded-xl border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
            >
              Expandir
            </button>
            <button
              type="button"
              onClick={() => toggleAllStages(false)}
              className="h-8 rounded-xl border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
            >
              Recolher
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedGroupId(null);
                setShowAddModal(true);
              }}
              className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              + Nova Linha
            </button>

            {undoRedoControls}
            {densityControls}
            {saveButton}

            <EapTeamsAndPackagesManager
              projectId={projectId}
              stages={tree.stages.map((st) => ({ code: st.code, name: st.name }))}
              onLaborSynced={() => void loadTree()}
            />

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Abrir planilha em modo tela cheia (100vw × 100vh)"
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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

            {onOpenCostReport && (
              <button
                type="button"
                onClick={onOpenCostReport}
                className="inline-flex h-8 items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/70"
              >
                📊 Relatório da EAP (Custos)
              </button>
            )}

            <button
              type="button"
              onClick={handleValidateConference}
              disabled={savingId === "validate"}
              className="h-8 rounded-xl bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              {savingId === "validate" ? "Validando..." : "✓ Validar EAP"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Dica: <kbd className="rounded border px-1">Tab</kbd>/<kbd className="rounded border px-1">Enter</kbd>/setas navegam ·{" "}
              <kbd className="rounded border px-1">Alt+N</kbd> nova linha · <kbd className="rounded border px-1">Ctrl+D</kbd> duplica ·{" "}
              <kbd className="rounded border px-1">Ctrl+V</kbd> cola matriz Excel.
            </span>
            {needsPlanningSync && (
              <Badge tone="blue">EAP atualizada — pronta para sincronizar no Planejamento</Badge>
            )}
            {selectedItemIds.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-zinc-800">
                <strong className="text-slate-800 dark:text-zinc-200">
                  {selectedItemIds.length} selecionado(s)
                </strong>
                <button
                  type="button"
                  onClick={() => void handleBatchAction("CLEAR_QUANTITIES")}
                  className="text-amber-700 hover:underline cursor-pointer dark:text-amber-300"
                >
                  Zerar Qtds
                </button>
                <button
                  type="button"
                  onClick={() => void handleBatchAction("DELETE")}
                  className="text-rose-700 hover:underline cursor-pointer dark:text-rose-400"
                >
                  Excluir
                </button>
              </span>
            )}
          </div>
          <span className="font-mono">
            {autoSaveState === "saving"
              ? "Sincronizando alterações..."
              : autoSaveState === "dirty"
                ? `${dirtyIds.length} célula(s) aguardando gravação automática...`
                : autoSaveState === "saved"
                  ? "Sincronizado no banco ✓"
                  : "Edição automática ativada"}
          </span>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
              }`}
          >
            {feedback.text}
          </div>
        )}

        {gateBlockers.length > 0 && (
          <ul className="list-disc rounded-xl border border-rose-200 bg-rose-50/70 px-6 py-2.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {gateBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Planilha Editável (Normal ou Tela Cheia 100vw × 100vh) */}
      {!isFullscreen && (
        <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="max-h-[760px] overflow-auto">{spreadsheetTable}</div>
        </Card>
      )}

      <EapFullscreenShell
        open={isFullscreen}
        title="Planilha EAP & Custos — Modo Ampliado"
        subtitle={`${tree.cityLabel} · Área: ${ind.builtAreaM2} m² · Total Geral: ${fmtBRL(ind.totalCommercialPrice)} · ${autoSaveState === "saving"
          ? "Salvando..."
          : autoSaveState === "dirty"
            ? `${dirtyIds.length} alteração(ões) pendente(s)`
            : "Sincronizado ✓"
          }`}
        onClose={() => setIsFullscreen(false)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item/serviço..."
              className="h-8 w-44 rounded-xl border border-slate-300 bg-white px-2.5 text-[11px] text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-8 max-w-[190px] rounded-xl border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">Todas as Etapas (26)</option>
              {tree.stages.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => toggleAllStages(true)}
              className="h-8 rounded-xl border border-slate-300 px-2 text-[10px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
            >
              Expandir
            </button>
            <button
              type="button"
              onClick={() => toggleAllStages(false)}
              className="h-8 rounded-xl border border-slate-300 px-2 text-[10px] font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
            >
              Recolher
            </button>
            {undoRedoControls}
            {densityControls}
            {saveButton}
          </div>
        }
      >
        <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          {spreadsheetTable}
        </div>
      </EapFullscreenShell>

      {/* Editor Colapsável de Premissas & Exclusões da Proposta */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <button
          type="button"
          onClick={() => setShowPremises((v) => !v)}
          className="flex w-full items-center justify-between text-left cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Premissas Técnicas & Itens Não Inclusos na Proposta
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Textos exibidos no Relatório Executivo do Cliente.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
            {showPremises ? "Ocultar ▲" : "Editar ▼"}
          </span>
        </button>

        {showPremises && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Premissas (uma por linha)
                </label>
                <textarea
                  rows={5}
                  value={premisesText}
                  onChange={(e) => setPremisesText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Itens Não Inclusos / Exclusões (um por linha)
                </label>
                <textarea
                  rows={5}
                  value={exclusionsText}
                  onChange={(e) => setExclusionsText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSavePremises}
              disabled={savingId === "premises"}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              {savingId === "premises" ? "Salvando..." : "Salvar Premissas & Exclusões"}
            </button>
          </div>
        )}
      </Card>

      {/* Modal: + Nova Linha na Planilha EAP */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form
            onSubmit={handleAddItem}
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 dark:border-zinc-800 dark:bg-[#16161D]"
          >
            <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
              Inserir Nova Linha na Planilha EAP ({tree.cityLabel})
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Buscar no Catálogo Regional (opcional — preenche preço automaticamente)
              </label>
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Digite aço, concreto, porcelanato, porta..."
                className={`${INPUT_TEXT} mt-1 w-full`}
              />
              {filteredCatalog.length > 0 && (
                <div className="mt-1.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {filteredCatalog.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setNewItem((prev) => ({
                          ...prev,
                          materialCatalogId: m.id,
                          code: m.code,
                          description: m.name,
                          unit: m.unit,
                          category: m.category,
                          stageCode: m.eapStageCode,
                          lossPercent: String(m.defaultLossPercent).replace(".", ","),
                          materialUnitCost: String(m.materialUnitCost).replace(".", ","),
                          thirdPartyUnitCost: String(m.thirdPartyUnitCost).replace(".", ","),
                        }))
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {m.code} · {m.name.slice(0, 36)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Etapa EAP</label>
                <select
                  value={newItem.stageCode}
                  onChange={(e) => setNewItem({ ...newItem, stageCode: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full`}
                >
                  {tree.stages.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Discriminação do Serviço
                </label>
                <input
                  type="text"
                  required
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Código</label>
                <input
                  type="text"
                  value={newItem.code}
                  onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                  placeholder="Opcional"
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Unidade</label>
                <input
                  type="text"
                  required
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Perda (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newItem.lossPercent}
                  onChange={(e) => setNewItem({ ...newItem, lossPercent: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Material (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newItem.materialUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, materialUnitCost: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Mão de Obra (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newItem.laborUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, laborUnitCost: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  { key: "FUND_TERREO", label: "Qtd. Térreo" },
                  { key: "PAV_SUPERIOR", label: "Qtd. Superior" },
                  { key: "COBERTURA", label: "Qtd. Coberta" },
                  { key: "EXTERNO", label: "Qtd. Externo" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    {label}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={newItem[key]}
                    onChange={(e) => setNewItem({ ...newItem, [key]: e.target.value })}
                    className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Terceiros (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newItem.thirdPartyUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, thirdPartyUnitCost: e.target.value })}
                  className={`${INPUT_TEXT} mt-1 w-full font-mono`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={newItem.saveToCityCatalog}
                onChange={(e) => setNewItem({ ...newItem, saveToCityCatalog: e.target.checked })}
              />
              Salvar também no catálogo regional de {tree.cityLabel} para reutilização futura
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingId === "add-item"}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                {savingId === "add-item" ? "Inserindo..." : "Inserir Linha"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
