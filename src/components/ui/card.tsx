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
    <section id={id} onClick={onClick} className={`surface rounded-2xl p-5 ${className}`}>
      {children}
    </section>
  );
}
