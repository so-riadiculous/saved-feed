# Saved-for-later feed

A private, personal feed of things I've saved to consume later. I email a link to a
dedicated inbox; it shows up in an Instagram-style scroll I can turn to when bored.

## Decisions already made

**Stack** — Next.js (App Router) + TypeScript + Tailwind, hosted on Vercel (free tier).
Neon Postgres (free tier) with Drizzle ORM. Cloudflare Email Routing for the inbound
inbox. Code on GitHub. Only recurring cost is the domain, ~$12/yr.

**Ingest flow** — email `save@<domain>` → Cloudflare Email Routing → Email Worker →
`POST /api/inbound` (shared-secret header) → app extracts the URL, fetches the page's
Open Graph tags for title / image / site name / author, writes a row.

**Enrichment** — metadata only. No AI summaries for v1 (deliberate; can be added later
without a schema rewrite).

**Feed UX** — vertical scroll, Instagram-like. Per item: category tags, a reaction
(like / dislike / neutral), a free-text comment, and a separate "consumed" flag.
Reaction and consumed are independent — you can rate something you bailed on, and
consume something you have no strong feeling about. Tags/reaction/comment/consumed
are **per person** (see Auth below) — Ria and Dad each have their own take on a
shared item. Once you mark something consumed, it drops out of your main scroll
(it's still there for the other person until they consume it too).

**Second view** — an archive of consumed items with their notes, searchable. This is
the "refer back to it" half of the product. Each person sees their own archive.

**Text excerpts** — the save box also accepts plain text (no URL), e.g. an excerpt
from a Claude conversation. Shown as a quote card instead of a link-preview card, not
clickable, never deduped (every paste is a new item). Tags/reaction/comment/consumed
all work the same as for links.

**Comments are shared, not private** — unlike tags/reaction/consumed (which stay
per-person), each person's comment is visible to the other, labeled by who wrote it.
You each still only edit your own.

**Auth** — two known users, Ria and Dad, each with their own password (env var per
person), exchanged for a signed httpOnly cookie identifying which person is logged
in. Still no signup/accounts system — just two hardcoded identities, not open
registration.

**Attribution** — every saved item records who originally saved it (`savedBy`),
filterable in the feed. Inbound emails are attributed by matching the sender's own
email address against a known allowlist (Ria's address vs Dad's address) — no
separate intake address needed. If the email body includes a note beyond the URL,
that becomes the sender's initial comment on the item.

**Visibility** — private by default behind login. A global (and optionally per-item)
share toggle exposes a read-only public view. Public view must be *unlisted*:
`noindex` robots headers, no sitemap, non-obvious URL. Not secret, just undiscoverable.

## Roadmap

| # | Phase | Status |
|---|-------|--------|
| 0 | Install Node.js (`winget install OpenJS.NodeJS.LTS`) | done |
| 1 | Scaffold app + local git repo | done |
| 2 | Create Neon database | done |
| 3 | Build feed, save flow, login | done |
| 4 | Run locally and try it | done |
| 5 | Push to GitHub | done |
| 6 | Deploy to Vercel → live URL | done |
| 7 | Buy domain + Cloudflare email → inbox goes live | done |
| 8 | Polish | in progress |

Phases 1–6 give a usable site. Until phase 7 lands, ship a paste-a-link box in the UI
so the feed can be filled by hand from day one.

## Working notes

- Machine is Windows 11, PowerShell. `git`, `node`/`npm` installed (phase 0). `gh`
  (GitHub CLI) not installed yet — needed for phase 5.
- User is new to the terminal: run commands where possible rather than handing them
  off, and keep handoffs to web-dashboard clicking with exact instructions.
- Work laptop has some admin/network restrictions (saw an install hiccup on a winget
  package, and outbound requests from Node can behave oddly) — avoid downloading and
  executing new unvetted binaries (e.g. skip browser-automation tools like Playwright)
  when a lighter-weight alternative exists.
- No admin/UAC rights on this machine — winget's MSI-based installs (needs elevation)
  will fail with "You cancelled the installation" / exit 1602. Use the portable ZIP
  release instead (extract to `%LOCALAPPDATA%\Programs\<name>`, add to **user** PATH
  via `[System.Environment]::SetEnvironmentVariable("Path", ..., "User")` — no admin
  needed for user-scope PATH/env vars). Did this for `gh` CLI already.
- `gh auth login --with-token` failed validation in this environment even with a
  valid token (probably a credential-storage restriction on this machine, never
  resolved). Fix that actually worked: set `GH_TOKEN` as a permanent **user** env
  var — `gh` picks it up automatically for its own commands. For `git push` itself,
  the Bash tool's shell doesn't inherit that Windows user env var automatically, so
  each push needs `export GH_TOKEN="..."` inline in the same Bash call right before
  `git push` (confirmed working repeatedly; a plain `git push` alone hangs on Git
  Credential Manager here).
- GitHub account: `so-riadiculous`. Repo: `so-riadiculous/saved-for-later-feed`
  (public — made public and squashed to a single clean commit for use as a
  portfolio piece in job applications; renamed from `saved-feed`). Vercel
  project and Cloudflare Worker names are unaffected by the repo rename (still
  `saved-feed` / `saved-feed-inbound`).
- **PowerShell piping secrets into a subprocess's stdin silently corrupts them** —
  hit this with `vercel env add` reading from a piped string: passwords gained a
  trailing `\r`, and one value gained a leading UTF-8 BOM (`ï»¿`). Symptom was
  confusing (login/DB failures with no obvious cause). Fix: set env vars via a
  direct `Invoke-RestMethod` call to the provider's API instead of piping through a
  CLI's stdin. If a "trailing newline removed" message from a CLI doesn't fully fix
  a value, suspect this.
- **Vercel blocked every deploy** with `readyState: BLOCKED` / "Git author ... must
  have access to the team" — it checks the local git commit's author email against
  verified team members on the Vercel account, even for CLI-triggered deploys, and
  fails silently (looks like an indefinite hang, not an error) if they don't match.
  Fix without touching git config (not allowed): `git commit --author="Name
  <matching-email>"` for one commit to align it, then push. Vercel account email
  must match the email on the Vercel account itself.
- Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (function export
  is now `proxy`, not `middleware`) — build output shows "Proxy (Middleware)" as the
  route name. Already renamed in this repo; don't recreate a `middleware.ts`.
- **PDF title extraction: `pdf-parse`/pdfjs-dist do not work in Vercel's Node
  runtime, even with `@napi-rs/canvas`.** First attempt (`pdf-parse`, top-level
  import) crashed at module-evaluation time with `ReferenceError: DOMMatrix is
  not defined`, and because it was a top-level import in `og.ts`, this took down
  *every* `/api/items` call, not just PDF ones — a real production outage for a
  few minutes. Made the import dynamic + wrapped in try/catch to stop that
  class of crash from ever taking down non-PDF saves again (keep this pattern
  for any future PDF-library swap). Then tried installing `@napi-rs/canvas`
  directly (still "Cannot find module"), then forcing it into the serverless
  bundle via `next.config.ts`'s `outputFileTracingIncludes` (module found, but
  then "Cannot find native binding" — npm's known bug resolving
  platform-specific optionalDependencies when the lockfile was generated on a
  different OS, https://github.com/npm/cli/issues/4828), then explicitly
  pinning `@napi-rs/canvas-linux-x64-gnu` as an optional dependency (lockfile
  correctly showed it resolved, still failed the same way). **What actually
  worked:** replaced `pdf-parse` entirely with `unpdf`, which ships a pdfjs-dist
  build designed for edge/serverless runtimes — its text/metadata extraction
  (`getDocumentProxy`, `getMeta`, `extractText`) doesn't touch canvas/DOMMatrix
  at all (only its separate, unused-by-us image-rendering functions do).
  Verified working in production. `next.config.ts` and package.json are back to
  not needing any canvas-related entries.
- Live app: **https://savedfornow.com** (also still reachable at the original
  `https://saved-feed.vercel.app`). Vercel project `ria12/saved-feed`. Custom domain
  added via the Vercel API with two A records in Cloudflare (`216.198.79.1` and
  `64.29.17.1`, both **unproxied** — Vercel needs direct access for its own SSL/TLS,
  a Cloudflare-proxied "orange cloud" record would break it) — coexists fine with
  the email MX records already on the zone. SSL took a minute or two to provision
  after the DNS went in; HTTP worked immediately, HTTPS lagged behind briefly.
  Deployed via `vercel deploy --prod` CLI, not git-integration auto-deploy — the
  "Connect GitHub repository" step failed during `vercel link` and was never fixed
  (would need installing/authorizing the Vercel GitHub App via the web dashboard).
  So new deploys need an explicit `vercel deploy --prod` after pushing, they don't
  happen automatically on `git push` yet.

