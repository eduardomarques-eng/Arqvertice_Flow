"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = readonly [string, string] | readonly [string, string, number];

const ROOT_PATHS = new Set(["/admin", "/equipe", "/portal"]);

export function SidebarNav({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname();

  return (
    <div className="space-y-0.5">
      {links.map(([label, href, badge]) => {
        const isActive =
          pathname === href || (!ROOT_PATHS.has(href) && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center justify-between rounded-xl px-3 py-2 text-[13.5px] tracking-tight transition-all duration-150 ease-out ${
              isActive
                ? "bg-zinc-900/[0.06] dark:bg-white/[0.11] font-semibold text-zinc-950 dark:text-white ring-1 ring-inset ring-zinc-900/[0.06] dark:ring-white/[0.08]"
                : "font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900/[0.035] dark:hover:bg-white/[0.05] hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <span className="truncate">{label}</span>
            <span className="inline-flex items-center gap-1.5">
              {typeof badge === "number" && badge > 0 && (
                <span className="rounded-full bg-[#B45309] dark:bg-[#F59E0B] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:text-[#18181B] tabular-nums">
                  {badge}
                </span>
              )}
              <span
                className={`text-xs transition-all duration-150 ${
                  isActive
                    ? "text-zinc-700 dark:text-zinc-200 opacity-100"
                    : "text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                }`}
              >
                →
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
