-- Family gains a second checkbox (Conflict); the point now needs Presence AND Conflict.
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
--
-- fpres = Presence, fconf = Conflict. The existing `family` column keeps its meaning
-- (the earned point = fpres AND fconf), so the reminder Edge Function needs no change.
-- Legacy rows (fpres/fconf null) keep their Family point on Presence alone, so past
-- weeks, streaks, and history are not rewritten.

alter table days add column if not exists fpres boolean;
alter table days add column if not exists fconf boolean;

-- Backfill Presence from the old single Family point for existing rows.
update days set fpres = family where fpres is null;
