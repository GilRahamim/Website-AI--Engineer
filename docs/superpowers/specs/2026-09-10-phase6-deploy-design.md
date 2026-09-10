# Phase 6 — Deploy: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** nothing new — the app already builds to static output (`kb-app/dist`) with graceful no-Supabase-configured behavior (`lib/supabase.ts`'s `getSupabase()` returns `null` when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are absent). No live Supabase project is required for this sub-project.
**Scope boundary:** Phase 6 of `site-build-docs/00-BUILD-README.md` ("פריסה ל־Cloudflare Pages / Netlify, משתני סביבה, דומיין, בדיקות"). This is the final phase — everything in Phase 5 (Auth, schema+RLS, sync engine, sync wiring) is functionally complete and merging separately.

## Goal

Get the built PWA live on the public internet at a stable HTTPS URL, with a CI gate that catches regressions before they ship, and a written runbook for the one-time manual account setup — with zero ongoing maintenance burden for a single-user personal project.

## Out of scope

- A live Supabase project or real env var values (deploy proceeds with sync inert — the app already handles this; the user creates a project and adds env vars to Cloudflare Pages themselves, whenever they choose to).
- A custom domain (decided during brainstorming: ship on the free `*.pages.dev` subdomain now; a domain can be pointed at it later with zero redeploy).
- Any server-side code, edge functions, or Cloudflare Workers — the app is fully static (`vite build` output), so none of Cloudflare Pages' Functions features are needed.
- Netlify (decided during brainstorming: Cloudflare Pages chosen — free tier, native SPA fallback, git-connected auto-deploy).

## Section 1: SPA fallback

The app uses `BrowserRouter` (`src/main.tsx`), so a direct navigation or refresh on any non-root path (e.g. `/topic/xyz`, `/settings`) must be served `index.html` with a 200, not a host default 404 — the router then takes over client-side.

**New file:** `kb-app/public/_redirects`:
```
/* /index.html 200
```
Vite copies everything under `public/` into `dist/` verbatim, so this lands at `dist/_redirects` on every build with no build-config change. Cloudflare Pages reads this file natively (same syntax it shares with Netlify) — no dashboard configuration needed for this part.

## Section 2: Node version pinning

