# Saved For Now

A private, two-person "read it later" feed. Email or paste a link (or just plain
text — an excerpt, a quote, anything worth remembering) and it shows up as a
scrollable, Instagram-style feed with link previews, tags, reactions, and notes.

**Live:** [savedfornow.com](https://savedfornow.com) — login-gated (it's built for
exactly two people), but the app is fully deployed and running.

## Why I built this

I wanted an alternative to endlessly scrolling X/Twitter — a way to actually go back
to something I'd seen but didn't have time for in the moment, instead of it just
disappearing into the feed. That's not limited to tweets, though — it's just as
much for articles, PDFs, videos, or a quote I want to remember, anything that
would otherwise get lost. My dad and I also share links like this constantly over
text and email, and there was never one place to keep track of what we'd sent
each other or say what we thought of it. This is that place: email or paste
something in — a link or just plain text — and it's there later, with room for
both of us to react to it independently.

## What it does

- **Email-in ingestion** — send a link to a dedicated inbox address and it's parsed,
  enriched, and added to the feed automatically, attributed to whoever sent it.
- **Rich link previews** — fetches title, image, and site name for any URL. Handles
  sites that block server-side scraping (YouTube, X/Twitter) via their official
  oEmbed APIs instead, and extracts titles from PDFs directly (falling back to
  guessing from the document's opening lines when the PDF has no metadata title set).
- **Two independent perspectives on shared content** — tags, reactions, and
  "consumed" status are all per-person, so two people can each have their own take
  on the same saved item, while comments are shared and visible to both.
- **A real archive** — once you've consumed something, it moves out of the main
  feed into a searchable archive of everything you've gotten through.
- **Plain-text saves** — not everything worth saving is a URL. Paste any text and
  it's stored as its own item, same tagging/reaction/archive behavior as a link.

## How it's built

```
Email → Cloudflare Email Routing → Cloudflare Worker (parses MIME, extracts
  sender/links) → Next.js API route (matches sender to a known person, saves
  the item) ─┐
             ├─→ Neon Postgres (via Drizzle ORM)
Paste box ───┘
```

- **Auth** is deliberately minimal: two known people, two passwords, a signed
  JWT session cookie — no accounts system, because there will only ever be two
  users.
- **Data model** separates shared content (`items`: the URL/text, title, image)
  from per-person state (`item_interactions`: tags, reaction, comment, consumed),
  so two people can independently interact with one shared row.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Drizzle ORM · Neon (serverless
Postgres) · Cloudflare Workers + Email Routing · Vercel

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in your own Neon DB, auth secret, passwords
npm run db:push                    # push the schema to your database
npm run dev
```

The email-ingest path (`cloudflare-worker/`) is a separate small project — see its
`wrangler.toml` for the Worker config, deployed independently via `wrangler deploy`.
