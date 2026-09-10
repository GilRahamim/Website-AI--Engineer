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
