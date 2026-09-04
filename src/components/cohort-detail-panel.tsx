"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addCohortMemberAction,
  removeCohortMemberAction,
  createAndAddCohortMember,
  attachCourseToCohortAction,
  detachCourseFromCohortAction,
  searchCohortCandidates,
  type CohortCandidate,
} from "@/lib/actions/cohort-membership-actions";
import type { CreateUserState } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ProgressBar } from "@/components/progress-bar";
import { Search, UserPlus, X } from "lucide-react";

export type CohortMemberRow = { id: string; name: string; identifier: string };
export type CohortCourseRow = {
  id: string;
  title: string;
  enrolledCount: number;
  completedCount: number;
  // Only true when this course's own detail page is reachable by whoever's viewing
  // this panel — admins get a link, facilitators (who can't reach /admin/courses)
  // just see the title as plain text.
  linkable: boolean;
};

// Reused as-is by both /admin/cohorts/[id] (admin, any cohort) and
// /facilitator/cohorts/[id] (a cohort-restricted facilitator, their own cohort only)
// — every action here re-checks canManageCohort server-side regardless of which page
// mounted it, so there's nothing route-specific to get wrong.
export function CohortDetailPanel({
  cohortId,
  members,
  courses,
  availableCourses,
  emailOptional,
}: {
  cohortId: string;
  members: CohortMemberRow[];
  courses: CohortCourseRow[];
  availableCourses: { id: string; title: string }[];
  emailOptional: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <MembersSection cohortId={cohortId} members={members} emailOptional={emailOptional} />
      <CoursesSection cohortId={cohortId} courses={courses} availableCourses={availableCourses} />
    </div>
  );
}

function MembersSection({
  cohortId,
  members,
  emailOptional,
}: {
  cohortId: string;
  members: CohortMemberRow[];
  emailOptional: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Eyebrow>Members ({members.length})</Eyebrow>
        {!showAdd ? (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <UserPlus className="size-4" /> Add member
          </Button>
        ) : null}
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-grey-600">
          No members yet — add one below. Every course this cohort follows will enroll them
          automatically.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-grey-200 rounded-card border border-grey-200 bg-white">
          {members.map((member) => (
            <MemberRow key={member.id} cohortId={cohortId} member={member} />
          ))}
        </ul>
      )}

      {showAdd ? (
        <AddMemberPanel cohortId={cohortId} emailOptional={emailOptional} onDone={() => setShowAdd(false)} />
      ) : null}
    </div>
  );
}

function MemberRow({ cohortId, member }: { cohortId: string; member: CohortMemberRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{member.name}</span>
        <span className="truncate font-mono text-xs text-grey-500">{member.identifier}</span>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeCohortMemberAction(cohortId, member.id);
            if (result && !result.ok) setError(result.error);
          })
        }
        className="shrink-0 text-grey-500 hover:text-danger disabled:opacity-50"
        aria-label={`Remove ${member.name} from this cohort`}
        title="Removes them from the cohort only — doesn't un-enroll them from anything"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function AddMemberPanel({
  cohortId,
  emailOptional,
  onDone,
}: {
  cohortId: string;
  emailOptional: boolean;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CohortCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    startSearch(async () => {
      const res = await searchCohortCandidates(cohortId, q);
      if ("error" in res) {
        setSearchError(res.error);
        setResults(null);
      } else {
        setSearchError(null);
        setResults(res);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Add a member</p>
        <button type="button" onClick={onDone} className="text-xs font-medium text-grey-600 hover:text-ink">
          Close
        </button>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username, or email…"
          className="flex-1"
        />
        <Button type="submit" variant="outline" disabled={searching}>
          <Search className="size-4" /> Search
        </Button>
      </form>

      {searchError ? <p className="text-xs text-danger">{searchError}</p> : null}

      {results ? (
        results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-grey-200 rounded-control border border-grey-200 bg-white">
            {results.map((learner) => (
              <CandidateRow
                key={learner.id}
                cohortId={cohortId}
                learner={learner}
                onAdded={() => setResults((r) => r?.filter((l) => l.id !== learner.id) ?? null)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-grey-600">
            No match.{" "}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="font-medium text-accent hover:underline"
            >
              Add them as a new learner
            </button>{" "}
            instead.
          </p>
        )
      ) : null}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          Can&apos;t find them — add as a new learner
        </button>
      ) : (
        <CreateAndAddForm cohortId={cohortId} emailOptional={emailOptional} />
      )}
    </Card>
  );
}

function CandidateRow({
  cohortId,
  learner,
  onAdded,
}: {
  cohortId: string;
  learner: CohortCandidate;
  onAdded: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{learner.name}</span>
        <span className="truncate font-mono text-xs text-grey-500">{learner.identifier}</span>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
      {done ? (
        <span className="shrink-0 text-xs font-medium text-success">Added</span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await addCohortMemberAction(cohortId, learner.id, undefined);
              if (result && !result.ok) {
                setError(result.error);
              } else {
                setDone(true);
                onAdded();
              }
            })
          }
        >
          {pending ? "Adding…" : "Add"}
        </Button>
      )}
    </li>
  );
}

function CreateAndAddForm({ cohortId, emailOptional }: { cohortId: string; emailOptional: boolean }) {
  const action = createAndAddCohortMember.bind(null, cohortId);
  const [state, formAction, pending] = useActionState<CreateUserState, FormData>(action, undefined);
  const [email, setEmail] = useState("");
  const showUsernameField = emailOptional && email.trim() === "";

  return (
    <form action={formAction} className="flex flex-col gap-2.5 border-t border-grey-200 pt-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-member-name" className="text-xs">
          Full name
        </Label>
        <Input id="new-member-name" name="name" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-member-email" className="text-xs">
          Email{emailOptional ? " (optional)" : ""}
        </Label>
        <Input
          id="new-member-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={!emailOptional}
        />
      </div>
      {showUsernameField ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-member-username" className="text-xs">
            Username
          </Label>
          <Input id="new-member-username" name="username" placeholder="e.g. first name + initial" required />
        </div>
      ) : null}

      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-xs text-success">
          Created — login: {state.identifier}, password: {state.password}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Adding…" : "Create & add to cohort"}
      </Button>
    </form>
  );
}

