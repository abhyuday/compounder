-- Journal: private, per-account entries organized by topic, with markdown bodies.
-- Unlike the other features (which live as jsonb on the single user_settings row),
-- entries get their own table since there can be many. Run once in the Supabase SQL
-- Editor. Safe to re-run. Row-level security scopes every row to its owner, so a user
-- can only ever read/write their own journal. The app degrades gracefully before this
-- runs: the Journal works locally and just doesn't sync until the table exists.

create table if not exists journal_entries (
  id         uuid primary key,
  user_id    uuid not null,
  topic      text not null default 'Journal',
  title      text not null default '',
  body       text not null default '',           -- markdown
  pinned     boolean not null default false,
  deleted    boolean not null default false,     -- soft delete, so deletes sync across devices
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table journal_entries enable row level security;

drop policy if exists "own journal entries" on journal_entries;
create policy "own journal entries" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists journal_entries_user_idx on journal_entries (user_id, updated_at desc);
