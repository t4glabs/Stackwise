// Guards the accent color CSS injection point in app/layout.tsx — this value comes
// from the database (admin-editable in /admin/settings), so it's validated before
// being interpolated into a raw <style> tag.
export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
