import type { ReactNode } from "react";

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="apple-page-title">{title}</h1>{description ? <p className="apple-body mt-1.5 max-w-2xl text-zinc-600 dark:text-zinc-400">{description}</p> : null}</div>{action}</div>;
}
