"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE_TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/people", label: "People" },
];

const COHORTS_TAB = { href: "/admin/cohorts", label: "Cohorts" };

const SETTINGS_TAB = { href: "/admin/settings", label: "Settings" };

// Segmented control — the dashboard-mode nav pattern (grey-100 track, white active
// pill) rather than underline tabs, matching the compact/dense admin surfaces.
export function AdminNav({ cohortsEnabled }: { cohortsEnabled: boolean }) {
  const pathname = usePathname();
  // Same "hidden from the nav, route refuses the request" rule every other flag
  // follows (see lib/flags.ts) — the /admin/cohorts page itself also 404s when this
  // flag is off, so this isn't the only thing enforcing it, just keeping the nav honest.
  const tabs = cohortsEnabled ? [...BASE_TABS, COHORTS_TAB, SETTINGS_TAB] : [...BASE_TABS, SETTINGS_TAB];

  return (
    <nav className="flex w-fit min-w-0 max-w-full gap-1 overflow-x-auto rounded-control bg-grey-100 p-1 text-sm font-medium">
      {tabs.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-control px-3.5 py-1.5 transition-colors",
              active ? "bg-white text-ink shadow-sm" : "text-grey-600 hover:text-ink"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
