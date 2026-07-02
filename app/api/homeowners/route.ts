import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.name || !body?.phone) {
    return NextResponse.json(
      { error: "name and phone are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  // Return existing homeowner if phone already registered
  const { data: existing } = await db
    .from("homeowners")
    .select("id")
    .eq("phone", body.phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ homeowner_id: existing.id });
  }

  const { data, error } = await db
    .from("homeowners")
    .insert({
      name: body.name,
      phone: body.phone,
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
