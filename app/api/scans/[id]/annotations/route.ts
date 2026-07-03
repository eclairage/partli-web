import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Annotation } from "@/lib/supabase";
import { randomUUID } from "crypto";

// NOTE: Run this migration in Supabase before deploying:
//   ALTER TABLE scans ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '[]';

// GET /api/scans/:id/annotations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("scans")
    .select("annotations")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }

  return NextResponse.json({ annotations: (data.annotations as Annotation[]) ?? [] });
}

// POST /api/scans/:id/annotations
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body?.target || body.x == null || body.y == null || !body.text?.trim()) {
    return NextResponse.json(
      { error: "target, x, y, and text are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: scan, error } = await db
    .from("scans")
    .select("annotations")
    .eq("id", id)
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }

  const existing = (scan.annotations as Annotation[]) ?? [];
  const newAnnotation: Annotation = {
    id: randomUUID(),
    target: body.target,
    x: body.x,
    y: body.y,
    text: body.text.trim(),
    author: body.author?.trim() || "ops",
    created_at: new Date().toISOString(),
  };

  const updated = [...existing, newAnnotation];

  const { error: updateErr } = await db
    .from("scans")
    .update({ annotations: updated })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "failed to save annotation" }, { status: 500 });
  }

  return NextResponse.json({ annotations: updated }, { status: 201 });
}
