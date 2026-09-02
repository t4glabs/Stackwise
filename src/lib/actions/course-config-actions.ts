"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { buildLmsTags, type CourseType } from "@/lib/tags";
import { bookstackIsConfigured, updateBookTags } from "@/lib/bookstack";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can change course configuration.");
  }
  return session.user;
}

export type SaveCourseConfigState =
  | { ok: true; tagSyncFailed: boolean }
  | { ok: false; error: string }
  | undefined;

export async function saveCourseConfig(
  courseId: string,
  _prevState: SaveCourseConfigState,
  formData: FormData
): Promise<SaveCourseConfigState> {
  await requireAdmin();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { ok: false, error: "Course not found." };

  const published = formData.get("published") === "on";
  const type = (formData.get("type") as CourseType) ?? "SELF_PACED";
  const programName = String(formData.get("program") ?? "").trim() || null;
  const durationLabel = String(formData.get("duration") ?? "").trim() || null;
  const externalUrl = String(formData.get("externalUrl") ?? "").trim() || null;
  const facilitatorIds = formData.getAll("facilitatorIds").map(String);
  const downloadableWorkbook = type !== "EXTERNAL_LINK" && formData.get("downloadableWorkbook") === "on";

  if (type === "EXTERNAL_LINK" && !externalUrl) {
    return { ok: false, error: "An external link course needs a link." };
  }

  let programId: string | null = null;
  if (programName) {
    const program = await prisma.program.upsert({
      where: {
        organizationId_slug: { organizationId: course.organizationId, slug: slugify(programName) },
      },
      create: { organizationId: course.organizationId, name: programName, slug: slugify(programName) },
      update: { name: programName },
    });
    programId = program.id;
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      published,
      type,
      programId,
      durationLabel,
      externalUrl: type === "EXTERNAL_LINK" ? externalUrl : null,
      downloadableWorkbook,
    },
  });

  await prisma.courseFacilitator.deleteMany({
    where: { courseId, facilitatorId: { notIn: facilitatorIds } },
  });
  for (const facilitatorId of facilitatorIds) {
    await prisma.courseFacilitator.upsert({
      where: { courseId_facilitatorId: { courseId, facilitatorId } },
      create: { courseId, facilitatorId },
      update: {},
    });
  }

  let tagSyncFailed = false;
  if (bookstackIsConfigured()) {
    try {
      const facilitators = facilitatorIds.length
        ? await prisma.user.findMany({ where: { id: { in: facilitatorIds } } })
        : [];
      await updateBookTags(
        course.bookstackBookId,
        buildLmsTags({
          published,
          type,
          programName,
          externalUrl: type === "EXTERNAL_LINK" ? externalUrl : null,
          facilitatorNames: facilitators.map((f) => f.name),
          durationLabel,
          order: course.order,
          downloadable: downloadableWorkbook,
        })
      );
    } catch {
      // Non-fatal: the DB save above already succeeded and is what actually governs
      // the app. Surface a warning so the admin knows BookStack wasn't updated.
      tagSyncFailed = true;
    }
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${course.slug}`);

  return { ok: true, tagSyncFailed };
}
