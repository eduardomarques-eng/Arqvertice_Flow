import type { LobFloorAllocationItem } from "@/lib/eap-lob-grid";

export type EapClearMode = "SELECTED" | "PRELIMINARY" | "ALL";

export interface ClearableEapItemLike {
  id: string;
  dataOrigin?: string;
  zoneQuantities: {
    FUND_TERREO: number;
    PAV_SUPERIOR: number;
    COBERTURA: number;
    EXTERNO: number;
  };
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
}

export function clearEapItemsValues<T extends ClearableEapItemLike>(
  items: T[],
  mode: EapClearMode,
  selectedIds?: ReadonlySet<string>
): { nextItems: T[]; changedIds: string[] } {
  const changedIds: string[] = [];
  const nextItems = items.map((item) => {
    const shouldClear =
      mode === "ALL" ||
      (mode === "SELECTED" && Boolean(selectedIds?.has(item.id))) ||
      (mode === "PRELIMINARY" &&
        (!item.dataOrigin || item.dataOrigin === "PRELIMINAR_PADRAO"));

    if (!shouldClear) return item;

    const alreadyZero =
      item.zoneQuantities.FUND_TERREO === 0 &&
      item.zoneQuantities.PAV_SUPERIOR === 0 &&
      item.zoneQuantities.COBERTURA === 0 &&
      item.zoneQuantities.EXTERNO === 0 &&
      item.materialUnitCost === 0 &&
      item.laborUnitCost === 0 &&
      item.thirdPartyUnitCost === 0;

    if (alreadyZero) return item;

    changedIds.push(item.id);
    return {
      ...item,
      zoneQuantities: {
        FUND_TERREO: 0,
        PAV_SUPERIOR: 0,
        COBERTURA: 0,
        EXTERNO: 0,
      },
      materialUnitCost: 0,
      laborUnitCost: 0,
      thirdPartyUnitCost: 0,
    };
  });

  return { nextItems, changedIds };
}

export function clearLobAllocationsByMode(
  allocations: LobFloorAllocationItem[],
  mode: EapClearMode,
  selectedCellKeys?: ReadonlySet<string>
): { nextAllocations: LobFloorAllocationItem[]; removedCount: number } {
  if (mode === "ALL") {
    return { nextAllocations: [], removedCount: allocations.length };
  }

  const nextAllocations: LobFloorAllocationItem[] = [];
  let removedCount = 0;

  for (const alloc of allocations) {
    const cellKey = `${alloc.floorId}::${alloc.dateIso}`;
    const shouldRemove =
      (mode === "SELECTED" && Boolean(selectedCellKeys?.has(cellKey))) ||
      (mode === "PRELIMINARY" &&
        (!alloc.dataOrigin || alloc.dataOrigin === "PRELIMINAR_PADRAO"));

    if (shouldRemove) {
      removedCount += 1;
    } else {
      nextAllocations.push(alloc);
    }
  }

  return { nextAllocations, removedCount };
}
