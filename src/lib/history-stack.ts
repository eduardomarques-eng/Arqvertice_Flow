import { useCallback, useState } from "react";

export interface HistoryState<T> {
  past: T[];
  future: T[];
}

export function createHistoryState<T>(): HistoryState<T> {
  return { past: [], future: [] };
}

export function pushHistory<T>(
  state: HistoryState<T>,
  snapshot: T,
  maxDepth = 40
): HistoryState<T> {
  const nextPast = [...state.past, snapshot];
  const trimmedPast =
    nextPast.length > maxDepth ? nextPast.slice(nextPast.length - maxDepth) : nextPast;
  return {
    past: trimmedPast,
    future: [],
  };
}

export function undoHistory<T>(
  state: HistoryState<T>,
  current: T,
  maxDepth = 40
): { state: HistoryState<T>; restored: T | null } {
  if (state.past.length === 0) {
    return { state, restored: null };
  }
  const restored = state.past[state.past.length - 1];
  const nextPast = state.past.slice(0, -1);
  const nextFuture = [current, ...state.future].slice(0, maxDepth);
  return {
    state: { past: nextPast, future: nextFuture },
    restored,
  };
}

export function redoHistory<T>(
  state: HistoryState<T>,
  current: T,
  maxDepth = 40
): { state: HistoryState<T>; restored: T | null } {
  if (state.future.length === 0) {
    return { state, restored: null };
  }
  const restored = state.future[0];
  const nextFuture = state.future.slice(1);
  const nextPast = [...state.past, current];
  const trimmedPast =
    nextPast.length > maxDepth ? nextPast.slice(nextPast.length - maxDepth) : nextPast;
  return {
    state: { past: trimmedPast, future: nextFuture },
    restored,
  };
}

export function useHistoryStack<T>(maxDepth = 40) {
  const [state, setState] = useState<HistoryState<T>>(() => createHistoryState<T>());

  const record = useCallback(
    (snapshot: T) => {
      setState((prev) => pushHistory(prev, snapshot, maxDepth));
    },
    [maxDepth]
  );

  const stepUndo = useCallback(
    (current: T): T | null => {
      let restoredVal: T | null = null;
      setState((prev) => {
        const res = undoHistory(prev, current, maxDepth);
        restoredVal = res.restored;
        return res.state;
      });
      return restoredVal;
    },
    [maxDepth]
  );

  const stepRedo = useCallback(
    (current: T): T | null => {
      let restoredVal: T | null = null;
      setState((prev) => {
        const res = redoHistory(prev, current, maxDepth);
        restoredVal = res.restored;
        return res.state;
      });
      return restoredVal;
    },
    [maxDepth]
  );

  const clear = useCallback(() => {
    setState(createHistoryState<T>());
  }, []);

  return {
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoCount: state.past.length,
    redoCount: state.future.length,
    record,
    stepUndo,
    stepRedo,
    clear,
    setState,
  };
}
