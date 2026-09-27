-- Recovery plan (if-then slump protocol) sync columns on user_settings.
-- Run once in the Supabase SQL Editor. Until then the plan works locally and
-- sync degrades gracefully (syncRecovery silently skips a missing column).
alter table user_settings add column if not exists recovery jsonb;
alter table user_settings add column if not exists recovery_updated_at timestamptz;
