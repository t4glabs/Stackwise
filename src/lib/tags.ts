import type { BookStackTag } from "@/lib/bookstack";

// The tag taxonomy proposed in the architecture plan. Editors set these directly on
// a Book in BookStack — no second admin panel for course configuration.
export type ParsedCourseTags = {
  publish: boolean;
  type: "SELF_PACED" | "FACILITATED" | "EXTERNAL_LINK";
  program: string | null;
  externalUrl: string | null;
  facilitatorEmail: string | null;
  durationLabel: string | null;
  order: number;
};

function findTag(tags: BookStackTag[], name: string): string | null {
  const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return tag ? tag.value : null;
}

export function parseCourseTags(tags: BookStackTag[]): ParsedCourseTags {
  const publishRaw = findTag(tags, "lms_publish");
  const typeRaw = findTag(tags, "lms_type")?.toLowerCase() ?? "self_paced";
  const orderRaw = findTag(tags, "lms_order");

  const type: ParsedCourseTags["type"] =
    typeRaw === "facilitated"
      ? "FACILITATED"
      : typeRaw === "external_link"
        ? "EXTERNAL_LINK"
        : "SELF_PACED";

  return {
    publish: publishRaw?.toLowerCase() === "true",
    type,
    program: findTag(tags, "lms_program"),
    externalUrl: findTag(tags, "lms_external_url"),
    facilitatorEmail: findTag(tags, "lms_facilitator"),
    durationLabel: findTag(tags, "lms_duration"),
    order: orderRaw ? Number.parseInt(orderRaw, 10) || 0 : 0,
  };
}
