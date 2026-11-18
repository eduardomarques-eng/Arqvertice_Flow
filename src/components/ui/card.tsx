import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  id,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  onClick?: () => void;
}) {
  return (
    <section
      id={id}
      onClick={onClick}
      className={`surface rounded-2xl border border-slate-200/95 bg-white p-5 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.14),0_2px_6px_-1px_rgba(15,23,42,0.06)] dark:border-zinc-700/80 dark:bg-[#141419] dark:shadow-[0_16px_38px_-10px_rgba(0,0,0,0.75)] ${className}`}
    >
      {children}
    </section>
  );
}
