import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin, signedStorageUrl } from "@/lib/supabase";
import type { Design, DesignItem, Homeowner } from "@/lib/supabase";
import DesignPlanPdf, { type PlanItem } from "./DesignPlanPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ops/designs/[id]/plan.pdf[?internal=1]
// Ops-facing PDF design plan: existing → replacement for every item.
// Homeowner copy hides vendor prices; ?internal=1 includes them + a cost total.
async function toDataUri(
  db: ReturnType<typeof supabaseAdmin>,
  rawUrl: string | null
): Promise<string | null> {
  if (!rawUrl) return null;
  const signed = await signedStorageUrl(db, rawUrl);
  if (!signed) return null;
  try {
    const res = await fetch(signed);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const internal = req.nextUrl.searchParams.get("internal") === "1";

  const db = supabaseAdmin();
  const { data: design } = await db
    .from("designs")
    .select("*, homeowners(*)")
    .eq("id", id)
    .single<Design>();

  if (!design) return NextResponse.json({ error: "not found" }, { status: 404 });

  const hw = design.homeowners as unknown as Homeowner | null;
  const rawItems = (design.items ?? []) as DesignItem[];

  const items: PlanItem[] = await Promise.all(
    rawItems.map(async (it) => ({
      item_type: it.item_type,
      existing_data_uri: await toDataUri(db, it.existing_photo_url),
      new_data_uri: await toDataUri(db, it.new_image_url),
      new_name: it.new_name,
      new_finish: it.new_finish,
      new_url: it.new_url,
      new_notes: it.new_notes,
      new_vendor_price_cents: it.new_vendor_price_cents,
    }))
  );

  // Call the component as a function so the top-level element is the <Document>
  // that renderToBuffer expects.
  const buffer = await renderToBuffer(
    DesignPlanPdf({
      projectTitle: design.title ?? "Bathroom Design Plan",
      homeownerName: hw?.name ?? null,
      address: hw?.address ?? null,
      scopeSummary: design.scope_summary,
      fixedPriceCents: design.fixed_price_cents,
      items,
      internal,
      generatedAt: new Date().toLocaleDateString(),
    })
  );

  const safeName = (design.title ?? "design-plan").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `${safeName}${internal ? "-internal" : ""}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
