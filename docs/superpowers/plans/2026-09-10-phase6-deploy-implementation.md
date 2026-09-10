# Phase 6 — Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo ready for Cloudflare Pages deployment — an SPA fallback rule, a pinned Node version, a GitHub Actions CI status check, and a written manual runbook — with no app code changes.

**Architecture:** Three additive, independent files: `kb-app/public/_redirects` (SPA fallback, copied into every build's `dist/` by Vite), `kb-app/.nvmrc` + `.github/workflows/ci.yml` (Node version pin consumed by the new CI workflow), and `docs/DEPLOY.md` (the manual Cloudflare Pages dashboard steps the user performs themselves — no Cloudflare account access exists from this session). No dependencies, no build-config changes, no files under `kb-app/src/` touched.

**Tech Stack:** GitHub Actions (`actions/checkout`, `actions/setup-node`), plain YAML, plain text/Markdown. No new npm packages.

**Spec:** `docs/superpowers/specs/2026-09-10-phase6-deploy-design.md`

## Global Constraints

- No app code changes — nothing under `kb-app/src/` is touched. This whole plan is additive config/CI/docs.
- SPA fallback file is exactly `/* /index.html 200` in `kb-app/public/_redirects` (spec Section 1) — Vite copies `public/` verbatim into `dist/`, so no `vite.config.ts` change is needed.
- Node version is pinned to `22` in `kb-app/.nvmrc` (spec Section 2) — read by the CI workflow via `actions/setup-node`'s `node-version-file` input. The equivalent `NODE_VERSION=22` Cloudflare Pages dashboard setting is a manual step documented in `docs/DEPLOY.md`, not something this plan can set (no Cloudflare account access).
- The CI workflow file must live at `.github/workflows/ci.yml` (repository root) — GitHub only discovers workflows there, never inside `kb-app/`.
- CI workflow triggers on `push` and `pull_request` against `master` only (spec Section 3); working directory for every `npm` step is `kb-app` (the app is a subdirectory of the repo, not the repo root).
- CI runs exactly these four commands, in this order, and no others: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` (spec Section 3 — this is a status check only, it deploys nothing and holds no Cloudflare/Supabase credentials).
- `docs/DEPLOY.md` must name the exact Cloudflare Pages dashboard fields from spec Section 4: root directory `kb-app`, build command `npm run build`, output directory `dist`, `NODE_VERSION=22`, and must explicitly say `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are optional and left unset for now.
- After every task, the existing pipeline (`npm run typecheck && npm run lint && npm run test && npm run build`, run from `kb-app/`) must stay green and unchanged from its pre-task baseline — none of this plan's files fall inside any of those globs.
- This plan's scope ends at "the repo is ready for the user's manual Cloudflare Pages setup" — connecting the actual Cloudflare Pages project, and confirming the first live deploy, is an explicit residual manual step (spec Definition of Done), not a task in this plan.

---

### Task 1: SPA fallback — `kb-app/public/_redirects`

**Files:**
- Create: `kb-app/public/_redirects`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the file itself, verified present in `dist/` after a build — Task 3's `docs/DEPLOY.md` references this file by name when explaining why deep-link routes work on Cloudflare Pages.

There is no unit-test framework for a static asset copy — Vite's `public/`→`dist/` copy behavior is a documented, unconfigurable Vite feature, not new code. The verification here is a direct build-output check instead of a Vitest test (matches the spec's Testing section: "no new unit tests... nothing to add to the Vitest suite").

- [ ] **Step 1: Write the file**

Create `kb-app/public/_redirects` with exactly this content (no trailing content beyond the newline):

```
/* /index.html 200
```

- [ ] **Step 2: Build and verify the file is copied through**

From `kb-app/`, run:

```bash
npm run build
cat dist/_redirects
```

Expected: the build succeeds, and `dist/_redirects` exists with exactly the one line `/* /index.html 200`.

- [ ] **Step 3: Verify no regression to the existing pipeline**

