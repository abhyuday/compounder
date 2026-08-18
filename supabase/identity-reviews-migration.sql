-- New synced settings for identity lines + weekly reviews.
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- Both live on the existing user_settings row (already RLS-protected per user).

alter table user_settings add column if not exists identity            jsonb;
alter table user_settings add column if not exists identity_updated_at timestamptz;
alter table user_settings add column if not exists reviews             jsonb;
alter table user_settings add column if not exists reviews_updated_at  timestamptz;
