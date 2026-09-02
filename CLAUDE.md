@AGENTS.md

# Stackwise

An LMS wrapper around BookStack, built to be reused across NGO deployments — each on
its own server/database/URL. See `DEPLOY.md` for infra and `DESIGN_SYSTEM.md` for the
UI system.

**Always read `DESIGN_SYSTEM.md` before UI work in this project, and update it in the
same change if you introduce or change a token, component pattern, or convention.**
Treat drift between the doc and the code as a bug.

Org-specific branding (name, colors, hero copy, wiki link text) lives on the
`Organization` DB row and is edited at `/admin/settings` — never hardcode an NGO's
name or brand color in a component. See the "Multi-tenant branding" section of
`DESIGN_SYSTEM.md`.
