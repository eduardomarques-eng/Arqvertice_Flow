﻿/**
 * Memory Leak Prevention Utilities for React
 *
 * Item 41: Prevenção de vazamento de memória (Memory Leaks)
 *
 * Garante que:
 *  - useEffect com setInterval tenham cleanup obrigatório
 *  - addEventListener tenham removido no cleanup
 *  - AbortControllers sejam abortados
 *  - Conexões SSE sejam fechadas
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook genérico para intervalos com cleanup obrigatório.
 * Imita o comportamento do setInterval com clearInterval no cleanup.
 */
export function useInterval(
  callback: () => void,
  delay: number | null,
  options?: {
    immediate?: boolean;
    runOnStart?: boolean;
  }
): void {
  const savedCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }, delay);

    // Opção para rodar imediatamente
    if (options?.immediate ?? false) {
      callback();
    }

    return () => clearInterval(id);
  }, [delay, options?.immediate, callback]);
}

/**
 * Hook genérico para addEventListener com cleanup obrigatório.
 * Evita vazamento de eventos que não são removidos.
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  listener: (event: WindowEventMap[K]) => void,
  dependencies: unknown[] = [],
  options?: boolean | AddEventListenerOptions
): void {
  useEffect(() => {
    window.addEventListener(eventName, listener, options);
    return () => {
      window.removeEventListener(eventName, listener, options);
    };
  }, [eventName, listener, ...dependencies, options]);
}

/**
 * Hook genérico para listenTo custom events com cleanup obrigatório.
 */
export function useCustomEventListener<T>(
  eventName: string,
  listener: (event: T) => void,
  dispatch: typeof window.dispatchEvent,
  options?: boolean | AddEventListenerOptions
): void {
  useEffect(() => {
    const handler = (event: Event) => {
      // Type guard para o tipo de evento personalizado
      if (event instanceof CustomEvent && event.type === eventName) {
        listener(event as T);
      }
    };

    dispatch(new CustomEvent(eventName, { cancelable: true }));
    dispatchEvent?.(new CustomEvent(eventName, { cancelable: true }));

    dispatch(new CustomEvent(eventName, { cancelable: true }));
    window.addEventListener(eventName, handler as EventListener, options);

    return () => {
      window.removeEventListener(eventName, handler as EventListener, options);
    };
  }, [eventName, listener, dispatch, options]);
}

/**
 * Hook para AbortController com cleanup automático.
 * Garante que o signal seja abortado quando o componente se desmontar.
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current = new AbortController();
    setController(controllerRef.current);

    return () => {
      // Aborta o controller ao desmontar
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return controller!;
}

/**
 * Hook para conexões SSE com cleanup obrigatório.
 * Garante que a conexão seja fechada quando o componente desmontar.
 */
export function useSSE(
  url: string,
  sessionToken: string,
  options: {
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
  } = {}
) {
  const { autoReconnect = true, reconnectDelay = 3000, maxReconnectAttempts = 5 } = options;
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "failed">("connecting");
  const [lastEvent, setLastEvent] = useState<string>("" );
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasUnmounted = useRef(false);

  useEffect(() => {
    wasUnmounted.current = false;
    reconnectAttempts.current = 0;

    const source = new EventSource(url, {
      withCredentials: true,
    });

    setEventSource(source);

    source.onopen = () => setStatus("open");
    source.onerror = (event) => {
      console.warn(`[SSE] Erro na conexão: ${event.type}`);
      setStatus("failed");

      if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current = 0;
          // Verificar se o componente ainda está montado antes de reconectar
          if (!wasUnmounted.current) {
            setStatus("connecting");
          }
        }, reconnectDelay);
      } else {
        setStatus("closed");
        reconnectAttempts.current = 0;
      }
    };

    source.onmessage = (event) => {
      setLastEvent(event.data);
      // Processar mensagens do servidor
    };

    source.addEventListener("heartbeat", (event) => {
      setLastEvent(event.data);
      // Verificar heartbeat para manter conexão ativa
    });

    return () => {
      wasUnmounted.current = true;
      // Limpeza: fechar o EventSource
      if (source) {
        source.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [url, sessionToken, autoReconnect, reconnectDelay, maxReconnectAttempts]);

  // Método para fechar manualmente
  const close = useCallback(() => {
    wasUnmounted.current = true;
    if (eventSource) {
      eventSource.close();
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    setStatus("closed");
    reconnectAttempts.current = 0;
  }, [eventSource, reconnectTimer.current]);

  // Retorna estado e método para fechar
  return { eventSource, status, lastEvent, close };
}

/**
 * Hook para gestão de conexão WebSocket com cleanup obrigatório.
 */
export function useWebSocket(
  url: string,
  options: {
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
    protocols?: string[];
  } = {}
) {
  const { autoReconnect = true, reconnectDelay = 3000, maxReconnectAttempts = 5, protocols } = options;
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closing" | "closed" | "failed">("connecting");
  const [lastMessage, setLastMessage] = useState<string>("" );
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasUnmounted = useRef(false);

  useEffect(() => {
    wasUnmounted.current = false;
    reconnectAttempts.current = 0;

    const ws = new WebSocket(url, protocols ?? []);
    setSocket(ws);

    ws.onopen = () => setStatus("open");
    ws.onclose = (event) => {
      console.warn(`[WebSocket] Fechada: code=${event.code}, reason=${event.reason}`);
      setStatus("closed");

      if (autoReconnect && !wasUnmounted.current && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current = 0;
          if (!wasUnmounted.current) {
            setStatus("connecting");
          }
        }, reconnectDelay);
      }
    };

    ws.onerror = (error) => {
      console.error("[WebSocket] Erro na conexão:", error);
      setStatus("failed");
    };

    ws.onmessage = (event) => {
      setLastMessage(event.data);
    };

    return () => {
      wasUnmounted.current = true;
      // Fechar WebSocket
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [url, protocols, autoReconnect, reconnectDelay, maxReconnectAttempts]);

  const send = useCallback((data: unknown) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }, [socket]);

  const close = useCallback(() => {
    wasUnmounted.current = true;
    if (socket) {
      socket.close();
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    setStatus("closed");
    reconnectAttempts.current = 0;
  }, [socket]);

  return { socket, status, lastMessage, send, close };
}

/**
 * Hook genérico de mounted para evitar operações depois de desmontado.
 */
export function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

export default {
  useInterval,
  useEventListener,
  useAbortController,
  useSSE,
  useWebSocket,
  useIsMounted,
};
