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
      className={`surface rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}
