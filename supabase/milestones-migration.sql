-- Milestones: earned achievement badges per user (a map of id -> earned timestamp),
-- synced on the user_settings row. Run once in the Supabase SQL Editor. Safe to re-run
-- (IF NOT EXISTS). Degrades gracefully before this runs: milestones work locally and
-- just don't sync across devices until the column exists.

alter table user_settings add column if not exists milestones             jsonb;
alter table user_settings add column if not exists milestones_updated_at  timestamptz;
