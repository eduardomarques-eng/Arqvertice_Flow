"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const StageFormModal = dynamic(
  () => import("./stage-form-modal").then((mod) => mod.StageFormModal),
  { ssr: false }
);

export function ScheduleStageCreateForm({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-[0.98]"
      >
        <span>+</span> Nova Etapa
      </button>

      <StageFormModal
        projectId={projectId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
