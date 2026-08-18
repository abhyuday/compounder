-- Goals: a nested forest of goals per user, synced on the user_settings row.
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- Decoupled from the daily point system. Degrades gracefully before this runs:
-- goals work locally and just don't sync until the column exists.

alter table user_settings add column if not exists goals             jsonb;
alter table user_settings add column if not exists goals_updated_at  timestamptz;
