# Design system

Source of truth for the UI. Researched from `aikyamfellows.org`, `aikyamhq.com`,
`aikyamjobs.org`, and `aikyamjobs.org/design-system`. **Update this file in the same
change as any UI work that alters a token or introduces a new pattern.** If a change
would contradict something written here, that's a signal to stop and reconcile it
deliberately, not drift.

## Two modes, one token set

The app has two kinds of pages, styled differently from the same tokens:

| | **Editorial** | **Dense (dashboard)** |
|---|---|---|
| Where | Home, course catalog, course detail, lesson reader, login/register | Learner/facilitator dashboards, all of `/admin` |
| Body font | Source Serif 4 (`font-serif`) for descriptions/prose | Figtree only, no serif |
| Page feel | Spacious — 64–96px section gaps, larger type | Compact — 24px card padding, 14px base text |
| Color | The org's accent color appears on CTAs/links | Monochrome — black/ink primary buttons, grey focus rings, color reserved for status badges |
| Cards | Hairline-shared grid (`CourseGrid`) for catalogs | Bordered `Card` (grey-200 border, white bg) |

Headings, nav, buttons, and labels are **always Figtree** in both modes — only
descriptive body copy switches to serif, and only in editorial contexts.

## Multi-tenant branding — what's configurable vs fixed

This codebase is reused across NGO deployments (separate servers, separate databases,
separate URLs). **Never hardcode an org's name, wording, or color in a component.**
Everything org-specific lives on the `Organization` row, editable at `/admin/settings`:

| Field | Used in | Notes |
|---|---|---|
| `name` | Home/catalog eyebrow, footer | The org's real-world name |
| `brandName` | Header wordmark, `<title>` | First word renders bold, rest normal — see `SiteHeader` |
| `accentColor` | Every `accent`/`accent-soft` utility | Injected as a live CSS custom property in `app/layout.tsx` `<head>` — validated with `lib/color.ts` before interpolating. Changing it takes effect immediately, no rebuild. |
| `heroHeading` / `heroDescription` | Homepage hero | |
| `wikiLinkLabel` | Footer link text | Paired with `bookstackBaseUrl` for the href |
| `logoUrl` | Header, in place of the generated mark | Admin-uploaded via `uploadBrandImage` server action, saved to `public/uploads/` (gitignored — runtime content, not source). Falls back to the generated `LogoMark` SVG when unset. |
| `faviconUrl` | Browser tab icon | Same upload path. Wired through `generateMetadata()`'s `icons` field, not a static `app/favicon.ico` swap — falls back to the static file convention when unset. |
| `CustomLink` rows (`placement: NAV \| FOOTER`) | Extra header nav items / footer links | Admin add/remove list, not a fixed-count field — `CustomLinksManager` + `addCustomLink`/`deleteCustomLink`. Each has `openInNewTab`; external links render as `<a target="_blank">`, internal ones as `next/link`. |

Everything else (grey scale, spacing, radius, semantic success/warning/danger colors,
typography scale, component shapes) is **fixed in code** — shared design language
across every deployment, not per-org.

If a future UI change needs a new org-specific string or color, add a column to
`Organization`, wire it through `/admin/settings` (`OrgSettingsForm` +
`saveOrgSettings`), and update the table above — don't hardcode it "just this once."
If it needs a *repeatable* thing (more links, more images), model it as its own table
with an `organizationId` FK, the way `CustomLink` does, rather than cramming a list
into a single column.

## Color tokens (`src/app/globals.css`)

```
--color-ink        #1f2421   text, icons, primary buttons (dense mode)
--color-grey-50..900         cool neutral scale — dense/dashboard surfaces & borders
--color-stone-200/400/600    warm neutral scale — editorial borders & secondary text
--color-cream       #fbf7f4  page background (both modes; dense cards are white on it)
--color-accent                org-configurable, defaults #7358b3 (purple)
--color-accent-soft            derived via color-mix(in srgb, accent 14%, white) — never
                                store a second hex for this, it must always follow accent
--color-success/warning/danger (+ -soft variants)   fixed, semantic only
```

Rules:
- Dense/admin surfaces use the **grey** scale + `--color-ink`. Editorial surfaces use
  the **stone** scale for secondary/tertiary text and borders.
- Accent color is for primary marketing CTAs, links, and active/selected states —
  never for large fills or dense-mode primary buttons (those stay `bg-ink`).
- Status badges use the semantic `-soft` background + solid text color, never a full
  saturated fill.

## Typography

Fonts loaded in `app/layout.tsx` via `next/font/google`:
`Figtree` → `--font-sans` (default body font) · `Source Serif 4` → `--font-serif` ·
`Geist Mono` → `--font-mono` (eyebrows, tabular numbers, technical labels only).

| Role | Size/weight | Class pattern |
|---|---|---|
| Hero H1 | 48–52px / 600 / tracking -0.01em | `text-[48px] font-semibold tracking-[-0.01em]` |
| Page H1 (catalog, admin) | 26–36px / 600 | |
| Section H2 | 22px / 600 | |
| Card title | 18px / 600 | `CardTitle` |
| Body (dense) | 14px / 400, Figtree | default |
| Body (editorial prose) | 15–17px / 400, serif, `leading-relaxed` | `font-serif` |
| Eyebrow / section label | 13px / 600 / uppercase / `tracking-[0.13em]` / `text-stone-600` | `<Eyebrow>` component — use this, don't hand-roll the classes |

