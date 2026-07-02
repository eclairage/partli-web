-- Run this in the Supabase SQL editor to set up the Basin database.

create table if not exists homeowners (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text not null unique,
  email       text,
  address     text
);

create table if not exists scans (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  homeowner_id uuid not null references homeowners(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'flagged')),
  room_data    jsonb,
  usdz_url     text,
  photo_urls   text[] not null default '{}',
  ops_note     text,
  reviewed_at  timestamptz,
  reviewed_by  text
);

-- Indexes
create index if not exists scans_homeowner_id_idx on scans(homeowner_id);
create index if not exists scans_status_idx on scans(status);
create index if not exists scans_created_at_idx on scans(created_at desc);

-- Storage buckets (run in Supabase dashboard > Storage, or via API)
-- Bucket: basin-scans  (private)
-- Bucket: basin-photos (private)
--
-- After creating buckets, add service role policy so the API can upload:
-- Allow service role to SELECT, INSERT, UPDATE, DELETE on storage.objects
-- where bucket_id in ('basin-scans', 'basin-photos')
