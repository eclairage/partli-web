import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserIdFromRequest } from "@/lib/supabase";
import type { Design } from "@/lib/supabase";

// GET /api/homeowners/designs
// Returns the current homeowner's published (or approved) design, with signed
// rendering URLs, ready for the in-app design viewer + approve action.
//
// Response (200):
// {
//   design: {
//     id, title, scope_summary, status, version, published_at,
//     fixed_price_cents,
//     line_items: [{ id, label, description, qty, amount_cents }],
//     rendering_urls: string[]   // short-lived signed URLs
//   }
// }
// { design: null } when nothing is published yet.
//
// NOTE: internal fields (ops_note, authored_by) are intentionally omitted.
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const { data: homeowner } = await db
    .from("homeowners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!homeowner) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: design } = await db
    .from("designs")
    .select("*")
    .eq("homeowner_id", homeowner.id)
    .in("status", ["published", "approved"])
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<Design>();

  if (!design) return NextResponse.json({ design: null });

  // Sign rendering URLs for private-bucket access.
  const rendering_urls = await Promise.all(
    (design.rendering_urls ?? []).map(async (raw) => {
      const match = raw.match(/\/storage\/v1\/object\/([^/]+)\/(.+)$/);
      if (!match) return raw;
      const [, bucket, path] = match;
      const { data } = await db.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl ?? raw;
    })
  );

  return NextResponse.json({
    design: {
      id: design.id,
      title: design.title,
      scope_summary: design.scope_summary,
      status: design.status,
      version: design.version,
      published_at: design.published_at,
      fixed_price_cents: design.fixed_price_cents,
      line_items: design.line_items ?? [],
      rendering_urls,
    },
  });
}
