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
    neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
    red: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
