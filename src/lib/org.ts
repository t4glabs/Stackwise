import { prisma } from "@/lib/prisma";

// Single-tenant today (see architecture plan, section 06): one Organization row per
// deployment. Kept as a real lookup rather than a hardcoded constant so a future
// multi-tenant version only has to change how the org is resolved, not every caller.
export async function getPrimaryOrganization() {
  const slug = process.env.ORG_SLUG ?? "welive";
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw new Error(
      `No organization found for slug "${slug}". Run \`npm run db:seed\` first.`
    );
  }
  return org;
}
