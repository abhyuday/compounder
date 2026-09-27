-- North Star (purpose / the "why") sync columns on user_settings.
-- Run once in the Supabase SQL Editor. Until then it works locally and sync
-- degrades gracefully (syncNorthstar silently skips a missing column).
alter table user_settings add column if not exists northstar jsonb;
alter table user_settings add column if not exists northstar_updated_at timestamptz;
