"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = readonly [string, string];

const ROOT_PATHS = new Set(["/admin", "/equipe", "/portal"]);

export function SidebarNav({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {links.map(([label, href]) => {
        const isActive =
          pathname === href || (!ROOT_PATHS.has(href) && pathname.startsWith(href));
        const is3D = label === "3D Viewer";
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm tracking-tight transition-colors duration-150 ${
              isActive
                ? "bg-[#EDE5D8]/85 dark:bg-white/15 font-semibold text-[#18181B] dark:text-[#EDE5D8]"
                : "font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {is3D && <span aria-hidden="true">🧊</span>}
              <span>{label}</span>
            </span>
            <span
              className={`text-xs transition-transform duration-150 ${
                isActive
                  ? "text-[#18181B] dark:text-[#EDE5D8]"
                  : "text-slate-400 group-hover:translate-x-0.5"
              }`}
            >
              →
            </span>
          </Link>
        );
      })}
    </div>
  );
}
