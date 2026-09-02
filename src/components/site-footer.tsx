import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getPrimaryOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export async function SiteFooter() {
  const org = await getPrimaryOrganization();
  const footerLinks = await prisma.customLink.findMany({
    where: { organizationId: org.id, placement: "FOOTER" },
    orderBy: { order: "asc" },
  });

  return (
    <footer className="border-t border-stone-200 py-10">
      <Container className="flex flex-col gap-3 text-[13px] text-stone-600 sm:flex-row sm:items-center sm:justify-between">
        <span>{org.name}</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {footerLinks.map((link) =>
            link.openInNewTab ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.id} href={link.url} className="font-medium text-accent hover:underline">
                {link.label}
              </Link>
            )
          )}
          <span>
            Content authored in{" "}
            <a
              className="font-medium text-accent hover:underline"
              href={org.bookstackBaseUrl}
              target="_blank"
              rel="noreferrer"
            >
              {org.wikiLinkLabel}
            </a>
          </span>
        </div>
      </Container>
    </footer>
  );
}
