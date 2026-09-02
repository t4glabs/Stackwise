import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";

const ROLE_LABEL: Record<string, string> = {
  LEARNER: "Learner",
  FACILITATOR: "Facilitator",
  ADMIN: "Admin",
};

const ROLE_HOME: Record<string, string> = {
  LEARNER: "/dashboard",
  FACILITATOR: "/facilitator",
  ADMIN: "/admin/flags",
};

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-grey-200 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-ink">WeLive</span>
          <span className="text-sm font-medium text-grey-600">Learning</span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium text-grey-800">
          <Link href="/courses" className="hover:text-ink">
            Courses
          </Link>

          {user ? (
            <>
              <Link href={ROLE_HOME[user.role]} className="hover:text-ink">
                My space
              </Link>
              <span className="flex items-center gap-2">
                <Badge variant="accent">{ROLE_LABEL[user.role]}</Badge>
                <span className="text-grey-700">{user.name}</span>
              </span>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <Button variant="primary" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          )}
        </nav>
      </Container>
    </header>
  );
}
