import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { Eyebrow } from "@/components/ui/eyebrow";
import { OrgSettingsForm } from "@/components/org-settings-form";
import { BrandImageUpload } from "@/components/brand-image-upload";
import { CustomLinksManager } from "@/components/custom-links-manager";
import { SyncNowButton } from "@/components/sync-now-button";

export default async function AdminSettingsPage() {
  const session = await auth();
  const org = await getPrimaryOrganization();
  const links = await prisma.customLink.findMany({
    where: { organizationId: session!.user.organizationId },
    orderBy: { order: "asc" },
  });

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Eyebrow className="mb-1.5">Content sync</Eyebrow>
        <SyncNowButton />
        <p className="text-xs text-grey-500">
          New and edited books, chapters, and pages sync from your wiki automatically —
          a webhook picks up changes as they happen, with a cron job as backup every
          20 minutes (see DEPLOY.md). Use this button to pull the latest content right
          now instead of waiting, e.g. right after editing the wiki.
        </p>
      </div>

      {/* Two columns on wide screens: the editable text/color fields on the left,
          uploads and repeatable link lists — a different kind of input — grouped
          together on the right, instead of one long single-file stack. */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 border-t border-grey-200 pt-8 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <div>
            <Eyebrow className="mb-1.5">Branding</Eyebrow>
            <p className="text-sm text-grey-700">
              These are the only NGO-specific words, colors, and links in the whole app —
              everything else is shared code. Change them here, not in a wiki tag or a
              file.
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
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
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

          <div className="flex flex-col gap-4 border-t border-grey-200 pt-6">
            <div>
              <Eyebrow className="mb-1.5">Navigation links</Eyebrow>
              <p className="text-xs text-grey-500">Extra links shown in the header, after Courses.</p>
            </div>
            <CustomLinksManager placement="NAV" links={links.filter((l) => l.placement === "NAV")} />
          </div>

          <div className="flex flex-col gap-4 border-t border-grey-200 pt-6">
            <div>
              <Eyebrow className="mb-1.5">Footer links</Eyebrow>
              <p className="text-xs text-grey-500">Extra links shown in the footer, next to the wiki link.</p>
            </div>
            <CustomLinksManager placement="FOOTER" links={links.filter((l) => l.placement === "FOOTER")} />
          </div>
        </div>
      </div>
    </div>
  );
}
