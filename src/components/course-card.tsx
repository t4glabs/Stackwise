import Link from "next/link";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_LABEL: Record<string, string> = {
  SELF_PACED: "Self-paced",
  FACILITATED: "Facilitated",
  EXTERNAL_LINK: "External course",
};

export function CourseCard({
  slug,
  title,
  description,
  type,
  durationLabel,
  programName,
}: {
  slug: string;
  title: string;
  description: string | null;
  type: string;
  durationLabel: string | null;
  programName?: string | null;
}) {
  return (
    <Link href={`/courses/${slug}`} className="block">
      <Card className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">{TYPE_LABEL[type] ?? type}</Badge>
          {programName ? <Badge variant="neutral">{programName}</Badge> : null}
          {durationLabel ? <Badge variant="neutral">{durationLabel}</Badge> : null}
        </div>
        <CardTitle>{title}</CardTitle>
        {description ? (
          <CardDescription className="line-clamp-3">{description}</CardDescription>
        ) : null}
      </Card>
    </Link>
  );
}
