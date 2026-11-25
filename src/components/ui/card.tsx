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
      className={`surface rounded-2xl border border-zinc-200/75 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out dark:border-zinc-800/80 dark:bg-[#141419] dark:shadow-[0_1px_3px_rgba(0,0,0,0.28),0_12px_28px_-14px_rgba(0,0,0,0.55)] ${className}`}
    >
      {children}
    </section>
  );
}
