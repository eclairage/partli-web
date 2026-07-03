import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeDrawings, RoomData } from "@/lib/roomplan";

// GET /api/scans/:id/drawings
// Returns computed floor plan and wall elevations from the scan's room_data.
// Requires the scan to have been submitted with transform data (Path A format).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: scan, error } = await db
    .from("scans")
    .select("id, room_data, status")
    .eq("id", id)
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }

  const room = scan.room_data as RoomData | null;

  if (!room) {
    return NextResponse.json({ error: "scan has no room data" }, { status: 422 });
  }

  // Detect scans submitted before Path A (no transform on walls)
  const hasTransforms = room.walls?.length > 0 && Array.isArray(room.walls[0]?.transform);
  if (!hasTransforms) {
    return NextResponse.json(
      { error: "scan predates transform support — rescan required" },
      { status: 422 }
    );
  }

  const drawings = computeDrawings(room);
  return NextResponse.json(drawings);
}