From `kb-app/`, run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: all four succeed, same pass/fail shape as before this file existed (438 tests passing, build green) — this file lives outside every glob these commands touch.

- [ ] **Step 4: Commit**

```bash
git add kb-app/public/_redirects
git commit -m "feat: add SPA fallback redirect for Cloudflare Pages"
```

---

### Task 2: CI workflow — Node pin + GitHub Actions

**Files:**
- Create: `kb-app/.nvmrc`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `kb-app/.nvmrc`'s Node version string, referenced by name (`22`) in Task 3's `docs/DEPLOY.md` as the value to set for Cloudflare Pages' `NODE_VERSION` env var.

No Vitest tests here either — a GitHub Actions workflow is validated by YAML correctness and by the fact that its four commands are the exact ones already verified green on this branch, not by a unit test.

- [ ] **Step 1: Write the Node version pin**

Create `kb-app/.nvmrc` with exactly:

```
22
```

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/ci.yml` with exactly this content:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: kb-app/.nvmrc
          cache: npm
          cache-dependency-path: kb-app/package-lock.json

      - name: Install dependencies
        working-directory: kb-app
        run: npm ci

      - name: Typecheck
        working-directory: kb-app
        run: npm run typecheck

      - name: Lint
        working-directory: kb-app
        run: npm run lint

      - name: Test
        working-directory: kb-app
        run: npm run test

      - name: Build
        working-directory: kb-app
        run: npm run build
```

- [ ] **Step 3: Validate the YAML**

From the repository root, run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid yaml')" 2>/dev/null || node -e "
const fs = require('fs');
const content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
// Fallback structural check for when no local YAML parser (PyYAML) is
// available: every one of these keys must be present verbatim.
['on:', 'jobs:', 'runs-on:', 'steps:', 'actions/checkout@v4', 'actions/setup-node@v4'].forEach(k => {
  if (!content.includes(k)) { console.error('MISSING: ' + k); process.exit(1); }
});
console.log('structural check passed');
"
```

Expected: `valid yaml` (if Python+PyYAML is available) or `structural check passed` (fallback). Either output confirms the file has no syntax errors and contains the expected keys. (This workflow's actual first live run can only be watched once the branch reaches GitHub and Actions executes it — see the plan's residual manual step; this step is a local sanity check only.)

- [ ] **Step 4: Verify no regression to the existing pipeline**

From `kb-app/`, run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: all four succeed, unchanged from baseline — `.nvmrc` and `.github/` sit outside every existing glob.

- [ ] **Step 5: Commit**

```bash
git add kb-app/.nvmrc .github/workflows/ci.yml
git commit -m "feat: add CI workflow (typecheck/lint/test/build) and pin Node version"
```

---

### Task 3: Manual deploy runbook — `docs/DEPLOY.md`

**Files:**
- Create: `docs/DEPLOY.md`

**Interfaces:**
- Consumes: the exact file/value names from Tasks 1–2 (`_redirects`, `.nvmrc`'s `22`, the four CI commands) — this task documents them, it doesn't change them.
- Produces: nothing consumed by other tasks — this is the terminal deliverable of the plan, read by the user (a human, not code).

No test framework applies to a Markdown runbook. Verification is a content checklist against the spec, not an automated check.

- [ ] **Step 1: Write the runbook**

Create `docs/DEPLOY.md` with exactly this content:

```markdown
# Deploying kb-app to Cloudflare Pages

One-time manual setup. After this, every push to `master` auto-deploys to
production, and every pull request gets its own preview URL — both handled
by Cloudflare Pages' own git integration, independent of the repo's
`.github/workflows/ci.yml` status check.

## One-time setup

1. Go to the Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → select this GitHub repository.
2. Build settings:
   - **Root directory:** `kb-app` (the repo root is not the app root)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Environment variables (set for **Production**, and **Preview** too if
   you want preview deploys to match):
   - `NODE_VERSION` = `22` (matches `kb-app/.nvmrc`)
   - `VITE_SUPABASE_URL` — **optional, leave unset for now.** The app
     already treats a missing Supabase configuration as "signed out,
     sync inert" (see `kb-app/src/lib/supabase.ts`) — nothing breaks
     without it. Add it later, whenever you create a real Supabase
     project, then trigger a redeploy so the new build picks it up.
   - `VITE_SUPABASE_ANON_KEY` — same as above, optional, leave unset for
     now.
