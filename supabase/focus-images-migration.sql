-- Focus board — private pictures that sync across devices.
-- Binary files live in a PRIVATE Storage bucket ('focus-images') at {user_id}/{id}.jpg;
-- their metadata (caption, order, soft-delete) lives in the focus_images table below.
-- The app keeps a local IndexedDB cache and degrades gracefully before this runs
-- (images work on the device, they just don't sync until the bucket + table exist).
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- 1) Private bucket for the image files.
insert into storage.buckets (id, name, public)
values ('focus-images', 'focus-images', false)
on conflict (id) do nothing;

-- 2) Storage RLS: a user can only touch objects under their own {user_id}/ folder.
drop policy if exists "focus own objects read"   on storage.objects;
drop policy if exists "focus own objects insert" on storage.objects;
drop policy if exists "focus own objects update" on storage.objects;
drop policy if exists "focus own objects delete" on storage.objects;

create policy "focus own objects read" on storage.objects
  for select using (bucket_id = 'focus-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "focus own objects insert" on storage.objects
  for insert with check (bucket_id = 'focus-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "focus own objects update" on storage.objects
  for update using (bucket_id = 'focus-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "focus own objects delete" on storage.objects
  for delete using (bucket_id = 'focus-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- 3) Metadata table (one row per image). RLS scopes every row to its owner.
create table if not exists focus_images (
  id           uuid primary key,
  user_id      uuid not null,
  storage_path text not null,
  caption      text not null default '',
  sort_order   integer not null default 0,
  width        integer,
  height       integer,
  deleted      boolean not null default false,   -- soft delete, so deletes sync across devices
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table focus_images enable row level security;

drop policy if exists "own focus images" on focus_images;
create policy "own focus images" on focus_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists focus_images_user_idx on focus_images (user_id, updated_at desc);
