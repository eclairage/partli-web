import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabase";

// GET /api/me — returns the current user's role.
// iOS uses this on launch to decide which root view to show.
//
// Installer:    { role: "installer" }       — app_metadata.role === "installer" (set by ops)
// Homeowner:    { role: "homeowner", homeowner_id, scan_status }
// New user:     { role: "new_homeowner" }   — signed in but no profile yet
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Installer: must be explicitly granted via Supabase app_metadata.role = "installer"
  if (user.app_metadata?.role === "installer") {
    return NextResponse.json({ role: "installer" });
  }

  const db = supabaseAdmin();

  const { data: homeowner } = await db
    .from("homeowners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!homeowner) {
    // Signed in but no homeowner profile — show registration flow
    return NextResponse.json({ role: "new_homeowner" });
  }

  // Most recent scan for this homeowner
  const { data: scan } = await db
    .from("scans")
    .select("status")
    .eq("homeowner_id", homeowner.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    role: "homeowner",
    homeowner_id: homeowner.id,
    scan_status: scan?.status ?? null,
  });
}
