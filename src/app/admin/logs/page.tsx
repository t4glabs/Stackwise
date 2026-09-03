import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LOG_TYPES, LOG_TYPE_LABELS, type LogType } from "@/lib/log";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 100;

const LEVEL_TABS = [
  { key: "errors", label: "Errors only" },
  { key: "all", label: "All activity" },
] as const;

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/admin/logs?${qs}` : "/admin/logs";
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; type?: string; q?: string; page?: string }>;
}) {
  const { level: levelParam, type: typeParam, q: qParam, page: pageParam } = await searchParams;
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const activeLevel = levelParam === "all" ? "all" : "errors";
  const activeType = LOG_TYPES.includes(typeParam as LogType) ? (typeParam as LogType) : undefined;
  const q = (qParam ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.EventLogWhereInput = {
    organizationId,
    ...(activeLevel === "errors" ? { level: "ERROR" } : {}),
    ...(activeType ? { type: activeType } : {}),
    ...(q ? { email: { contains: q } } : {}),
  };

  const [logs, totalCount] = await Promise.all([
    prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    prisma.eventLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const baseParams = { level: levelParam, type: typeParam, q: qParam };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <Eyebrow className="mb-1.5">Troubleshooting</Eyebrow>
        <p className="max-w-2xl text-sm text-grey-700">
          Logins, emails, verification links, and content syncs that failed — or, with
          &ldquo;All activity&rdquo;, the successful ones too. Entries older than 60 days are
          removed automatically.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex w-fit gap-1 rounded-control bg-grey-100 p-1 text-sm font-medium">
          {LEVEL_TABS.map((t) => (
            <Link
              key={t.key}
              href={buildHref({ ...baseParams, level: t.key === "all" ? "all" : undefined })}
              className={cn(
                "shrink-0 rounded-control px-3.5 py-1.5 transition-colors",
                activeLevel === t.key ? "bg-white text-ink shadow-sm" : "text-grey-600 hover:text-ink"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <form action="/admin/logs" method="get" className="flex items-center gap-2">
          {levelParam ? <input type="hidden" name="level" value={levelParam} /> : null}
          {typeParam ? <input type="hidden" name="type" value={typeParam} /> : null}
          <Input
            type="search"
            name="q"
            defaultValue={qParam ?? ""}
            placeholder="Search by email…"
            className="h-9 w-56"
          />
          <Button type="submit" variant="ghost" size="sm">
            Search
          </Button>
        </form>
      </div>

      <nav className="flex flex-wrap gap-1.5 text-sm">
        <Link
          href={buildHref({ ...baseParams, type: undefined })}
          className={cn(
            "rounded-full px-3 py-1 font-medium transition-colors",
            !activeType ? "bg-ink text-white" : "bg-grey-100 text-grey-600 hover:text-ink"
          )}
        >
          All types
        </Link>
        {LOG_TYPES.map((t) => (
          <Link
            key={t}
            href={buildHref({ ...baseParams, type: t })}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              activeType === t ? "bg-ink text-white" : "bg-grey-100 text-grey-600 hover:text-ink"
            )}
          >
            {LOG_TYPE_LABELS[t]}
          </Link>
        ))}
      </nav>

      {logs.length === 0 ? (
        <p className="text-sm text-grey-600">
          {activeLevel === "errors" ? "No errors logged in this range — good sign." : "Nothing logged yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                <th className="px-5 py-3">Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">What happened</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-grey-200 align-top last:border-0 hover:bg-grey-50/60">
                  <td className="whitespace-nowrap px-5 py-3.5 text-grey-600">
                    {log.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <Badge variant={log.level === "ERROR" ? "danger" : "neutral"}>
                        {LOG_TYPE_LABELS[log.type as LogType] ?? log.type}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-grey-700">
                    {log.user?.name ?? log.email ?? <span className="text-grey-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-ink">
                    <p>{log.message}</p>
                    {log.detail ? (
                      <p className="mt-0.5 max-w-xl truncate font-mono text-[12px] text-grey-500" title={log.detail}>
                        {log.detail}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-grey-600">
          <span>
            Page {page} of {totalPages} ({totalCount} entries)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildHref({ ...baseParams, page: String(page - 1) })}
                className="font-medium text-accent hover:underline"
              >
                Newer
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildHref({ ...baseParams, page: String(page + 1) })}
                className="font-medium text-accent hover:underline"
              >
                Older
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