4. Save and deploy. Cloudflare Pages assigns a URL automatically, shown
   in the Pages dashboard, in the form `<project-name>.pages.dev`.

## Why the SPA fallback matters

This app uses React Router's `BrowserRouter`, so a direct link or a
refresh on any non-root path (e.g. `/settings`) must be served
`index.html` with a 200 status, not a host default 404 — the router then
takes over client-side. `kb-app/public/_redirects` (`/* /index.html 200`)
handles this automatically; Cloudflare Pages reads it natively from the
build output with no dashboard configuration needed.

## Rolling back

Cloudflare Pages dashboard → your project → **Deployments** → find a
previous deployment → re-promote it to production. No extra
configuration needed — this is a built-in Cloudflare Pages feature.

## Adding a custom domain (later, optional)

Not needed to go live — the free `<project-name>.pages.dev` subdomain
works immediately. If you get a custom domain later: Pages project →
**Custom domains** → **Add a domain** → follow Cloudflare's DNS
instructions there.

## What CI does vs. what Cloudflare Pages does

These are two independent systems watching the same GitHub repository:

- **`.github/workflows/ci.yml`** (GitHub Actions) — runs
  `typecheck`/`lint`/`test`/`build` on every push and pull request against
  `master`. This is a status check only; it does not deploy anything and
  holds no Cloudflare credentials.
- **Cloudflare Pages' git integration** (set up above) — runs its own
  `npm run build` and actually deploys the result, to production on
  pushes to `master` and to a preview URL on pull requests.

A red CI check does not block a Cloudflare Pages preview from building,
and vice versa — for a single-maintainer repo, both being visible on a
pull request is enough; check both before merging.
```

- [ ] **Step 2: Review against the spec checklist**

Read `docs/DEPLOY.md` back and confirm by inspection:
- Root directory `kb-app`, build command `npm run build`, output directory `dist` are all named exactly.
- `NODE_VERSION` = `22` is named, matching `kb-app/.nvmrc` from Task 2.
- Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are explicitly called out as optional/unset-for-now.
- The rollback method and the custom-domain-later note are both present.
- No `TBD`/`TODO`/placeholder text anywhere in the file.

- [ ] **Step 3: Verify no regression to the existing pipeline**

From `kb-app/`, run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: all four succeed, unchanged from baseline — `docs/DEPLOY.md` sits outside every existing glob.

- [ ] **Step 4: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add Cloudflare Pages deploy runbook"
```

---

## Definition of Done (whole plan)

- `kb-app/public/_redirects` exists with exactly `/* /index.html 200`; `npm run build` produces `dist/_redirects` with that content.
- `kb-app/.nvmrc` exists with exactly `22`.
- `.github/workflows/ci.yml` exists, is valid YAML, triggers on push/PR to `master`, and runs `npm run typecheck && npm run lint && npm run test && npm run build` (working directory `kb-app`) via `actions/setup-node` reading `kb-app/.nvmrc`.
- `docs/DEPLOY.md` exists with no placeholders, naming the exact Cloudflare Pages dashboard fields from the spec.
- `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`) all green, unchanged from the pre-plan baseline (438 tests passing).
- No files under `kb-app/src/` touched.
- **Explicitly deferred, not part of this plan's Definition of Done:** connecting the Cloudflare Pages project in the dashboard and confirming the first live deploy succeeds — no Cloudflare account access exists from this session. Likewise, watching the first real GitHub Actions run go green is deferred — no `gh` CLI or working GitHub API access exists from this session. Both are one-time steps for the user, using `docs/DEPLOY.md` (Task 3) and the pushed branch's Actions tab respectively.
