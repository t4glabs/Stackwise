export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base) return base;

  // Non-Latin input (e.g. a program name written only in Devanagari) strips down to
  // nothing above — every such name would otherwise collide on the same empty slug
  // and silently merge into one row under the [organizationId, slug] unique
  // constraint. Fall back to a short hash of the original input instead: deterministic
  // (repeat calls for the same name still upsert the same row), but distinct inputs
  // land on distinct slugs.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return `untitled-${Math.abs(hash).toString(36)}`;
}
