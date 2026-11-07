"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editScheduleStageAction } from "@/app/actions/domain-actions";

export function StageProgressControl({ stageId, initialValue }: { stageId: string; initialValue: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(nextValue: number) {
    const completion = Math.max(0, Math.min(100, Math.round(nextValue)));
    setValue(completion);
    setError(null);
    startTransition(async () => {
      try {
        await editScheduleStageAction(stageId, { completion });
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível salvar o progresso.");
      }
    });
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <input
          aria-label="Progresso da etapa"
          type="range"
          min="0"
          max="100"
          value={value}
          disabled={pending}
          onChange={(event) => setValue(Number(event.target.value))}
          onPointerUp={(event) => save(Number(event.currentTarget.value))}
          onKeyUp={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") save(Number(event.currentTarget.value));
          }}
          className="min-w-0 flex-1 accent-blue-600"
        />
        <span className="w-10 text-right text-xs font-semibold text-slate-700">{value}%</span>
      </div>
      {error ? <p className="mt-1 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
