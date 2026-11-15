"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface IdleTimerContextValue {
  isIdle: boolean;
  idleTimeoutMs: number;
  triggerIdleNow: () => void;
  wakeUp: () => void;
}

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos (300.000 ms)

const IdleTimerContext = createContext<IdleTimerContextValue>({
  isIdle: false,
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  triggerIdleNow: () => {},
  wakeUp: () => {},
});

export function useIdleTimer() {
  return useContext(IdleTimerContext);
}

/**
 * Renderiza uma maquete arquitetônica minimalista em câmera lenta (rotação orbital contínua
 * com baixíssimo consumo de recursos — 20 FPS, sem sombras pesadas) durante a Tela de Descanso.
 */
function ScreenSaverOrbitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number | null = null;
    let angle = 0;
    let lastDraw = 0;

    // Vértices de um pavilhão arquitetônico minimalista ArqVértice (cubo + brises + deck)
    const vertices: Array<[number, number, number]> = [
      // Base / Deck
      [-2.2, -0.6, -1.5],
      [2.2, -0.6, -1.5],
      [2.2, -0.6, 1.5],
      [-2.2, -0.6, 1.5],
      // Volume Principal Térreo
      [-1.6, -0.6, -1.1],
      [1.6, -0.6, -1.1],
      [1.6, 0.5, -1.1],
      [-1.6, 0.5, -1.1],
      [-1.6, -0.6, 1.1],
      [1.6, -0.6, 1.1],
      [1.6, 0.5, 1.1],
      [-1.6, 0.5, 1.1],
      // Volume Superior em Balanço (Cobertura)
      [-1.9, 0.5, -1.3],
      [1.9, 0.5, -1.3],
      [1.9, 1.15, -1.3],
      [-1.9, 1.15, -1.3],
      [-1.9, 0.5, 1.3],
      [1.9, 0.5, 1.3],
      [1.9, 1.15, 1.3],
      [-1.9, 1.15, 1.3],
    ];

    const edges: Array<[number, number]> = [
      // Deck
      [0, 1], [1, 2], [2, 3], [3, 0],
      // Térreo
      [4, 5], [5, 6], [6, 7], [7, 4],
      [8, 9], [9, 10], [10, 11], [11, 8],
      [4, 8], [5, 9], [6, 10], [7, 11],
      // Cobertura em balanço
      [12, 13], [13, 14], [14, 15], [15, 12],
      [16, 17], [17, 18], [18, 19], [19, 16],
      [12, 16], [13, 17], [14, 18], [15, 19],
    ];

    const renderLoop = (now: number) => {
      animId = requestAnimationFrame(renderLoop);
      // Throttle a ~24 FPS para consumo mínimo de GPU/CPU no modo descanso
      if (now - lastDraw < 42) return;
      lastDraw = now;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      angle += 0.008;
      const cosY = Math.cos(angle);
      const sinY = Math.sin(angle);
      const pitch = 0.34;
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);

      const project = ([x, y, z]: [number, number, number]): [number, number] => {
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        const ry = y * cosX - rz * sinX;
        const rz2 = y * sinX + rz * cosX + 5.6;
        const scale = Math.min(w, h) * 0.44;
        return [w / 2 + (rx / rz2) * scale, h / 2 - (ry / rz2) * scale];
      };

      ctx.strokeStyle = "rgba(237, 229, 216, 0.38)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (const [i, j] of edges) {
        const [x1, y1] = project(vertices[i]);
        const [x2, y2] = project(vertices[j]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Pinos luminosos sutis nos vértices principais
      ctx.fillStyle = "rgba(237, 229, 216, 0.65)";
      for (const idx of [6, 10, 14, 18]) {
        const [px, py] = project(vertices[idx]);
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(renderLoop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={240}
      className="h-60 w-90 opacity-85"
    />
  );
}

export function IdleTimerProvider({
  children,
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}: {
  children: React.ReactNode;
  timeoutMs?: number;
}) {
  const [isIdle, setIsIdle] = useState(false);
  const [clockText, setClockText] = useState<string>("");
  const [dateText, setDateText] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleActivatedAtRef = useRef<number>(0);

  const updateClock = useCallback(() => {
    const now = new Date();
    setClockText(
      now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    setDateText(
      now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })
    );
  }, []);

  const resetTimer = useCallback(() => {
    // Evita fechar no mesmo milissegundo em que o botão manual "Ativar Descanso" foi clicado
    if (Date.now() - idleActivatedAtRef.current < 450) {
      return;
    }
    setIsIdle(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      idleActivatedAtRef.current = Date.now();
      updateClock();
      setIsIdle(true);
    }, timeoutMs);
  }, [timeoutMs, updateClock]);

  const triggerIdleNow = useCallback(() => {
    idleActivatedAtRef.current = Date.now();
    updateClock();
    setIsIdle(true);
  }, [updateClock]);

  const wakeUp = useCallback(() => {
    idleActivatedAtRef.current = 0;
    setIsIdle(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();

    const handleActivity = () => {
      resetTimer();
    };

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("mousedown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("wheel", handleActivity, { passive: true });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("wheel", handleActivity);
    };
  }, [resetTimer]);

  useEffect(() => {
    if (!isIdle) return;
    updateClock();
    const interval = setInterval(updateClock, 15000);
    return () => clearInterval(interval);
  }, [isIdle, updateClock]);

  return (
    <IdleTimerContext.Provider
      value={{
        isIdle,
        idleTimeoutMs: timeoutMs,
        triggerIdleNow,
        wakeUp,
      }}
    >
      {children}

      {/* TELA DE DESCANSO MINIMALISTA (SCREEN SAVER APÓS 5 MINUTOS DE INATIVIDADE) */}
      <div
        data-testid="idle-screensaver-overlay"
        onClick={wakeUp}
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black p-10 text-white transition-opacity duration-700 select-none ${
          isIdle
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isIdle}
      >
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-[#EDE5D8]/60" />
          <span>ArqVértice Studio · Eco Idle Mode</span>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="font-mono text-6xl sm:text-7xl font-light tracking-tight text-[#EDE5D8]/90">
            {clockText || "00:00"}
          </div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">
            {dateText}
          </p>
          {isIdle && <ScreenSaverOrbitCanvas />}
        </div>

        <div className="text-[11px] tracking-widest uppercase text-white/35">
          Mova o mouse ou pressione qualquer tecla para retomar
        </div>
      </div>
    </IdleTimerContext.Provider>
  );
}
