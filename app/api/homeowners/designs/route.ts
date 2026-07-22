import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getUserIdFromRequest } from "@/lib/supabase";
import type { Design, DesignItem } from "@/lib/supabase";

// GET /api/homeowners/designs
// Returns the current homeowner's published (or approved) design, with signed
// image URLs, ready for the in-app design viewer + approve action.
//
// Response (200):
// {
//   design: {
//     id, title, scope_summary, status, version, published_at,
//     fixed_price_cents,
//     rendering_urls: string[],                 // short-lived signed URLs
//     items: [{                                 // existing → replacement
//       id, item_type,
//       existing_photo_url,                     // signed URL (nullable)
//       new_name, new_image_url,                // new_image_url signed (nullable)
//       new_url, new_finish, new_notes
//     }]
//   }
// }
// { design: null } when nothing is published yet.
//
// NOTE: internal fields (ops_note, authored_by, new_vendor_price_cents) are
// intentionally omitted from the homeowner payload.
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  async function sign(raw: string | null): Promise<string | null> {
    if (!raw) return null;
    const match = raw.match(/\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (!match) return raw;
    const [, bucket, path] = match;
    const { data } = await db.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? raw;
  }

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

  const rendering_urls = (
    await Promise.all((design.rendering_urls ?? []).map((raw) => sign(raw)))
  ).filter((u): u is string => u != null);

  // Items with signed images; vendor price stripped.
  const items = await Promise.all(
    ((design.items ?? []) as DesignItem[]).map(async (it) => ({
      id: it.id,
      item_type: it.item_type,
      existing_photo_url: await sign(it.existing_photo_url),
      new_name: it.new_name,
      new_image_url: await sign(it.new_image_url),
      new_url: it.new_url,
      new_finish: it.new_finish,
      new_notes: it.new_notes,
    }))
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
      rendering_urls,
      items,
    },
  });
}
