# Compounder

A daily habit-scoring app built on one idea: **five points a day, target 25 a week — not 35.** That number is the whole system. Each dimension is one small action, small enough to win on a bad day — you're chasing consistency, not perfection. *A bad week is 25. A perfect week is a trap.*

**Live:** https://abhyuday.github.io/compounder/

## The five dimensions

Each dimension is worth **1 point/day** → max 5/day, 35/week, **target 25**.

| Dimension | Earns the point |
| --- | --- |
| **Comfort Zone — Push** | One hard thing you'd rather avoid — the dreaded workout, the awkward call, the cold outreach. Leave the comfort zone. |
| **Money — Build** | One 15-minute move that compounds — fund the account, write a page of the thesis, one real outreach, one position reconciled. Watching the market doesn't count. |
| **Health** | 2 of 3: **Move** (zone 2 / lift / 8K steps), **Eat** (protein first, nothing you'd hide), **Sleep** (screens down, lights-out by target). Win on a bad day. |
| **Family** | **Both** required: **Presence** (one undistracted block with one specific person, phone in another room) **and** **Conflict** (faced the friction instead of dodging it — a hard talk, a repair, an honest apology). |
| **Self** | 2 of 4: **Resolve** (did what you resolved), **Sincerity** (honest, clean-tongued), **Soft Skills** (public speaking, music, dance, improv, networking), **Restoration** (30 min of chosen nothing — not the feed). |

Health, Family, and Self are split into sub-toggles that each track a pillar but contribute a single dimension point (Health/Self at 2-of-N, Family needing both) — so the daily max stays 5 and the mental model stays simple. Legacy days logged before Family's Conflict box existed keep their point on Presence alone, so history and streaks are never rewritten.

## The Compounder Score

A composite **0–100** score for the health of your whole system, computed live from your day data over a **trailing 4 weeks** — it never feeds back into the daily points. It blends four ingredients:

- **Consistency** (30%) — the share of days you moved the needle (≥1 point).
- **Balance** (30%) — coverage across all five dimensions, weighted so your **weakest link** drags the score. No neglected area.
- **Target adherence** (25%) — each week's points against the 25 target, **capped at target** so pushing toward 35 earns nothing.
- **Momentum** (15%) — this month's pace versus last month's.

It's tuned so hitting ~25/week in balance settles into an **80–92 "healthy zone"** rather than demanding a perfect 100 — reaching 100 needs a still-improving month, so a healthy plateau scores high while the 5/5 grind is never rewarded. Your **baseline** is the same formula over your first three weeks (a fixed starting line), and the ring shows how far you've compounded since — *"▲ +25 since baseline."* Tap the ring to see the four component meters, the single highest-leverage tip, and your weakest dimension.

## Beyond the five

- **Rewards economy** — an editable catalog of rewards with a **rolling wallet**: points earned minus spent, carried forward all-time, so you can save up for bigger rewards.
- **Goals** — a nested, decoupled forest of goals (arbitrary depth, derived completion); a fully-done top-level goal auto-archives with a celebration.
- **Health metrics** — objective, occasionally-recorded readings (weight ships first), logged via a stepper seeded to your last value, shown as a smoothed trend sparkline with 30/90-day deltas. Never scored.
- **Tips per dimension** — a 💡 modal of "the ideal to reach for," seeded from popular sources (Atomic Habits, Psychology of Money, Outlive, Huberman, Gottman…) and fully editable.
- **Identity lines** — an opt-in *"I'm someone who…"* line per dimension.
- **Notes** — attach multiple notes to any checkpoint to record what actually earned it; tap a bullet to strike it through.
- **History** — weekly streak, a per-dimension **weakest-link** strip, a compounding curve, and a weekly Sunday review.
- **The rhythm** — an editable daily schedule (the "Modern Franklin" day) with a "Now" strip that highlights the current block. Guidance only, not scored.

## Days & editing

The board is a day switcher plus a tappable Mon–Sun **week grid** with running totals and the 25 target marked. **Only today and yesterday are editable** — older days are finalized and lock read-only (a "🔒 Finalized" banner), so you can't rewrite history. Future days are locked too.

## Reminders

Opt-in **web-push** morning and evening reminders (avatar → 🔔 Reminders), delivered by a Supabase Edge Function on a twice-daily schedule. The evening reminder is smart — it reads your local-today row and names the dimensions you still have open.

## YouTube summarizer

A 🎬 modal turns a YouTube URL into a Claude summary (TL;DR / key points / actionable takeaways) via a Supabase Edge Function. **Bring-your-own-key:** each signed-in user stores their own TranscriptAPI and Anthropic keys in their RLS-protected settings row — no shared server secret.

## Sync & accounts

Signed out, everything lives in `localStorage` on the device. Sign in with **Google** or an **email magic link** and your board and all settings sync across devices via **Supabase** (Postgres + row-level security), with last-write-wins per day and localStorage as an offline cache.

Sync uses two tables:

- **`days`** — one row per (user, date): a boolean per toggle (`hard`, `money`, `hmove`/`heat`/`hsleep`, `fpres`/`fconf`, `vind`/`vsin`/`vtrq`/`vrest`), the derived point columns (`health`, `family`, `self`), `notes jsonb`, `rewards jsonb`, `updated_at`, all under RLS.
- **`user_settings`** — `user_id` plus a jsonb column (each with an `_updated_at`) for `schedule`, `rewards`, `identity`, `reviews`, `goals`, `tips`, and `metrics`, plus the per-user `transcript_api_key` / `anthropic_key`.

The schema was built up via the `alter table ... add column if not exists` migrations under `supabase/` — run the matching one in the SQL Editor when a feature needs a new column. Everything **degrades gracefully**: features work locally and simply don't sync until their column exists. Without Supabase the app still works fully — just device-only.

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
- Supabase for auth, sync, and Edge Functions (`send-reminders`, `summarize-video`) — optional; the core app is fully functional offline without it
- Hosted on GitHub Pages
