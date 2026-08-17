# Compounder

A daily habit-scoring app built on one idea: **four points a day, target 20 a week — not 28.** That number is the whole system. Each domain is one small action, small enough to win on a bad day — you're chasing consistency, not perfection. *A bad week is 20. A perfect week is a trap.*

**Live:** https://abhyuday.github.io/compounder/

## The four domains

Each domain is worth **1 point/day** → max 4/day, 28/week, **target 20**.

| Domain | Earns the point |
| --- | --- |
| **Money — Build** | One 15-minute move that compounds — fund the account, write a page of the thesis, one real outreach, one position reconciled. Watching the market doesn't count. |
| **Health** | 2 of 3: **Move** (zone 2 / lift / 8K steps), **Eat** (protein first, nothing you'd hide), **Sleep** (screens down, lights-out by target). |
| **Family — Presence** | One undistracted block with one specific person. Phone in another room — not face-down. |
| **Self** | 2 of 4: **Hard Work**, **Sincerity**, **Soft Skills** (public speaking, music, dance, improv, networking), **Restoration** (30 min of chosen nothing). |

Health and Self are split into sub-toggles that each track a pillar, but still contribute a single domain point (earned at 2-of-N) — so the daily max stays 4 and the mental model stays simple.

## Beyond the four

- **Daily bookend** — a Franklin-style ritual: *"What hard thing shall I do this day?"* as a yes/no with its own streak. Tracked outside the 20-point score.
- **Notes** — attach multiple notes to any checkpoint to record what actually earned it.
- **Back-fill** — a day switcher and tappable week-grid cells let you fill in days you forgot; future days are locked.
- **Week grid** — a Mon–Sun view of every domain with running totals and the 20 target marked.
- **The rhythm** — an editable daily schedule (the "Modern Franklin" day) with a "Now" strip that highlights the current block. Guidance only, not scored.

## Sync & accounts

Signed out, everything lives in `localStorage` on the device. Sign in with **Google** or an **email magic link** and your board, notes, bookend, and schedule sync across devices via **Supabase** (Postgres + row-level security), with last-write-wins per day and localStorage as an offline cache.

Sync needs a Supabase project with:

- a **`days`** table — one row per (user, date): a boolean per toggle (`money`, `hmove`/`heat`/`hsleep`, `family`, `vind`/`vsin`/`vtrq`/`vrest`, `hard`), the derived point columns (`health`, `self`), `notes jsonb`, `updated_at`, and RLS so a user only sees their own rows;
- a **`user_settings`** table — `user_id` + `schedule jsonb` for the synced schedule, also under RLS.

The exact columns are the `select(...)` list in `index.html`; the schema was built up via the `alter table` migrations in the commit history. Without Supabase the app still works fully — just device-only.

## Install (mobile-first)

It's a PWA: on your phone open the site → Share → **Add to Home Screen** to launch fullscreen, like a native app. A service worker caches the shell so it loads offline, and the UI is tuned for touch (safe-area insets, large tap targets, no focus-zoom).

## Run locally

A single static `index.html` — no build step, no bundler:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. (Google OAuth and magic-link redirects are configured for the deployed URL, so sign-in is best tested on the live site.)

## Stack

- One static `index.html` (inline CSS/JS), plus `manifest.webmanifest`, `sw.js`, and app icons
- Supabase for auth + sync (optional — the app is fully functional offline without it)
- Hosted on GitHub Pages
