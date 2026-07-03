-- Add ops_note and completed_at to jobs table
alter table jobs
  add column if not exists ops_note    text,
  add column if not exists completed_at timestamptz;
