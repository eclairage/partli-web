import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/jobs/:id — job detail with scan history per phase (used by iOS app JobDetailView)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Build a map of phase → most recent scan for that phase
  const phaseScans: Record<string, typeof scans[0]> = {};
  for (const scan of scans) {
    if (scan.phase) phaseScans[scan.phase] = scan;
  }

  const completedPhases = Object.keys(phaseScans);

  return NextResponse.json({
    ...job,
    completed_phases: completedPhases,
    scans: scans,
    phase_scans: phaseScans,
  });
}

// PATCH /api/jobs/:id — update job status or phases
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const allowed = ["name", "address", "status", "phases", "ops_note"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Auto-stamp completed_at when marking complete / re-opening
  if (body.status === "completed") updates.completed_at = new Date().toISOString();
  if (body.status === "active")    updates.completed_at = null;

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
