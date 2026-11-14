"use client";

import dynamic from "next/dynamic";
import type { SketchfabShowcaseViewerProps } from "@/engines/sketchfab-viewer/SketchfabShowcaseViewer";

const SketchfabShowcaseViewer = dynamic(
  () =>
    import("@/engines/sketchfab-viewer/SketchfabShowcaseViewer").then(
      (mod) => mod.SketchfabShowcaseViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[440px] w-full animate-pulse rounded-2xl border border-slate-200/60 bg-[#EDE5D8]/60" />
    ),
  }
);

export function AcervoShowcaseClientCard(props: SketchfabShowcaseViewerProps) {
  return <SketchfabShowcaseViewer {...props} />;
}
