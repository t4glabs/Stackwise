import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { Eyebrow } from "@/components/ui/eyebrow";
import { OrgSettingsForm } from "@/components/org-settings-form";
import { BrandImageUpload } from "@/components/brand-image-upload";
import { CustomLinksManager } from "@/components/custom-links-manager";

export default async function AdminSettingsPage() {
  const session = await auth();
  const org = await getPrimaryOrganization();
  const links = await prisma.customLink.findMany({
    where: { organizationId: session!.user.organizationId },
    orderBy: { order: "asc" },
  });

  return (
    <div className="flex max-w-lg flex-col gap-10">
      <div>
        <Eyebrow className="mb-1.5">Branding</Eyebrow>
        <p className="max-w-xl text-sm text-grey-700">
          These are the only NGO-specific words, colors, and links in the whole app —
          everything else is shared code. Change them here, not in a wiki tag or a file.
        </p>
      </div>

      <OrgSettingsForm
        name={org.name}
        brandName={org.brandName}
        accentColor={org.accentColor}
        heroHeading={org.heroHeading}
        heroDescription={org.heroDescription}
        wikiLinkLabel={org.wikiLinkLabel}
      />

      <div className="flex flex-col gap-5 border-t border-grey-200 pt-8">
        <Eyebrow>Logo &amp; favicon</Eyebrow>
        <BrandImageUpload
          kind="logo"
          label="Header logo"
          hint="PNG, JPG, SVG, or WebP, under 2MB. Leave unset to use the generated mark."
          currentUrl={org.logoUrl}
          previewClassName="h-12 w-24"
        />
        <BrandImageUpload
          kind="favicon"
          label="Favicon"
          hint="PNG or ICO, under 512KB — the icon shown in the browser tab."
          currentUrl={org.faviconUrl}
          previewClassName="size-12"
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-grey-200 pt-8">
        <div>
          <Eyebrow className="mb-1.5">Navigation links</Eyebrow>
          <p className="text-xs text-grey-500">Extra links shown in the header, after Courses.</p>
        </div>
        <CustomLinksManager placement="NAV" links={links.filter((l) => l.placement === "NAV")} />
      </div>

      <div className="flex flex-col gap-4 border-t border-grey-200 pt-8">
        <div>
          <Eyebrow className="mb-1.5">Footer links</Eyebrow>
          <p className="text-xs text-grey-500">Extra links shown in the footer, next to the wiki link.</p>
        </div>
        <CustomLinksManager placement="FOOTER" links={links.filter((l) => l.placement === "FOOTER")} />
      </div>
    </div>
  );
}
