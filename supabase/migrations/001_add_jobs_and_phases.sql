-- Migration: Add jobs table and phase tracking to scans
-- Run this in the Supabase SQL editor before deploying the updated app.

-- 1. Jobs table
create table if not exists jobs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text not null,
  address           text,
  status            text not null default 'active',     -- active | completed | archived
  phases            text[] not null default '{}',        -- ordered list of phase names for this job
  completed_phases  text[] not null default '{}'         -- phases that have been scanned and submitted
);

-- 2. Make homeowner_id nullable on scans (job scans don't have a homeowner)
alter table scans
  alter column homeowner_id drop not null;

-- 3. Add job_id and phase to scans
alter table scans
  add column if not exists job_id uuid references jobs(id) on delete set null,
  add column if not exists phase  text;

-- 4. Index for fetching scans by job
create index if not exists scans_job_id_idx on scans(job_id);

-- 5. Storage buckets (run separately in Supabase dashboard if not using CLI)
-- insert into storage.buckets (id, name, public) values ('basin-scans',  'basin-scans',  false) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('basin-photos', 'basin-photos', false) on conflict do nothing;
