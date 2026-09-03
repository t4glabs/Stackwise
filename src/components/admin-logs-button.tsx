"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

// Deliberately not one of AdminNav's segmented tabs — troubleshooting logs aren't a
// content-management section like Courses/People/Settings, they're a standalone tool
// you jump into and back out of, so it gets its own button off to the side instead.
export function AdminLogsButton() {
  const pathname = usePathname();
  const active = pathname.startsWith("/admin/logs");

  return (
    <Link
      href="/admin/logs"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-control border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-grey-300 bg-white text-ink hover:bg-grey-50"
      )}
    >
      <ScrollText className="size-4" />
      Logs
    </Link>
  );
}
