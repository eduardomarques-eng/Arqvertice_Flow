"use client";

import dynamic from "next/dynamic";
import type { Studio3DFullscreenEngineProps } from "@/engines/studio-3d/Studio3DFullscreenEngine";

const Studio3DFullscreenEngine = dynamic(
  () => import("@/engines/studio-3d/Studio3DFullscreenEngine"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#111215] text-white select-none">
        <div className="w-72 space-y-3 text-center">
          <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#EDE5D8]">
            ArqVértice 3D Studio · WebGL 2.0
          </span>
          <p className="text-sm font-semibold text-white/90">
            Inicializando Motor Híbrido PBR + Ray Tracing...
          </p>
          <p className="text-xs text-white/50">
            Ambiente 100% isolado em tela cheia (0% impacto no ERP)
          </p>
        </div>
      </div>
    ),
  }
);

export function Studio3DFullscreenLoader(props: Studio3DFullscreenEngineProps) {
  return <Studio3DFullscreenEngine {...props} />;
}
