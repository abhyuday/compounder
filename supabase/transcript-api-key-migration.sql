-- Per-user TranscriptAPI key for the YouTube summarizer, stored on the user's own
-- user_settings row (RLS restricts each row to its owner, so a user's key is
-- readable only with that user's own credentials). Same model as anthropic_key.
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

alter table user_settings add column if not exists transcript_api_key text;
