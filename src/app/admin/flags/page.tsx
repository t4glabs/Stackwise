import { auth } from "@/auth";
import { getFlags, FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/flags";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { FlagToggle } from "@/components/flag-toggle";

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
        {(Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => (
          <div key={key} className="flex items-center justify-between gap-6 px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">{FEATURE_FLAGS[key].label}</p>
              <p className="text-sm text-grey-600">{FEATURE_FLAGS[key].description}</p>
            </div>
            <FlagToggle flagKey={key} enabled={flags[key]} />
          </div>
        ))}
      </Card>
    </div>
  );
}
