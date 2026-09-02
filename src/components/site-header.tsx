import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { signOutAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { NavLink } from "@/components/nav-link";
import { MobileMenu } from "@/components/mobile-menu";
import { ExternalLink } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  LEARNER: "Learner",
  FACILITATOR: "Facilitator",
  ADMIN: "Admin",
};

const ROLE_HOME: Record<string, string> = {
  LEARNER: "/dashboard",
  FACILITATOR: "/facilitator",
  ADMIN: "/admin",
};

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="7" fill="var(--color-ink)" />
      <circle cx="17.5" cy="8.5" r="4.5" fill="var(--color-accent)" />
    </svg>
  );
}

export async function SiteHeader() {
  const [session, org] = await Promise.all([auth(), getPrimaryOrganization()]);
  const user = session?.user;
  const navLinks = await prisma.customLink.findMany({
    where: { organizationId: org.id, placement: "NAV" },
    orderBy: { order: "asc" },
  });

  // "WeLive Learning" -> bold "WeLive" + normal "Learning"; a single-word brand name
  // just renders bold on its own.
  const [firstWord, ...rest] = org.brandName.split(" ");

  const customLinkNodes = navLinks.map((link) =>
    link.openInNewTab ? (
      <a
        key={link.id}
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-[15px] font-normal text-ink/80 hover:text-ink"
      >
        {link.label}
        <ExternalLink className="size-3" />
      </a>
    ) : (
      <Link key={link.id} href={link.url} className="text-[15px] font-normal text-ink/80 hover:text-ink">
        {link.label}
      </Link>
    )
  );

  const userBlock = user ? (
    <div className="flex items-center gap-3">
      <Badge pill>{ROLE_LABEL[user.role]}</Badge>
      <span className="text-[14px] text-stone-600">{user.name}</span>
    </div>
  ) : (
    <Link href="/login" className="text-[15px] font-normal text-ink hover:text-stone-600">
      Log in
    </Link>
  );

  return (
    <header className="relative border-b border-stone-400/70">
      <Container className="flex h-[77px] items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, unknown-dimension logo
            <img src={org.logoUrl} alt="" className="h-[26px] w-auto object-contain" />
          ) : (
            <LogoMark />
          )}
          <span className="text-[20px] leading-none tracking-[0.02em]">
            <span className="font-semibold text-ink">{firstWord}</span>
            {rest.length > 0 ? (
              <span className="font-normal text-ink"> {rest.join(" ")}</span>
            ) : null}
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-8 sm:flex">
          <NavLink href="/courses">Courses</NavLink>
          {user ? <NavLink href={ROLE_HOME[user.role]}>My space</NavLink> : null}
          {customLinkNodes}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {userBlock}
          {user ? (
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Log out
              </Button>
            </form>
          ) : null}
        </div>

        <MobileMenu>
          <nav className="flex flex-col gap-3">
            <NavLink href="/courses">Courses</NavLink>
            {user ? <NavLink href={ROLE_HOME[user.role]}>My space</NavLink> : null}
            {customLinkNodes}
          </nav>
          <div className="flex flex-col gap-3 border-t border-stone-200 pt-4">
            {userBlock}
            {user ? (
              <form action={signOutAction} className="w-full">
                <Button variant="ghost" size="sm" type="submit" className="w-full justify-center">
                  Log out
                </Button>
              </form>
            ) : null}
          </div>
        </MobileMenu>
      </Container>
    </header>
  );
}
