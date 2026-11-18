"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";

export type RealtimeSyncStatus = "idle" | "syncing" | "saved" | "error";

export interface UseRealtimeMutationOptions<TState, TPayload> {
  /** Estado inicial sincronizado com o servidor */
  initialState: TState;
  /** Função pura que aplica a alteração imediatamente na UI (0ms) */
  applyOptimistic: (current: TState, payload: TPayload) => TState;
  /** Chamada assíncrona de persistência no banco/API */
  commitMutation: (payload: TPayload, nextState: TState) => Promise<void>;
  /** Janela de debounce em ms para agrupar edições contínuas (padrão: 400ms) */
  debounceMs?: number;
  /** Se true, bloqueia novas execuções enquanto uma ação destrutiva está em curso */
  preventDoubleSubmit?: boolean;
  /** Callback opcional de erro */
  onError?: (message: string) => void;
}

export function useRealtimeMutation<TState, TPayload>({
  initialState,
  applyOptimistic,
  commitMutation,
  debounceMs = 400,
  preventDoubleSubmit = false,
  onError,
}: UseRealtimeMutationOptions<TState, TPayload>) {
  const [state, setState] = useState<TState>(initialState);
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const confirmedStateRef = useRef<TState>(initialState);
  const latestStateRef = useRef<TState>(initialState);
  const latestPayloadRef = useRef<TPayload | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightCountRef = useRef<number>(0);

  // Sincroniza se initialState mudar externamente sem edição pendente
  useEffect(() => {
    if (inFlightCountRef.current === 0 && !debounceTimerRef.current) {
      confirmedStateRef.current = initialState;
      latestStateRef.current = initialState;
      setState(initialState);
    }
  }, [initialState]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);
    };
  }, []);

  const executeCommit = useCallback(
    async (payload: TPayload, targetState: TState) => {
      inFlightCountRef.current += 1;
      setSyncStatus("syncing");
      setErrorMessage(null);
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);

      try {
        await commitMutation(payload, targetState);
        confirmedStateRef.current = targetState;
        inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
        if (inFlightCountRef.current === 0) {
          setSyncStatus("saved");
          setIsLocked(false);
          savedHideTimerRef.current = setTimeout(() => {
            setSyncStatus((curr) => (curr === "saved" ? "idle" : curr));
          }, 2400);
        }
      } catch (err) {
        inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
        const msg =
          err instanceof Error ? err.message : "Erro ao sincronizar alteração.";
        // Rollback automático para o último estado confirmado
        latestStateRef.current = confirmedStateRef.current;
        startTransition(() => {
          setState(confirmedStateRef.current);
        });
        setSyncStatus("error");
        setErrorMessage(msg);
        setIsLocked(false);
        onError?.(msg);
      }
    },
    [commitMutation, onError]
  );

  /**
   * Dispara atualização otimista imediata (0ms) e agenda/executa persistência em segundo plano.
   * Use `immediate: true` para ações discretas (toggles, cliques) ou `immediate: false` para digitação/sliders.
   */
  const mutate = useCallback(
    (payload: TPayload, options?: { immediate?: boolean }) => {
      if (preventDoubleSubmit && isLocked) return;

      const nextState = applyOptimistic(latestStateRef.current, payload);
      latestStateRef.current = nextState;
      latestPayloadRef.current = payload;

      // Atualização visual instantânea (0ms)
      setState(nextState);
      setErrorMessage(null);
      setSyncStatus("syncing");

      if (preventDoubleSubmit) {
        setIsLocked(true);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (options?.immediate || debounceMs <= 0) {
        latestPayloadRef.current = null;
        void executeCommit(payload, nextState);
      } else {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          const pendingPayload = latestPayloadRef.current ?? payload;
          latestPayloadRef.current = null;
          void executeCommit(pendingPayload, latestStateRef.current);
        }, debounceMs);
      }
    },
    [applyOptimistic, debounceMs, executeCommit, isLocked, preventDoubleSubmit]
  );

  const flush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (latestPayloadRef.current !== null) {
      const pendingPayload = latestPayloadRef.current;
      latestPayloadRef.current = null;
      void executeCommit(pendingPayload, latestStateRef.current);
    }
  }, [executeCommit]);

  const replaceConfirmedState = useCallback((next: TState) => {
    confirmedStateRef.current = next;
    latestStateRef.current = next;
    latestPayloadRef.current = null;
    setState(next);
  }, []);

  return {
    state,
    mutate,
    flush,
    syncStatus,
    errorMessage,
    isLocked,
    replaceConfirmedState,
  };
}

/**
 * Pílula discreta de status em tempo real ("Sincronizando..." -> "Salvo ✓")
 * para cabeçalhos e barras de ferramentas.
 */
export function RealtimeSyncBadge({
  status,
  errorMessage,
  className = "",
}: {
  status: RealtimeSyncStatus;
  errorMessage?: string | null;
  className?: string;
}) {
  if (status === "idle") return null;

  if (status === "syncing") {
    return (
      <span
        data-testid="realtime-sync-badge"
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/90 px-2.5 py-1 text-[11px] font-semibold text-amber-800 backdrop-blur-md transition-all dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
        <span>Sincronizando...</span>
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span
        data-testid="realtime-sync-badge"
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 backdrop-blur-md transition-all dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200 ${className}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        >
          <path
            d="M3.5 8.5L6.5 11.5L12.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Salvo</span>
      </span>
    );
  }

  return (
    <span
      data-testid="realtime-sync-badge"
      title={errorMessage || "Erro de sincronização"}
      className={`inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 backdrop-blur-md dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      <span>{errorMessage || "Erro ao salvar (revertido)"}</span>
    </span>
  );
}
