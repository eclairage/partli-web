-- Migration: structured replacement-items on designs + reusable item-type list.
-- Run in the Supabase SQL editor. Builds on 005_add_designs.sql.
--
-- The design phase becomes per-item: Ops designates each fixture/finish being
-- replaced, picks a photo of the existing item (from the scan), and specifies
-- the new item. Replaces the flat line_items breakdown.

-- 1. Reusable, extensible item-type list (seeded; Ops can add more)
create table if not exists item_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into item_types (name, sort_order) values
  ('Toilet', 10),
  ('Vanity', 20),
  ('Sink', 30),
  ('Faucet', 40),
  ('Mirror', 50),
  ('Floor covering', 60),
  ('Tub / Shower', 70),
  ('Lighting', 80),
  ('Exhaust fan', 90),
  ('Hardware / Accessories', 100),
  ('Paint / Wall finish', 110)
on conflict (name) do nothing;

-- 2. Structured replacement-items on the design.
--    Each element:
--    { id, item_type, existing_photo_url, new_name, new_image_url,
--      new_vendor_price_cents (INTERNAL), new_url, new_finish, new_notes }
alter table designs
  add column if not exists items jsonb not null default '[]';

-- line_items is retained (unused) to avoid a destructive change; a later
-- cleanup migration can drop it once nothing reads it.
