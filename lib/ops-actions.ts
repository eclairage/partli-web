"use server";

import { supabaseAdmin } from "@/lib/supabase";
import type { Annotation, Design, DesignItem, ItemType } from "@/lib/supabase";
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

// ── Design / quote authoring ──────────────────────────────────────────────────

const DESIGNS_BUCKET = "basin-designs";

// Create a draft design for an approved scan, copying its homeowner.
export async function createDesignForScan(
  scanId: string
): Promise<{ design_id: string } | { error: string }> {
  const db = supabaseAdmin();

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .select("id, status, homeowner_id")
    .eq("id", scanId)
    .single();

  if (scanErr || !scan) return { error: "scan not found" };
  if (scan.status !== "approved")
    return { error: "scan must be approved before authoring a design" };
  if (!scan.homeowner_id)
    return { error: "scan has no homeowner — cannot author a design" };

  const { data: design, error: designErr } = await db
    .from("designs")
    .insert({
      scan_id: scan.id,
      homeowner_id: scan.homeowner_id,
      status: "draft",
    })
    .select("id")
    .single();

  if (designErr || !design) {
    console.error(designErr);
    return { error: "failed to create design" };
  }

  return { design_id: design.id };
}

// Update whitelisted editable fields on a draft/published design.
export async function updateDesign(
  designId: string,
  input: {
    title?: string | null;
    scope_summary?: string | null;
    items?: DesignItem[];
    fixed_price_cents?: number | null;
    ops_note?: string | null;
    authored_by?: string | null;
  }
): Promise<{ ok: true } | { error: string }> {
  const updates: Record<string, unknown> = {};

  if ("title" in input) updates.title = input.title ?? null;
  if ("scope_summary" in input) updates.scope_summary = input.scope_summary ?? null;
  if ("ops_note" in input) updates.ops_note = input.ops_note ?? null;
  if ("authored_by" in input) updates.authored_by = input.authored_by ?? null;

  if ("fixed_price_cents" in input) {
    const cents = input.fixed_price_cents;
    if (cents != null && (!Number.isFinite(cents) || cents < 0))
      return { error: "fixed price must be a positive amount" };
    updates.fixed_price_cents = cents ?? null;
  }

  if ("items" in input) {
    if (!Array.isArray(input.items)) return { error: "items must be an array" };
    // Normalize + ensure every item has a stable id.
    updates.items = input.items.map((it) => {
      const cents = it.new_vendor_price_cents;
      return {
        id: it.id || randomUUID(),
        item_type: (it.item_type ?? "").trim(),
        existing_photo_url: it.existing_photo_url || null,
        new_name: it.new_name?.trim() || null,
        new_image_url: it.new_image_url || null,
        new_vendor_price_cents:
          cents != null && Number.isFinite(cents) ? Math.round(cents) : null,
        new_url: it.new_url?.trim() || null,
        new_finish: it.new_finish?.trim() || null,
        new_notes: it.new_notes?.trim() || null,
      };
    });
  }

  if (Object.keys(updates).length === 0) return { error: "nothing to update" };
  updates.updated_at = new Date().toISOString();

  const db = supabaseAdmin();
  const { error } = await db.from("designs").update(updates).eq("id", designId);
  if (error) return { error: "update failed" };
  return { ok: true };
}

// Mint a signed upload URL for a rendering, plus the canonical stored URL.
// The client PUTs the file to signed_url, then calls addRenderingUrl(stored_url).
export async function createRenderingUpload(
  designId: string,
  filename: string
): Promise<{ signed_url: string; stored_url: string } | { error: string }> {
  const safe = (filename || "rendering").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${designId}/${randomUUID()}-${safe}`;

  const db = supabaseAdmin();
  const { data, error } = await db.storage
    .from(DESIGNS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("rendering upload URL error:", error);
    return { error: "could not create upload URL" };
  }

  const stored_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${DESIGNS_BUCKET}/${path}`;
  return { signed_url: data.signedUrl, stored_url };
}

// Mint a signed upload URL for a new-item image (namespaced under /items).
export async function createItemImageUpload(
  designId: string,
  filename: string
): Promise<{ signed_url: string; stored_url: string } | { error: string }> {
  const safe = (filename || "item").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${designId}/items/${randomUUID()}-${safe}`;

  const db = supabaseAdmin();
  const { data, error } = await db.storage
    .from(DESIGNS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("item image upload URL error:", error);
    return { error: "could not create upload URL" };
  }

  const stored_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${DESIGNS_BUCKET}/${path}`;
  return { signed_url: data.signedUrl, stored_url };
}

