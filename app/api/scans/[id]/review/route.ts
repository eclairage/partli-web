import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms, SMS } from "@/lib/twilio";

function verifyOpsAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer") return false;
  return token === process.env.OPS_PASSWORD;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyOpsAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body?.status || !["approved", "flagged"].includes(body.status)) {
    return NextResponse.json(
      { error: "status must be 'approved' or 'flagged'" },
      { status: 400 }
    );
  }

  if (body.status === "flagged" && !body.ops_note?.trim()) {
    return NextResponse.json(
      { error: "ops_note is required when flagging a scan" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .select("id, homeowners(phone)")
    .eq("id", id)
    .single();

  if (scanErr || !scan) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }

  const { error: updateErr } = await db
    .from("scans")
    .update({
      status: body.status,
      ops_note: body.ops_note ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: body.reviewed_by ?? "ops",
    })
    .eq("id", id);

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  const homeowner = scan.homeowners as unknown as { phone: string } | null;
  if (homeowner?.phone) {
    const sms =
      body.status === "approved"
        ? SMS.scanApproved()
        : SMS.scanFlagged(body.ops_note);
    await sendSms(homeowner.phone, sms).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
