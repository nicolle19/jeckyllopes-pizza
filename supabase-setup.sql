-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → paste this → Run)

create table if not exists pizza_signups (
  date_key  text primary key,   -- e.g. "2025-03-05"
  signups   jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Allow anyone to read and write (public signup app)
alter table pizza_signups enable row level security;

create policy "Public read" on pizza_signups
  for select using (true);

create policy "Public insert" on pizza_signups
  for insert with check (true);

create policy "Public update" on pizza_signups
  for update using (true);
