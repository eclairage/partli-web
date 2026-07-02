import { createClient } from "@supabase/supabase-js";

export type ScanStatus = "pending" | "approved" | "flagged";
export type JobStatus = "active" | "completed" | "archived";

export interface Job {
  id: string;
  created_at: string;
  name: string;
  address: string | null;
  status: JobStatus;
  phases: string[];
}

export interface Homeowner {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}

export interface IntakeData {
  toilet_rough_in_inches: number | null;
  vanity_opening_width_inches: number | null;
  wall_material: "tile" | "drywall" | "mix" | "unknown" | null;
  shutoff_valves: "yes" | "no" | "unknown" | null;
  tub_shower_drain: "none" | "centered" | "offset" | null;
  gfci_outlet: "yes" | "no" | null;
  exhaust_fan: "works" | "broken" | "none" | null;
  access_notes: string | null;
  intake_photo_urls: string[];
}

export interface Scan {
  id: string;
  created_at: string;
  homeowner_id: string | null;
  job_id: string | null;
  phase: string | null;
  status: ScanStatus;
  room_data: RoomData | null;
  usdz_url: string | null;
  photo_urls: string[] | null;
  intake_data: IntakeData | null;
  path_room_data: RoomData | null;
  path_usdz_url: string | null;
  ops_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  homeowners?: Homeowner;
}

export interface RoomData {
  floor_area_sqft: number;
  wall_count: number;
  walls: RoomSurface[];
  doors: RoomSurface[];
  windows: RoomSurface[];
  openings: RoomSurface[];
  objects: RoomObject[];
}

export interface RoomSurface {
  width_ft: number;
  height_ft: number;
  confidence: "high" | "medium" | "low";
}

export interface RoomObject {
  category: string;
  width_ft: number;
  height_ft: number;
  depth_ft: number;
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
