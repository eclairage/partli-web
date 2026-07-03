import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Annotation } from "@/lib/supabase";

// DELETE /api/scans/:id/annotations/:annotationId
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { id, annotationId } = await params;
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
  const updated = existing.filter((a) => a.id !== annotationId);

  const { error: updateErr } = await db
    .from("scans")
    .update({ annotations: updated })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "failed to delete annotation" }, { status: 500 });
  }

  return NextResponse.json({ annotations: updated });
}
