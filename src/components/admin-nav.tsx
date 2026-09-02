"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/flags", label: "Feature flags" },
  { href: "/admin/settings", label: "Settings" },
];

// Segmented control — the dashboard-mode nav pattern (grey-100 track, white active
// pill) rather than underline tabs, matching the compact/dense admin surfaces.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-fit gap-1 rounded-control bg-grey-100 p-1 text-sm font-medium">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-control px-3.5 py-1.5 transition-colors",
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
