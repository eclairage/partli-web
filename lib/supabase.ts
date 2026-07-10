import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type ScanStatus = "pending" | "approved" | "flagged";
export type JobStatus = "active" | "completed" | "archived";

export interface Job {
  id: string;
  created_at: string;
  name: string;
  address: string | null;
  status: JobStatus;
  phases: string[];
  ops_note: string | null;
  completed_at: string | null;
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
  annotations: Annotation[];
  wall_finishes: Record<string, string> | null;
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
  transform?: number[]; // 16-value column-major 4×4 matrix (Path A+)
}

export interface RoomObject {
  category: string;
  width_ft: number;
  height_ft: number;
  depth_ft: number;
  transform?: number[]; // 16-value column-major 4×4 matrix (Path A+)
}

export interface Annotation {
  id: string;
  target: string;  // "floor_plan" | "wall_0" | "wall_1" …
  x: number;       // ft: room X (floor plan) or dist from left edge (elevation)
  y: number;       // ft: room Z (floor plan) or height from floor (elevation)
  text: string;
  author: string;
  created_at: string;
}

// Named `supabasePublic` to make it obvious this uses the anon (public) key.
// Only use this in client-side code. All server routes must use supabaseAdmin().
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/**
 * Verifies the Bearer token in the request and returns the full Supabase user,
 * or null if the token is missing / invalid. Includes app_metadata for role checks.
 */
export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const user = await getUserFromRequest(req);
  return user?.id ?? null;
}

/**
 * Resolves a raw Supabase Storage object URL to a short-lived signed URL.
 * Both `basin-scans` and `basin-photos` buckets are private, so any URL
 * stored on a scan (usdz_url, photo_urls, intake_photo_urls) must be signed
 * before it can be fetched from the browser.
 */
export async function signedStorageUrl(
  db: SupabaseClient,
  rawUrl: string | null | undefined
): Promise<string | null> {
  if (!rawUrl) return null;
  const match = rawUrl.match(/\/storage\/v1\/object\/([^/]+)\/(.+)$/);
  if (!match) return rawUrl;
  const [, bucket, path] = match;
  const { data } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? rawUrl;
}

/** Batch variant of {@link signedStorageUrl} for photo arrays. */
export async function signedStorageUrls(
  db: SupabaseClient,
  rawUrls: string[] | null | undefined
): Promise<string[]> {
  if (!rawUrls || rawUrls.length === 0) return [];
  const signed = await Promise.all(rawUrls.map((url) => signedStorageUrl(db, url)));
  return signed.filter((url): url is string => url !== null);
}