// Import a new-item image from an external URL (e.g. dragged from another tab).
// Fetched + stored server-side so we own a stable copy and avoid browser CORS.
export async function importItemImageFromUrl(
  designId: string,
  url: string
): Promise<{ stored_url: string } | { error: string }> {
  const trimmed = (url ?? "").trim();
  if (!/^https?:\/\//i.test(trimmed)) return { error: "not a valid image link" };

  let res: Response;
  try {
    res = await fetch(trimmed, { redirect: "follow" });
  } catch {
    return { error: "could not fetch that image" };
  }
  if (!res.ok) return { error: `could not fetch that image (${res.status})` };

  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) return { error: "that link isn't an image" };

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return { error: "that image was empty" };
  if (buf.length > 15 * 1024 * 1024) return { error: "image is too large (15MB max)" };

  const ext = contentType.slice("image/".length).replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = `${designId}/items/${randomUUID()}.${ext}`;

  const db = supabaseAdmin();
  const { error } = await db.storage
    .from(DESIGNS_BUCKET)
    .upload(path, buf, { contentType, upsert: false });
  if (error) {
    console.error("item image import error:", error);
    return { error: "could not save that image" };
  }

  const stored_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${DESIGNS_BUCKET}/${path}`;
  return { stored_url };
}

// ── Item types (reusable, extensible list) ─────────────────────────────────────

export async function listItemTypes(): Promise<
  { item_types: ItemType[] } | { error: string }
> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("item_types")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<ItemType[]>();
  if (error) return { error: "could not load item types" };
  return { item_types: data ?? [] };
}

export async function addItemType(
  name: string
): Promise<{ item_type: ItemType } | { error: string }> {
  const clean = (name ?? "").trim();
  if (!clean) return { error: "type name is required" };

  const db = supabaseAdmin();
  // Case-insensitive dedupe: reuse an existing type if it already exists.
  const { data: existing } = await db
    .from("item_types")
    .select("*")
    .ilike("name", clean)
    .maybeSingle<ItemType>();
  if (existing) return { item_type: existing };

  const { data, error } = await db
    .from("item_types")
    .insert({ name: clean, sort_order: 500 })
    .select("*")
    .single<ItemType>();
  if (error || !data) return { error: "could not add item type" };
  return { item_type: data };
}

export async function addRenderingUrl(
  designId: string,
  url: string
): Promise<{ rendering_urls: string[] } | { error: string }> {
  if (!url?.trim()) return { error: "url is required" };
  const db = supabaseAdmin();

  const { data: design, error } = await db
    .from("designs")
    .select("rendering_urls")
    .eq("id", designId)
    .single();
  if (error || !design) return { error: "design not found" };

  const updated = [...((design.rendering_urls as string[]) ?? []), url];
  const { error: updateErr } = await db
    .from("designs")
    .update({ rendering_urls: updated, updated_at: new Date().toISOString() })
    .eq("id", designId);
  if (updateErr) return { error: "failed to attach rendering" };
  return { rendering_urls: updated };
}

export async function removeRenderingUrl(
  designId: string,
  url: string
): Promise<{ rendering_urls: string[] } | { error: string }> {
  const db = supabaseAdmin();

  const { data: design, error } = await db
    .from("designs")
    .select("rendering_urls")
    .eq("id", designId)
    .single();
  if (error || !design) return { error: "design not found" };

  const updated = ((design.rendering_urls as string[]) ?? []).filter((u) => u !== url);
  const { error: updateErr } = await db
    .from("designs")
    .update({ rendering_urls: updated, updated_at: new Date().toISOString() })
    .eq("id", designId);
  if (updateErr) return { error: "failed to remove rendering" };
  return { rendering_urls: updated };
}

// Publish a design to the homeowner. Validates it's presentable, then notifies.
export async function publishDesign(
  designId: string
): Promise<{ ok: true } | { error: string }> {
  const db = supabaseAdmin();

  const { data: design, error } = await db
    .from("designs")
    .select("*, homeowners(phone)")
    .eq("id", designId)
    .single<Design>();

  if (error || !design) return { error: "design not found" };

  // Validation gate — a published design must be presentable.
  if (design.fixed_price_cents == null || design.fixed_price_cents <= 0)
    return { error: "set a fixed price before publishing" };
  if (!design.rendering_urls?.length && !design.items?.length)
    return { error: "add at least one item or rendering before publishing" };
  if (!design.scope_summary?.trim())
    return { error: "write a scope summary before publishing" };

  const { error: updateErr } = await db
    .from("designs")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      version: (design.version ?? 1) + (design.published_at ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId);

  if (updateErr) return { error: "failed to publish" };

  const homeowner = design.homeowners as unknown as { phone: string } | null;
  if (homeowner?.phone) {
    await sendSms(homeowner.phone, SMS.designReady()).catch(console.error);
  }

  return { ok: true };
}

// Revert a published design to draft for corrections during the pilot.
export async function unpublishDesign(
  designId: string
): Promise<{ ok: true } | { error: string }> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("designs")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", designId);
  if (error) return { error: "failed to unpublish" };
  return { ok: true };
}
