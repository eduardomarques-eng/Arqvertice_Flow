import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
  className?: string;
}) {
  const tones = {
    neutral:
      "bg-zinc-100/90 text-zinc-700 ring-1 ring-inset ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-200 dark:ring-zinc-700/80",
    blue:
      "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-800/70",
    green:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/70",
    amber:
      "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/70",
    red:
      "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/70 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800/70",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-tight tabular-nums ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