function CoursesSection({
  cohortId,
  courses,
  availableCourses,
}: {
  cohortId: string;
  courses: CohortCourseRow[];
  availableCourses: { id: string; title: string }[];
}) {
  const [showAttach, setShowAttach] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Eyebrow>Courses ({courses.length})</Eyebrow>
        {!showAttach && availableCourses.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setShowAttach(true)}>
            + Attach a course
          </Button>
        ) : null}
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-grey-600">
          Not following any courses yet — attach one below and every current member gets enrolled
          right away.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-grey-200 rounded-card border border-grey-200 bg-white">
          {courses.map((course) => (
            <CourseRow key={course.id} cohortId={cohortId} course={course} />
          ))}
        </ul>
      )}

      {showAttach ? (
        <AttachCoursePanel
          cohortId={cohortId}
          availableCourses={availableCourses}
          onDone={() => setShowAttach(false)}
        />
      ) : null}
    </div>
  );
}

function CourseRow({ cohortId, course }: { cohortId: string; course: CohortCourseRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const percent = course.enrolledCount ? (course.completedCount / course.enrolledCount) * 100 : 0;

  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {course.linkable ? (
          <a href={`/admin/courses/${course.id}`} className="truncate font-medium text-accent hover:underline">
            {course.title}
          </a>
        ) : (
          <span className="truncate font-medium text-ink">{course.title}</span>
        )}
        <span className="text-xs text-grey-500">
          {course.enrolledCount} enrolled, {course.completedCount} completed
        </span>
        <ProgressBar percent={percent} className="max-w-40" />
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await detachCourseFromCohortAction(cohortId, course.id);
            if (result && !result.ok) setError(result.error);
          })
        }
        className="shrink-0 text-grey-500 hover:text-danger disabled:opacity-50"
        aria-label={`Stop following ${course.title}`}
        title="Stops future auto-enrollment — doesn't un-enroll current members"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function AttachCoursePanel({
  cohortId,
  availableCourses,
  onDone,
}: {
  cohortId: string;
  availableCourses: { id: string; title: string }[];
  onDone: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Attach a course</p>
        <button type="button" onClick={onDone} className="text-xs font-medium text-grey-600 hover:text-ink">
          Close
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="h-9 rounded-control border border-grey-200 bg-white px-3 text-sm text-ink"
        >
          <option value="">Choose a course…</option>
          {availableCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button
          type="button"
          size="sm"
          disabled={pending || !courseId}
          className="self-start"
          onClick={() =>
            startTransition(async () => {
              const result = await attachCourseToCohortAction(cohortId, courseId, undefined);
              if (result && !result.ok) setError(result.error);
              else onDone();
            })
          }
        >
          {pending ? "Attaching…" : "Attach"}
        </Button>
      </div>
    </Card>
  );
}
