import { auth } from "@/auth";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { AdminNav } from "@/components/admin-nav";
import { AdminLogsButton } from "@/components/admin-logs-button";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  const flags = await getFlags(session!.user.organizationId);

  return (
    <Container className="flex flex-col gap-8 py-12">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Admin</h1>
        <p className="mt-1 text-[14px] text-grey-600">
          Content editing stays in your wiki, like always. Courses, people, and settings
          all live here.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminNav cohortsEnabled={flags.cohorts} />
        <AdminLogsButton />
      </div>
      {children}
    </Container>
  );
}
