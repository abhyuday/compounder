-- Health metrics: a catalog of objective, occasionally-recorded readings (weight first)
-- per user, synced on the user_settings row. Run once in the Supabase SQL Editor.
-- Safe to re-run (IF NOT EXISTS). Decoupled from the daily point system — never scored.
-- Degrades gracefully before this runs: metrics work locally and just don't sync until
-- the column exists.

alter table user_settings add column if not exists metrics             jsonb;
alter table user_settings add column if not exists metrics_updated_at  timestamptz;
