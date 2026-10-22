import DOMPurify from "isomorphic-dompurify";

// BookStack page/chapter HTML is arbitrary rich text we render via
// dangerouslySetInnerHTML. A wide table shouldn't be able to push the whole page
// into horizontal scroll — but forcing the <table> itself to `display: block` (the
// naive CSS-only fix) breaks its actual grid layout, since <thead>/<tr>/<td> keep
// their table-specific display roles with nothing to anchor them to. Wrapping each
// table in a scrollable div keeps the table's real layout intact and scopes the
// scroll to just the table. Assumes non-nested tables, which matches what BookStack's
// WYSIWYG editor produces.
export function wrapTablesForScroll(html: string): string {
  return html.replace(/<table/g, '<div class="table-scroll"><table').replace(/<\/table>/g, "</table></div>");
}

// BookStack content is authored by whoever has wiki edit access there — a separate,
// potentially broader population than this app's own ADMIN/FACILITATOR accounts — so
// it's untrusted input as far as this app's own trust boundary is concerned. Every
// place that renders BookStack HTML via dangerouslySetInnerHTML must go through this
// first; it strips scripts, event handlers, and anything else that isn't ordinary
// rich-text markup before the browser ever sees it.
//
// USE_PROFILES: {html:true} alone is doing the real work here — DOMPurify rebuilds
// its allowed-attribute set entirely from the profile whenever USE_PROFILES is set,
// which includes `style`/`id`/`width`/`height`/`data-*` (all confirmed in real
// BookStack content here — table column widths and heading anchors both rely on
// `style`/`id`) while still excluding event-handler attributes (onclick/onerror/etc)
// by design, since those were never part of the profile's own list. Passing
// ALLOWED_ATTR alongside USE_PROFILES would be silently ignored by DOMPurify (the
// profile always wins), so don't add one back expecting it to narrow anything —
// use ADD_TAGS/ADD_ATTR instead if a future need (e.g. allowing <iframe> embeds,
// stripped entirely by the html profile today) requires widening this.
export function sanitizeBookstackHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    // Scoped separately from ALLOWED_ATTR above and still fully respected: blocks
    // javascript:/data: URIs in href/src regardless of the profile's own attribute
    // allowlist.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  });
}

// Single entry point for rendering BookStack HTML anywhere in this app: sanitize
// first (removing anything script-executing), then apply the cosmetic table-scroll
// wrapping — in that order, since wrapping only adds a benign wrapper div and should
// never run on content that hasn't been sanitized yet.
export function renderBookstackHtml(html: string): string {
  return wrapTablesForScroll(sanitizeBookstackHtml(html));
}
