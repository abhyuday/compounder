-- Per-dimension "ideal state" tips (editable), synced on the user_settings row.
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- Degrades gracefully before this runs: tips work locally (defaults + edits) and
-- just don't sync across devices until the column exists.

alter table user_settings add column if not exists tips             jsonb;
alter table user_settings add column if not exists tips_updated_at  timestamptz;