Neither `package.json` (no `engines` field) nor the repo currently pins a Node version. Both the new CI workflow and the Cloudflare Pages build environment need to agree with each other and with local dev to avoid drift (e.g. a future Node major bumping a transitive dependency's behavior in only one environment).

**New file:** `kb-app/.nvmrc`:
```
22
```
(Current Node LTS as of this writing.) The CI workflow reads this file via `actions/setup-node`'s `node-version-file` input; the Cloudflare Pages dashboard setup (Section 4) sets the equivalent `NODE_VERSION=22` build environment variable by hand, since Pages has no `.nvmrc`-reading integration.

## Section 3: CI workflow

**New file:** `.github/workflows/ci.yml` (repository root — GitHub only recognizes workflows there, not inside `kb-app/`).

- **Triggers:** `push` and `pull_request` against `master`.
- **Single job**, steps: checkout → `actions/setup-node` with `node-version-file: kb-app/.nvmrc` and npm caching (`cache: npm`, `cache-dependency-path: kb-app/package-lock.json`) → `npm ci` (working directory `kb-app`) → `npm run typecheck && npm run lint && npm run test && npm run build` (working directory `kb-app`).
- This is a **status check only** — it does not deploy anything and has no Cloudflare/Supabase credentials. Cloudflare Pages' own git integration (Section 4) triggers independently on the same pushes and does its own `npm run build`; the two are intentionally decoupled so a CI failure is visible as a PR check without blocking Cloudflare Pages from building a preview.
- Every command it runs (`typecheck`, `lint`, `test`, `build`) has already been verified green on this repo (see Definition of Done); this workflow's only job is to keep them that way on every future push, this being a single-maintainer repo with no branch-protection UI decision needed for v1.

## Section 4: Cloudflare Pages setup (manual runbook)

**New file:** `docs/DEPLOY.md`. Since no Cloudflare account/API access exists from this session, these are steps the user performs by hand, one time, in the Cloudflare dashboard:

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → select this GitHub repo.
2. Build settings: **Root directory** `kb-app` (repo root is not the app root); **Build command** `npm run build`; **Build output directory** `dist`.
3. Environment variables (Production, and Preview if desired): `NODE_VERSION` = `22` (matches `.nvmrc`, Section 2). `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — **left unset for now**; documented as an optional later step once a real Supabase project exists (Phase 5's auth/sync code already treats their absence as "signed out, sync inert," per golden rule 3 — no app behavior changes when they're added later, just a redeploy is needed for the new build to pick them up).
4. Save and deploy. Cloudflare Pages then auto-deploys every push to `master` to production, and every PR gets its own preview URL — both from its own build step, independent of the GitHub Actions check in Section 3.
5. (Optional, later) Custom domain: Pages project → Custom domains → add domain → follow Cloudflare's DNS instructions. Not needed now (Section: Out of scope).

`docs/DEPLOY.md` also documents: where to find the live URL after step 4 (Cloudflare assigns `<project-name>.pages.dev` automatically, shown in the Pages dashboard), and how to roll back (Cloudflare Pages dashboard → Deployments → re-promote a previous deployment — built-in, no extra config needed).

## Error handling / edge cases

- **Deploy with no Supabase env vars:** already handled by existing code (`getSupabase()` → `null`); no new error handling needed. Verified by the fact that `npm run build` already succeeds with no `.env` present in this worktree.
- **CI failing on a PR:** surfaces as a normal GitHub PR status check; does not block Cloudflare Pages from building its own preview deploy (the two systems are independent, per Section 3) — a broken preview and a red CI check can coexist, which is fine for a single-maintainer repo; either is visible before merging.
- **Cloudflare Pages build failing** (e.g. wrong root directory): the dashboard shows the build log directly; `docs/DEPLOY.md`'s exact settings (Section 4) are the fix for the most likely misconfiguration (root directory defaulting to repo root instead of `kb-app`).

## Testing

- `npm run build` (already verified green on this branch) — after adding `public/_redirects`, re-run and confirm `dist/_redirects` exists with the exact content above.
- `.github/workflows/ci.yml` — validate as YAML; confirm the four commands it runs match exactly what's already been verified green (`typecheck`, `lint`, `test`, `build`) with no new flags or behavior. Actually watching a real Actions run go green is a manual step for the user after this branch is on GitHub (no `gh` CLI or working GitHub API access from this session — see residual note in Definition of Done).
- No new unit tests: this sub-project adds no app logic (config/CI/docs only), so there is nothing to add to the Vitest suite. The existing 438 tests must stay green (no app code is touched).
- Manual (post-account-setup, by the user): open the deployed `*.pages.dev` URL; hard-refresh on a deep link (e.g. `/settings`) to confirm the SPA fallback works; toggle light/dark and RTL sanity-check (no new UI is added by this sub-project, but this is the first time the built PWA is checked outside `localhost`); confirm the PWA installs and the service worker registers over real HTTPS (only testable off `localhost`, unlike every prior phase's manual checks).

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green in `kb-app/` (no app code changed by this sub-project, so this should be a no-op confirmation).
- `dist/_redirects` present with the correct content after a build.
- `.github/workflows/ci.yml` present, valid YAML, running the four checks above on push/PR to `master`.
- `docs/DEPLOY.md` written with no placeholders, matching the exact Cloudflare Pages dashboard fields named in Section 4.
- **Residual manual step, explicitly not part of this sub-project's automation:** the user connects the Cloudflare Pages project (Section 4) and confirms the first real deploy succeeds — this cannot be done or verified from this session (no Cloudflare account access, no working GitHub API/`gh` CLI to watch the resulting Actions run). The implementation plan's tasks end at "repo is ready for that step," not at "site is live."
