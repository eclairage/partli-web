import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms, SMS } from "@/lib/twilio";
import { notifyOps } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.room_data) {
    return NextResponse.json({ error: "room_data is required" }, { status: 400 });
  }

  // Must have either a job_id (installer flow) or homeowner_id (homeowner self-scan flow)
  if (!body?.job_id && !body?.homeowner_id) {
    return NextResponse.json(
      { error: "job_id or homeowner_id is required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  let notifyName = "unknown";

  // Installer / job flow
  if (body.job_id) {
    if (!body.phase) {
      return NextResponse.json({ error: "phase is required when job_id is provided" }, { status: 400 });
    }

    const { data: job, error: jobErr } = await db
      .from("jobs")
      .select("id, name")
      .eq("id", body.job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    notifyName = `${job.name} — ${body.phase}`;
  }

  // Homeowner self-scan flow (original)
  if (body.homeowner_id && !body.job_id) {
    const { data: homeowner, error: hwErr } = await db
      .from("homeowners")
      .select("id, name, phone")
      .eq("id", body.homeowner_id)
      .single();

    if (hwErr || !homeowner) {
      return NextResponse.json({ error: "homeowner not found" }, { status: 404 });
    }
    notifyName = homeowner.name;
    await sendSms(homeowner.phone, SMS.scanReceived()).catch(console.error);
  }

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .insert({
      homeowner_id: body.homeowner_id ?? null,
      job_id: body.job_id ?? null,
      phase: body.phase ?? null,
      room_data: body.room_data,
      usdz_url: body.usdz_url ?? null,
      photo_urls: body.photo_urls ?? [],
      intake_data: body.intake_data ?? null,
      path_room_data: body.path_room_data ?? null,
      path_usdz_url: body.path_usdz_url ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (scanErr || !scan) {
    console.error(scanErr);
    return NextResponse.json({ error: "failed to create scan" }, { status: 500 });
  }

  await notifyOps(scan.id, notifyName).catch(console.error);

  return NextResponse.json({ scan_id: scan.id }, { status: 201 });
}
