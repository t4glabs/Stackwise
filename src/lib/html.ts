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
