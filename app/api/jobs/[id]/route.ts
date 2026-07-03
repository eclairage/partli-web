import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabase";

// GET /api/jobs/:id — job detail with scan history per phase (installer only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "installer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = supabaseAdmin();

  const [jobResult, scansResult] = await Promise.all([
    db.from("jobs").select("*").eq("id", id).single(),
    db
      .from("scans")
      .select("id, created_at, phase, status, photo_urls, usdz_url")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (jobResult.error || !jobResult.data) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  const job = jobResult.data;
  const scans = scansResult.data ?? [];

  const phaseScans: Record<string, typeof scans[0]> = {};
  for (const scan of scans) {
    if (scan.phase) phaseScans[scan.phase] = scan;
  }

  return NextResponse.json({
    ...job,
    completed_phases: Object.keys(phaseScans),
    scans,
    phase_scans: phaseScans,
  });
}

// PATCH /api/jobs/:id — update job status or ops note.
// Intended for ops web UI via server actions; also accepts installer JWT as defense in depth.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "installer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const allowed = ["name", "address", "status", "phases", "ops_note"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (body.status === "completed") updates.completed_at = new Date().toISOString();
  if (body.status === "active") updates.completed_at = null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("jobs").update(updates).eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
