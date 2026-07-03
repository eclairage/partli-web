import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabase";

// GET /api/jobs — list active jobs (installer only)
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "installer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("jobs")
    .select("id, name, address, status, phases, completed_phases, created_at")
    .in("status", ["active"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "failed to fetch jobs" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}

// POST /api/jobs — create a new job (installer only)
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "installer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  if (!body?.name || !Array.isArray(body?.phases) || body.phases.length === 0) {
    return NextResponse.json(
      { error: "name and phases (non-empty array) are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("jobs")
    .insert({
      name: body.name,
      address: body.address ?? null,
      phases: body.phases,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(error);
    return NextResponse.json({ error: "failed to create job" }, { status: 500 });
  }

  return NextResponse.json({ job_id: data.id }, { status: 201 });
}
