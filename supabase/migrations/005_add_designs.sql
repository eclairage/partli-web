-- Migration: Add designs (quotes) authored by Ops for approved scans.
-- Run this in the Supabase SQL editor before deploying the updated app.
--
-- A design is the concierge-produced output Ops attaches to an approved scan:
-- renderings + line items + one fixed price + a homeowner-facing scope summary.
-- Publishing flips it to 'published' and notifies the homeowner. The homeowner
-- viewer / approve action live in sibling tasks and read this table.

-- 1. Designs table
create table if not exists designs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  scan_id           uuid references scans(id) on delete set null,
  homeowner_id      uuid references homeowners(id) on delete cascade,
  status            text not null default 'draft'
                      check (status in ('draft', 'published', 'approved', 'archived')),
  title             text,
  scope_summary     text,                          -- homeowner-facing plain-language scope
  line_items        jsonb not null default '[]',   -- [{ id, label, description, qty, amount_cents }]
  fixed_price_cents integer,                        -- the single number the homeowner sees
  rendering_urls    text[] not null default '{}',  -- storage object URLs in 'basin-designs'
  ops_note          text,                          -- internal-only
  authored_by       text,
  published_at      timestamptz,
  version           integer not null default 1     -- bump on republish; unblocks change-order task
);

-- 2. Indexes
create index if not exists designs_scan_id_idx      on designs(scan_id);
create index if not exists designs_homeowner_id_idx on designs(homeowner_id);
create index if not exists designs_status_idx       on designs(status);

-- 3. Private bucket for renderings (mirror existing basin-scans / basin-photos)
insert into storage.buckets (id, name, public)
  values ('basin-designs', 'basin-designs', false) on conflict do nothing;

-- 4. Storage RLS — service role reads (signed URLs are minted server-side)
create policy "Service role can read design renderings"
  on storage.objects for select
  to service_role
  using (bucket_id = 'basin-designs');

create policy "Service role can write design renderings"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'basin-designs');
