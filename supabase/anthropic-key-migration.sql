-- Per-user Anthropic API key for the YouTube summarizer, stored on the user's
-- own user_settings row (RLS already restricts each row to its owner, so a user's
-- key is readable only with that user's own credentials — never by anyone else).
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
--
-- Note: this is stored as plain text (Supabase encrypts data at rest, and RLS
-- gates row access). It's your own key for your own usage.

alter table user_settings add column if not exists anthropic_key text;
