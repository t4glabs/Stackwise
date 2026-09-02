"use client";

import { useActionState, useState, useTransition } from "react";
import {
  searchEnrollableLearners,
  assignLearnerToCourse,
  createAndEnrollLearner,
  type EnrollableLearner,
} from "@/lib/actions/course-roster-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, UserPlus } from "lucide-react";

export type EnrollableCohort = { id: string; name: string };

export function EnrollLearnerPanel({
  courseId,
  coursePath,
  emailOptional,
  cohorts = [],
}: {
  courseId: string;
  coursePath: string;
  emailOptional: boolean;
  cohorts?: EnrollableCohort[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EnrollableLearner[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  // Picked once per panel session — applies whichever way you enroll someone next
  // (search-and-pick or create-new), rather than asking twice.
  const [cohortId, setCohortId] = useState("");

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    startSearch(async () => {
      const res = await searchEnrollableLearners(courseId, q);
      if ("error" in res) {
        setSearchError(res.error);
        setResults(null);
      } else {
        setSearchError(null);
        setResults(res);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Enroll a learner
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-grey-200 bg-grey-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Enroll a learner</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResults(null);
            setQuery("");
            setShowCreate(false);
          }}
          className="text-xs font-medium text-grey-600 hover:text-ink"
        >
          Close
        </button>
      </div>

      {cohorts.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="enroll-cohort" className="text-xs">
            Cohort (optional)
          </Label>
          <select
            id="enroll-cohort"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="h-9 rounded-control border border-grey-200 bg-white px-3 text-sm text-ink"
          >
            <option value="">No cohort</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <form onSubmit={runSearch} className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username, or email…"
          className="flex-1"
        />
        <Button type="submit" size="sm" variant="outline" disabled={searching}>
          <Search className="size-4" /> {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {searchError ? <p className="text-xs text-danger">{searchError}</p> : null}

      {results ? (
        results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-grey-200 rounded-control border border-grey-200 bg-white">
            {results.map((learner) => (
              <LearnerResultRow
                key={learner.id}
                learner={learner}
                courseId={courseId}
                coursePath={coursePath}
                cohortId={cohortId || null}
                onEnrolled={() => setResults((r) => r?.filter((l) => l.id !== learner.id) ?? null)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-grey-600">
            No match in the system yet — add them as a new learner below.
          </p>
        )
      ) : null}

      <div className="border-t border-grey-200 pt-3">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Can&apos;t find them — add as a new learner
          </button>
        ) : (
          <CreateAndEnrollForm
            courseId={courseId}
            coursePath={coursePath}
            emailOptional={emailOptional}
            cohortId={cohortId || null}
          />
        )}
      </div>
    </div>
  );
}

function LearnerResultRow({
  learner,
  courseId,
  coursePath,
  cohortId,
  onEnrolled,
}: {
  learner: EnrollableLearner;
  courseId: string;
  coursePath: string;
  cohortId: string | null;
  onEnrolled: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{learner.name}</span>
        <span className="truncate text-xs text-grey-500">{learner.email ?? learner.username}</span>
      </span>
      {done ? (
        <span className="shrink-0 text-xs font-medium text-success">Enrolled</span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await assignLearnerToCourse(learner.id, courseId, coursePath, cohortId);
              if (result && !result.ok) {
                setError(result.error);
              } else {
                setDone(true);
                onEnrolled();
              }
            })
          }
        >
          {pending ? "Enrolling…" : "Enroll"}
        </Button>
      )}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </li>
  );
}

function CreateAndEnrollForm({
  courseId,
  coursePath,
  emailOptional,
  cohortId,
}: {
  courseId: string;
  coursePath: string;
  emailOptional: boolean;
  cohortId: string | null;
}) {
  const action = createAndEnrollLearner.bind(null, courseId, coursePath);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [email, setEmail] = useState("");
  const showUsernameField = emailOptional && email.trim() === "";

  if (state?.ok) {
    return (
      <div className="rounded-control border border-success/30 bg-success-soft p-3 text-sm">
        <p className="font-medium text-ink">Created and enrolled — share these with them:</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
          <dt className="text-grey-700">Login</dt>
          <dd className="text-ink">{state.identifier}</dd>
          <dt className="text-grey-700">Password</dt>
          <dd className="text-ink">{state.password}</dd>
        </dl>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      {cohortId ? <input type="hidden" name="cohortId" value={cohortId} /> : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-learner-name" className="text-xs">
          Full name
        </Label>
        <Input id="new-learner-name" name="name" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-learner-email" className="text-xs">
          Email{emailOptional ? " (optional)" : ""}
        </Label>
        <Input
          id="new-learner-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={!emailOptional}
        />
      </div>
      {showUsernameField ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-learner-username" className="text-xs">
            Username
          </Label>
          <Input id="new-learner-username" name="username" placeholder="e.g. first name + initial" required />
        </div>
      ) : null}
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create & enroll"}
      </Button>
    </form>
  );
}
