# Deploying kb-app to Cloudflare

One-time manual setup. After this, every push to `master` auto-deploys to
production — handled by Cloudflare's own git integration, independent of
the repo's `.github/workflows/ci.yml` status check.

**Note:** Cloudflare has merged its old separate "Pages" dashboard flow
into one unified "Workers" creation flow. It deploys via a small config
file (`kb-app/wrangler.jsonc`, already committed in this repo) instead of
a "build output directory" field — the steps below match this current
flow, not the older Pages-only dashboard.

## One-time setup

1. Go to the Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Connect to Git** → select this GitHub repository (`Website-AI--Engineer`)
   → continue to the **"Set up your application"** screen.
2. On that screen:
   - **Project name:** whatever you like (this becomes part of your
     `<project-name>.pages.dev` URL) — the default (derived from the repo
     name) is fine. Whatever you pick must match `name` in
     `kb-app/wrangler.jsonc` exactly, or Cloudflare overrides it at
     deploy time with a warning — that file is already set to
     `website-ai--engineer` to match the default; if you typed a
     different project name, update `wrangler.jsonc`'s `name` to match
     and push.
   - **Build command:** `npm run build`
   - **Deploy command:** leave the default, `npx wrangler deploy` — this
     reads `kb-app/wrangler.jsonc` (already in the repo) to know what to
     serve; no changes needed here.
3. Expand **Advanced settings**:
   - **Path:** `kb-app` (the repo root is not the app root — this tells
     Cloudflare to run the build command from `kb-app/`, where
     `wrangler.jsonc` and `package.json` both live).
   - **API token:** leave on "Create new token" (auto-created) — no
     manual token setup needed.
   - **Variable name / Variable value** (add these as needed):
     - `NODE_VERSION` = `22` (matches `kb-app/.nvmrc`)
     - `VITE_SUPABASE_URL` — **optional, leave unset for now.** The app
       already treats a missing Supabase configuration as "signed out,
       sync inert" (see `kb-app/src/lib/supabase.ts`) — nothing breaks
       without it. Add it later, whenever you create a real Supabase
       project, then trigger a redeploy so the new build picks it up.
     - `VITE_SUPABASE_ANON_KEY` — same as above, optional, leave unset
       for now.
4. Click **Deploy**. Cloudflare assigns a URL automatically, shown on the
   project's page after the first deploy finishes, in the form
   `<project-name>.pages.dev`.

## After the first deploy, verify

Once the first deploy finishes, confirm it actually works before considering
this done:

1. Open the `*.pages.dev` URL Cloudflare assigned. The homepage should load.
2. Navigate to a deep link (e.g. `/settings`) and hard-refresh the page. If
   the SPA fallback (`wrangler.jsonc`'s `not_found_handling`) is working,
   the app loads normally instead of showing a 404 — this is the one
   thing this whole setup exists to get right.
3. Confirm the PWA installs and its service worker registers — this is only
   testable over real HTTPS, not on `localhost`, so this deploy is the first
   real chance to check it.
4. Check the repository's GitHub Actions tab for this commit's CI run —
   confirm it's green (separate from the Cloudflare Pages build itself; see
   "What CI does vs. what Cloudflare Pages does" below).

## Why the SPA fallback matters

This app uses React Router's `BrowserRouter`, so a direct link or a
refresh on any non-root path (e.g. `/settings`) must be served
`index.html` with a 200 status, not a host default 404 — the router then
takes over client-side. `kb-app/wrangler.jsonc`'s
`assets.not_found_handling: "single-page-application"` provides this —
the documented mechanism for this deploy method.

**Do not add a `public/_redirects` file back.** An earlier version of
this setup had one (`/* /index.html 200`, a leftover from before
Cloudflare merged its Pages dashboard into this Workers flow) — combined
with `not_found_handling`, Cloudflare's validator rejects it outright as
an infinite redirect loop (`Invalid _redirects configuration: ... Infinite
loop detected`), and the deploy fails. `not_found_handling` alone is
correct and sufficient here.

## Rolling back

Cloudflare dashboard → your project → **Deployments** → find a previous
deployment → re-promote it to production. No extra configuration
needed — this is a built-in feature.

## Adding a custom domain (later, optional)

Not needed to go live — the free `<project-name>.pages.dev` subdomain
works immediately. If you get a custom domain later: your project →
**Custom domains** → **Add a domain** → follow Cloudflare's DNS
instructions there.

## What CI does vs. what Cloudflare does

These are two independent systems watching the same GitHub repository:

- **`.github/workflows/ci.yml`** (GitHub Actions) — runs
  `typecheck`/`lint`/`test`/`build` on every push and pull request against
  `master`. This is a status check only; it does not deploy anything and
  holds no Cloudflare credentials.
- **Cloudflare's git integration** (set up above) — runs its own
  `npm run build` + `npx wrangler deploy` and actually deploys the
  result, to production on every push to `master`.

A red CI check does not block a Cloudflare deploy from running, and vice
versa — for a single-maintainer repo, both being visible is enough; check
both after pushing.