## Grid & spacing

- `Container`: `max-w-[1272px]`, fluid side padding (`px-[max(4vmin,20px)]`). Always use
  this component for page-width content — never a raw `max-w-*` div.
- Lesson reader / long-form prose caps at **720px** (`max-w-[720px]`), narrower than
  the general container — matches the Aikyam prose column width.
- Spacing scale in practice: `4/8/12/16/20/24/32/40/64/96px`. Section-to-section gaps
  in editorial mode run large (`py-16`/`py-24`); dense mode stays tight (`py-12`, `gap-4`
  to `gap-6`).
- Radius: `rounded-control` = 6px (buttons, inputs, selects). `rounded-card` = 12px
  (cards, panels). Don't introduce a third radius value.

## Components

- **Header** (`SiteHeader`): transparent background (inherits page bg), 77px tall,
  real `border-b border-stone-400/70` hairline, logo (`org.logoUrl`, or the generated
  mark if unset) + two-tone wordmark from `org.brandName`, active nav link = 2px ink
  underline (`NavLink`, uses `usePathname`), then any admin-added `CustomLink` NAV
  entries after the built-in links. Logged-in identity is a role **pill badge**
  (`<Badge pill>`) + name — never plain joined text (a past bug: "Admin · Admin" read
  as broken when name happened to equal role; a badge next to text reads unambiguously
  even then).
- **Cards**: `Card` = dense-mode default (border-grey-200, `rounded-card`, `p-6`,
  subtle shadow on hover). `CourseGrid` + `CourseCard` = editorial hairline-shared
  grid — cards have **no border of their own**; the parent grid's `gap-px` +
  `bg-stone-200` background shows through as shared 1px lines. Uses
  `grid-cols-[repeat(auto-fit,minmax(340px,1fr))]`, not fixed `sm:grid-cols-2` —
  `auto-fit` collapses unused columns so a lone item fills its row instead of leaving
  an empty colored cell (a real bug we hit and fixed).
- **Buttons** (`Button`): `primary` (black, dense-mode default), `accent` (org color,
  editorial CTAs — Enroll, Browse courses, primary auth actions), `secondary`,
  `outline`, `ghost`, `destructive`, `link`. Don't add a new variant without a reason
  tied to this table.
- **Badges** (`Badge`): default shape is `rounded-sm` (4px) with a semantic soft-tint
  background — for status (Published/Hidden, Active/Completed, roles). Pass `pill` for
  the `rounded-full` grey-100 shape — for metadata/tags (duration, program name),
  never status.
- **Forms**: `Input`/`Textarea`/`Label` — white bg, `border-grey-200`, 36px height,
  grey focus ring (`ring-grey-600/40`, never colored). `Switch` — track flips grey→ink
  (never green) when on. **Radix's `Switch` doesn't reliably submit through native
  `FormData`** — always pair it with a hidden `<input type="hidden">` mirroring its
  boolean state (see `CourseConfigForm` for the pattern); this was a real bug where a
  toggle looked saved but silently wasn't.
- **Admin nav** (`AdminNav`, People sub-tabs): segmented-pill control — grey-100
  track, white active pill with `shadow-sm`. This is the dense-mode nav pattern;
  editorial pages use the header's underline style instead, not this component.
- **Tables** (admin/facilitator listings): header row `bg-grey-50`, `border-grey-200`
  row dividers, generous cell padding (`py-3.5`). Hand-rolled per page currently — if a
  fourth table shows up, promote this to a shared component.
- **`Eyebrow`**: the uppercase label component. Use above every card group, stat
  block, and section — it's a signature device across all three reference sites, not
  decoration to skip.
- **`InfoTooltip`**: a small "(i)" button that reveals a click-to-open panel (no
  Radix Popover dependency — plain state + click-outside-to-close) for explaining a
  concept that's genuinely confusing at a glance, not for restating the label. Reserve
  it for places worth a paragraph and a concrete example — the Cohorts feature (a
  concept every LMS defines differently) is the reference case: see
  `cohort-manager.tsx`, the enroll panel's cohort field, the "Cohort" table columns,
  and the Cohorts row on `/admin/flags`. Put it next to the label as a flex sibling,
  never nested inside a `<Label>` — a `<label>` forwards clicks to its associated
  control, so a button nested inside one double-fires. Also never nested inside a
  `<p>` — its panel renders a `<div>`, and a `<div>` inside a `<p>` is invalid HTML
  that causes a real hydration mismatch (the browser silently auto-closes the `<p>`
  early); use a `<div>` wrapper instead, same flex classes. The panel itself resets
  `normal-case`/`font-normal`/`tracking-normal` since it commonly ends up inside
  uppercase table headers whose text styling would otherwise cascade into it.

## When adding a new page

1. Decide editorial or dense mode from the table at the top — it determines font
   treatment, spacing scale, and card style.
2. Reach for existing primitives (`Container`, `Card`/`CourseGrid`, `Button`, `Badge`,
   `Eyebrow`) before writing new markup.
3. Any org-specific string or color goes through `Organization` + `/admin/settings`,
   not inline.
4. If you introduce a genuinely new pattern (not a variant of something above), add it
   to this file in the same change.
