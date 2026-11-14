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
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm tracking-tight transition-colors duration-150 ${
              isActive
                ? "bg-[#EDE5D8]/80 font-semibold text-[#18181B]"
                : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <span>{label}</span>
            <span
              className={`text-xs transition-transform duration-150 ${
                isActive
                  ? "text-[#18181B]"
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
