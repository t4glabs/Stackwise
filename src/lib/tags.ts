import type { BookStackTag } from "@/lib/bookstack";

export type CourseType = "SELF_PACED" | "FACILITATED" | "EXTERNAL_LINK";

export type ParsedCourseTags = {
  publish: boolean;
  type: CourseType;
  program: string | null;
  externalUrl: string | null;
  facilitatorEmail: string | null;
  durationLabel: string | null;
  order: number;
  downloadable: boolean;
  certificate: boolean;
};

function findTag(tags: BookStackTag[], name: string): string | null {
  const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return tag ? tag.value : null;
}

// Read once, when a book is first discovered by the sync engine (see src/lib/sync.ts) —
// lets a book that already has legacy lms_* tags show up pre-filled in /admin/courses.
// After that first discovery, the LMS's own DB is the source of truth for these fields;
// see buildLmsTags() below for the (one-way, LMS -> BookStack) opposite direction.
export function parseCourseTags(tags: BookStackTag[]): ParsedCourseTags {
  const publishRaw = findTag(tags, "lms_publish");
  const typeRaw = findTag(tags, "lms_type")?.toLowerCase() ?? "self_paced";
  const orderRaw = findTag(tags, "lms_order");

  const type: CourseType =
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
    downloadable: findTag(tags, "lms_downloadable")?.toLowerCase() === "true",
    certificate: findTag(tags, "lms_certificate")?.toLowerCase() === "true",
  };
}

const TYPE_TAG_VALUE: Record<CourseType, string> = {
  SELF_PACED: "self_paced",
  FACILITATED: "facilitated",
  EXTERNAL_LINK: "external_link",
};

// The plain-language form in /admin/courses is what admins actually edit. This turns
// that saved config back into lms_* tags purely so a wiki editor browsing BookStack
// can see what's configured — BookStack never reads these back into the LMS.
export function buildLmsTags(course: {
  published: boolean;
  type: CourseType;
  programName: string | null;
  externalUrl: string | null;
  facilitatorNames: string[];
  durationLabel: string | null;
  order: number;
  downloadable: boolean;
  certificate: boolean;
}): BookStackTag[] {
  const tags: BookStackTag[] = [
    { name: "lms_publish", value: course.published ? "true" : "false" },
    { name: "lms_type", value: TYPE_TAG_VALUE[course.type] },
    { name: "lms_downloadable", value: course.downloadable ? "true" : "false" },
    { name: "lms_certificate", value: course.certificate ? "true" : "false" },
  ];

  if (course.programName) tags.push({ name: "lms_program", value: course.programName });
  if (course.type === "EXTERNAL_LINK" && course.externalUrl) {
    tags.push({ name: "lms_external_url", value: course.externalUrl });
  }
  if (course.facilitatorNames.length > 0) {
    tags.push({ name: "lms_facilitator", value: course.facilitatorNames.join(", ") });
  }
  if (course.durationLabel) tags.push({ name: "lms_duration", value: course.durationLabel });
  if (course.order) tags.push({ name: "lms_order", value: String(course.order) });

  return tags;
}