## Email ingest (phase 7, live)

- Domain: **savedfornow.com**, bought and DNS-hosted on Cloudflare (zone id and
  account id are in the Cloudflare dashboard, not recorded here).
- Inbox: `save@savedfornow.com` → Cloudflare Email Routing rule ("save to inbound
  worker") → Cloudflare Worker `saved-feed-inbound` (code in `cloudflare-worker/`,
  deployed via `wrangler`) → parses the raw email with `postal-mime` → `POST`s
  `{ from, subject, text }` to the app's `/api/inbound` with an `x-inbound-secret`
  header → app matches sender against `RIA_EMAILS/DAD_EMAILS` allowlists, pulls the
  first URL out of the body as the thing to save, and treats the rest as the note.
- Sender allowlist: Ria and Dad's real addresses are set as `RIA_EMAILS`/
  `DAD_EMAILS` env vars (Dad has two he uses interchangeably) — not recorded here
  since this file is public; check the env vars directly (locally in `.env.local`,
  or in Vercel's project settings) if you need the actual values.
- Worker's `workers.dev` subdomain: `ria-savedfeed` (had to register one via
  `PUT /accounts/{id}/workers/subdomain` before wrangler would deploy at all — an
  account-level one-time requirement, unrelated to email routing itself since the
  Worker is only ever invoked by the `email()` trigger, never over HTTP).
- Cloudflare API token permission gotcha: the token needs `Zone → Email Routing
  Rules → Edit` (for creating routing rules) *and separately* `Zone → DNS → Edit`
  (for the MX/TXT records) *and* `Account → Workers Scripts → Edit`. There is no
  separate "Email Routing Settings" permission exposed to scoped tokens — the
  master enable/disable toggle for the zone had to be done once by hand in the
  dashboard (Email Routing → Settings → DNS records → "Add missing DNS records";
  there's no distinct "enable" button in this Cloudflare UI, that action *is* the
  enable).
- To set the Worker's secret without the same stdin-piping corruption we hit with
  Vercel, used `wrangler secret bulk <file>.json` (a one-shot JSON upload) instead
  of `wrangler secret put` piped from a string.
