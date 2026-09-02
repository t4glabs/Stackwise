import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { AddPersonPanel } from "@/components/add-person-panel";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { createFacilitatorAction, createLearnerAction } from "@/lib/actions/user-actions";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "learners", label: "Learners", role: "LEARNER" as const },
  { key: "facilitators", label: "Facilitators", role: "FACILITATOR" as const },
  { key: "admins", label: "Admins", role: "ADMIN" as const },
];

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bulkError?: string }>;
}) {
  const { tab: tabParam, bulkError } = await searchParams;
  const activeTab = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  const session = await auth();
  const organizationId = session!.user.organizationId;
  const flags = await getFlags(organizationId);

  const users = await prisma.user.findMany({
    where: { organizationId, role: activeTab.role },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav className="flex w-fit min-w-0 max-w-full gap-1 overflow-x-auto rounded-control bg-grey-100 p-1 text-sm font-medium">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/people?tab=${t.key}`}
            className={cn(
              "shrink-0 rounded-control px-4 py-1.5 transition-colors",
              t.key === activeTab.key ? "bg-white text-ink shadow-sm" : "text-grey-600 hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {bulkError ? (
        <div className="rounded-card border border-danger/30 bg-danger-soft px-5 py-3 text-sm text-danger">
          {bulkError}
        </div>
      ) : null}

      {activeTab.role !== "ADMIN" ? (
        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Add a {activeTab.role === "LEARNER" ? "learner" : "facilitator"}</CardTitle>
            <CardDescription>
              {activeTab.role === "LEARNER"
                ? "One at a time, or all at once from a spreadsheet."
                : "Part-time consultants who run courses."}
            </CardDescription>
          </div>
          {activeTab.role === "LEARNER" ? (
            <AddPersonPanel
              role="LEARNER"
              action={createLearnerAction}
              personLabel="Learner"
              emailOptional={flags.learner_email_optional}
            />
          ) : (
            <AddPersonPanel
              role="FACILITATOR"
              action={createFacilitatorAction}
              personLabel="Facilitator"
              emailOptional={flags.facilitator_email_optional}
            />
          )}
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <Eyebrow>
          {activeTab.label} ({users.length})
        </Eyebrow>
        {users.length === 0 ? (
          <p className="text-sm text-grey-600">No {activeTab.label.toLowerCase()} yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3">Added</th>
                  {activeTab.role !== "ADMIN" ? <th className="px-5 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-grey-200 last:border-0 hover:bg-grey-50/60">
                    <td className="px-5 py-3.5 font-medium text-ink">{user.name}</td>
                    <td className="px-4 py-3.5 font-mono text-[13px] text-grey-700">
                      <span className="flex items-center gap-2">
                        {user.email ?? user.username}
                        {user.email ? <Badge pill>email</Badge> : null}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-grey-600">{user.createdAt.toLocaleDateString()}</td>
                    {activeTab.role !== "ADMIN" ? (
                      <td className="px-5 py-3.5 text-right">
                        {user.id !== session!.user.id ? <ResetPasswordButton userId={user.id} /> : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
