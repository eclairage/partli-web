-- Link homeowners to Supabase auth users so role can be derived from JWT
alter table homeowners
  add column if not exists user_id uuid references auth.users(id);

-- Enforce one homeowner profile per auth user (nulls are excluded from unique index)
create unique index if not exists homeowners_user_id_idx
  on homeowners(user_id)
  where user_id is not null;
