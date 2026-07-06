"use server";

import { supabaseAdmin } from "@/lib/supabase";
import type { Annotation } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { sendSms, SMS } from "@/lib/twilio";

// ── Annotations ───────────────────────────────────────────────────────────────

export async function createAnnotation(
  scanId: string,
  input: { target: string; x: number; y: number; text: string; author: string }
): Promise<{ annotations: Annotation[] } | { error: string }> {
  if (!input.target || input.x == null || input.y == null || !input.text?.trim()) {
    return { error: "target, x, y, and text are required" };
  }

  const db = supabaseAdmin();
  const { data: scan, error } = await db
    .from("scans")
    .select("annotations")
    .eq("id", scanId)
    .single();

  if (error || !scan) return { error: "scan not found" };

  const existing = (scan.annotations as Annotation[]) ?? [];
  const newAnnotation: Annotation = {
    id: randomUUID(),
    target: input.target,
    x: input.x,
    y: input.y,
    text: input.text.trim(),
    author: input.author?.trim() || "ops",
    created_at: new Date().toISOString(),
  };
  const updated = [...existing, newAnnotation];

  const { error: updateErr } = await db
    .from("scans")
    .update({ annotations: updated })
    .eq("id", scanId);

  if (updateErr) return { error: "failed to save annotation" };
  return { annotations: updated };
}

export async function deleteAnnotation(
  scanId: string,
  annotationId: string
): Promise<{ annotations: Annotation[] } | { error: string }> {
  const db = supabaseAdmin();
  const { data: scan, error } = await db
    .from("scans")
    .select("annotations")
    .eq("id", scanId)
    .single();

  if (error || !scan) return { error: "scan not found" };

  const existing = (scan.annotations as Annotation[]) ?? [];
  const updated = existing.filter((a) => a.id !== annotationId);

  const { error: updateErr } = await db
    .from("scans")
    .update({ annotations: updated })
    .eq("id", scanId);

  if (updateErr) return { error: "failed to delete annotation" };
  return { annotations: updated };
}

// ── Scan review ───────────────────────────────────────────────────────────────

export async function reviewScan(
  scanId: string,
  input: { status: "approved" | "flagged"; ops_note: string; reviewed_by: string }
): Promise<{ ok: true } | { error: string }> {
  if (!["approved", "flagged"].includes(input.status)) {
    return { error: "status must be 'approved' or 'flagged'" };
  }
  if (input.status === "flagged" && !input.ops_note?.trim()) {
    return { error: "ops_note is required when flagging a scan" };
  }

  const db = supabaseAdmin();

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .select("id, homeowners(phone)")
    .eq("id", scanId)
    .single();

  if (scanErr || !scan) return { error: "scan not found" };

  const { error: updateErr } = await db
    .from("scans")
    .update({
      status: input.status,
      ops_note: input.ops_note || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.reviewed_by || "ops",
    })
    .eq("id", scanId);

  if (updateErr) return { error: "update failed" };

  const homeowner = scan.homeowners as unknown as { phone: string } | null;
  if (homeowner?.phone) {
    const sms =
      input.status === "approved"
        ? SMS.scanApproved()
        : SMS.scanFlagged(input.ops_note);
    await sendSms(homeowner.phone, sms).catch(console.error);
  }

  return { ok: true };
}

export async function approveScan(
  scanId: string
): Promise<{ ok: true } | { error: string }> {
  return reviewScan(scanId, { status: "approved", ops_note: "", reviewed_by: "ops" });
}

// ── Account management ────────────────────────────────────────────────────────

export async function setInstallerRole(
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const db = supabaseAdmin();
  const { error } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { role: "installer" },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removeInstallerRole(
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const db = supabaseAdmin();
  const { error } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { role: null },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removeHomeownerRecord(
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const db = supabaseAdmin();
  // Null out user_id so the homeowner record stays (preserving scan history)
  // but the account is no longer linked
  const { error } = await db
    .from("homeowners")
    .update({ user_id: null })
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { ok: true };
}

// ── Wall finishes ─────────────────────────────────────────────────────────────

export async function updateWallFinishes(
  scanId: string,
  finishes: Record<string, string>
): Promise<{ ok: true } | { error: string }> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("scans")
    .update({ wall_finishes: finishes })
    .eq("id", scanId);
  if (error) return { error: error.message };
  return { ok: true };
}

// ── Convert scan → job ────────────────────────────────────────────────────────

export async function convertScanToJob(
  scanId: string,
  input: { name: string; address: string | null; phases: string[] }
): Promise<{ job_id: string } | { error: string }> {
  if (!input.name?.trim()) return { error: "Job name is required" };
  if (!Array.isArray(input.phases) || input.phases.length === 0)
    return { error: "At least one phase is required" };

  const db = supabaseAdmin();

  // Create the job
  const { data: job, error: jobErr } = await db
    .from("jobs")
    .insert({
      name: input.name.trim(),
      address: input.address ?? null,
      phases: input.phases,
      status: "active",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error(jobErr);
    return { error: "Failed to create job" };
  }

  // Link the scan to the new job
  const { error: scanErr } = await db
    .from("scans")
    .update({ job_id: job.id })
    .eq("id", scanId);

  if (scanErr) return { error: "Job created but failed to link scan — check Supabase" };

  return { job_id: job.id };
}

// ── Job management ────────────────────────────────────────────────────────────

export async function updateJobStatus(
  jobId: string,
  input: { status?: string; ops_note?: string | null }
): Promise<{ ok: true } | { error: string }> {
  const allowed = ["status", "ops_note"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in input) updates[key] = input[key];
  }

  if (input.status === "completed") updates.completed_at = new Date().toISOString();
  if (input.status === "active") updates.completed_at = null;

  if (Object.keys(updates).length === 0) return { error: "nothing to update" };

  const db = supabaseAdmin();
  const { error } = await db.from("jobs").update(updates).eq("id", jobId);
  if (error) return { error: "update failed" };
  return { ok: true };
}
