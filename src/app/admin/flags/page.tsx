import { auth } from "@/auth";
import { getFlags, FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/flags";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { FlagToggle } from "@/components/flag-toggle";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export default async function AdminFlagsPage() {
  const session = await auth();
  const flags = await getFlags(session!.user.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-1.5">Modules</Eyebrow>
        <p className="max-w-xl text-sm text-grey-700">
          Turn modules on or off for this organization. Changes take effect immediately —
          disabled features are hidden from the nav and their routes refuse the request.
        </p>
      </div>

      <Card className="divide-y divide-grey-200 p-0">
        {(Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => {
          const flag = FEATURE_FLAGS[key];
          const example = "example" in flag ? flag.example : null;
          return (
            <div key={key} className="flex items-center justify-between gap-6 px-6 py-4">
              <div>
                {/* div, not p — InfoTooltip's popover renders a div, and a div inside a
                    p tag is invalid HTML that causes a hydration mismatch (the browser
                    auto-closes the p early). See DESIGN_SYSTEM.md's InfoTooltip note. */}
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {flag.label}
                  {example ? (
                    <InfoTooltip label={`More about ${flag.label}`}>
                      {example.split("\n\n").map((para, i) => (
                        <p key={i} className={i > 0 ? "mt-2" : undefined}>
                          {para}
                        </p>
                      ))}
                    </InfoTooltip>
                  ) : null}
                </div>
                <p className="text-sm text-grey-600">{flag.description}</p>
              </div>
              <FlagToggle flagKey={key} enabled={flags[key]} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}
