import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserIdFromRequest } from "@/lib/supabase";

// GET /api/homeowners — return the current user's homeowner profile (if any)
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data } = await db
    .from("homeowners")
    .select("id, name, address, phone")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

// POST /api/homeowners — create homeowner profile (idempotent: returns existing if already created)
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Idempotent — return existing profile if this auth user already has one
  const { data: existing } = await db
    .from("homeowners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ homeowner_id: existing.id });
  }

  const { data, error } = await db
    .from("homeowners")
    .insert({
      user_id: userId,
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(error);
    return NextResponse.json({ error: "failed to create homeowner" }, { status: 500 });
  }

  return NextResponse.json({ homeowner_id: data.id }, { status: 201 });
}
