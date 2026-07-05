import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabase";

const ALLOWED_BUCKETS = ["basin-scans", "basin-photos"];

// POST /api/storage/sign
// Body: { bucket: string, path: string }
// Returns: { signed_url: string }
//
// iOS calls this to get a short-lived signed upload URL, then PUTs the file
// directly to Supabase Storage — no storage RLS policy required on the device.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { bucket, path } = body ?? {};

  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "invalid bucket" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    console.error("signed upload URL error:", error);
    return NextResponse.json({ error: "could not create upload URL" }, { status: 500 });
  }

  return NextResponse.json({ signed_url: data.signedUrl });
}
