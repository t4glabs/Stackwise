// Thin typed client for the BookStack REST API. BookStack stays the source of truth
// for all *content* (text, structure, attachments). LMS *configuration* (published,
// delivery type, program, duration, facilitators) is owned by our own DB and edited
// in plain language in /admin/courses — we only write lms_* tags back to BookStack
// afterwards so a wiki editor can see it, never the other way around. See
// src/lib/tags.ts for the two-way mapping and src/lib/sync.ts for discovery.

export type BookStackTag = { name: string; value: string };

export type BookStackBookSummary = {
  id: number;
  name: string;
  slug: string;
  description: string;
  updated_at: string;
  cover?: { url: string } | null;
};

export type BookStackContentsPage = {
  type: "page";
  id: number;
  name: string;
  slug: string;
  chapter_id?: number;
  priority: number;
};

export type BookStackContentsChapter = {
  type: "chapter";
  id: number;
  name: string;
  slug: string;
  priority: number;
  pages: BookStackContentsPage[];
};

export type BookStackBookDetail = BookStackBookSummary & {
  tags: BookStackTag[];
  contents: (BookStackContentsChapter | BookStackContentsPage)[];
};

export type BookStackPageDetail = {
  id: number;
  book_id: number;
  chapter_id: number;
  name: string;
  slug: string;
  html: string;
  updated_at: string;
};

export type BookStackChapterDetail = {
  id: number;
  name: string;
  description_html: string;
};

class BookStackConfigError extends Error {}
export class BookStackApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function getConfig() {
  const baseUrl = process.env.BOOKSTACK_BASE_URL;
  const tokenId = process.env.BOOKSTACK_TOKEN_ID;
  const tokenSecret = process.env.BOOKSTACK_TOKEN_SECRET;

  if (!baseUrl) {
    throw new BookStackConfigError("BOOKSTACK_BASE_URL is not set");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), tokenId, tokenSecret };
}

// True once a real service-account token has been added to .env. Until then the
// catalog falls back to seeded placeholder data — see prisma/seed.ts.
export function bookstackIsConfigured() {
  const { tokenId, tokenSecret } = getConfig();
  return Boolean(tokenId && tokenSecret);
}

async function bookstackFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const { baseUrl, tokenId, tokenSecret } = getConfig();
  if (!tokenId || !tokenSecret) {
    throw new BookStackConfigError(
      "BOOKSTACK_TOKEN_ID / BOOKSTACK_TOKEN_SECRET are not set"
    );
  }

  const res = await fetch(`${baseUrl}/api${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Token ${tokenId}:${tokenSecret}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    // Content changes when an editor saves in BookStack; the sync route (webhook +
    // scheduled poll) is what refreshes our index, so we don't need Next's own cache here.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new BookStackApiError(
      `BookStack API ${path} failed: ${res.status} ${res.statusText}`,
      res.status
    );
  }

  return res.json() as Promise<T>;
}

export async function listAllBooks(): Promise<BookStackBookSummary[]> {
  const pageSize = 100;
  const all: BookStackBookSummary[] = [];
  let offset = 0;

  for (;;) {
    const page = await bookstackFetch<{ data: BookStackBookSummary[]; total: number }>(
      `/books?count=${pageSize}&offset=${offset}`
    );
    all.push(...page.data);
    offset += pageSize;
    if (offset >= page.total || page.data.length === 0) break;
  }

  return all;
}

export async function getBook(id: number): Promise<BookStackBookDetail> {
  return bookstackFetch<BookStackBookDetail>(`/books/${id}`);
}

export async function getPage(id: number): Promise<BookStackPageDetail> {
  return bookstackFetch<BookStackPageDetail>(`/pages/${id}`);
}

// The chapter's own intro text isn't included in GET /books/{id}'s contents array —
// it needs this separate call. sync.ts calls it once per chapter, not once per page.
export async function getChapter(id: number): Promise<BookStackChapterDetail> {
  return bookstackFetch<BookStackChapterDetail>(`/chapters/${id}`);
}

// Writes the given lms_* tags onto a book, preserving any other (non-lms_) tags that
// are already there. Best-effort by design — callers should catch failures and still
// keep the LMS-side save, since our own DB is what actually governs app behavior.
export async function updateBookTags(id: number, lmsTags: BookStackTag[]): Promise<void> {
  const current = await getBook(id);
  const preserved = current.tags.filter((t) => !t.name.toLowerCase().startsWith("lms_"));

  await bookstackFetch(`/books/${id}`, {
    method: "PUT",
    body: { tags: [...preserved, ...lmsTags] },
  });
}
