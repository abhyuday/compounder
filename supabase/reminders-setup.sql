-- Compounder push reminders — schema.
-- Run once in the Supabase SQL Editor.

-- 1) Reminder time prefs live on user_settings (array of { kind, hour, utc }).
alter table public.user_settings
  add column if not exists reminders jsonb;

-- 2) One push subscription per device/browser.
create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
