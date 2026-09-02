import { Container } from "@/components/ui/container";
import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Container className="flex flex-col gap-8 py-12">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Admin</h1>
        <p className="mt-1 text-[14px] text-grey-600">
          Content editing stays in your wiki, like always. Courses, people, and settings
          all live here.
        </p>
      </div>
      <AdminNav />
      {children}
    </Container>
  );
}
