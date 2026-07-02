-- Migration: Add structured intake data and path scan to scans table

alter table scans
  add column if not exists intake_data    jsonb,       -- structured pre-install questionnaire answers
  add column if not exists path_room_data jsonb,       -- RoomData for path from bathroom to exterior door
  add column if not exists path_usdz_url  text;        -- USDZ model for the path scan
