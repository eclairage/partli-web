"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Design, DesignLineItem } from "@/lib/supabase";
import {
  createDesignForScan,
  updateDesign,
  createRenderingUpload,
  addRenderingUrl,
  removeRenderingUrl,
  publishDesign,
  unpublishDesign,
} from "@/lib/ops-actions";

// Renderings are passed as { url (stored), signedUrl (display) } pairs.
type Rendering = { url: string; signedUrl: string };

function dollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
function toCents(input: string): number | null {
  const n = parseFloat(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
function newLineItem(): DesignLineItem {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random()),
    label: "",
    description: null,
    qty: 1,
    amount_cents: 0,
  };
}

export default function DesignPanel({
  scanId,
  design,
  renderings,
  defaultTitle,
}: {
  scanId: string;
  design: Design | null;
  renderings: Rendering[];
  defaultTitle: string;
}) {
  const router = useRouter();

  // ── No design yet — empty state ────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  async function startDesign() {
    setCreating(true);
    setCreateErr("");
    const res = await createDesignForScan(scanId);
    if ("error" in res) {
      setCreateErr(res.error);
      setCreating(false);
    } else {
      router.refresh();
    }
  }

  if (!design) {
    return (
      <section className="rounded-lg border border-partli-accent/30 bg-partli-accent/5 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-partli-accent mb-1">
          Design &amp; Quote
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Attach renderings, build line items, set one fixed price, then publish
          the design to the homeowner.
        </p>
        {createErr && <p className="text-sm text-red-600 mb-2">{createErr}</p>}
        <button
          onClick={startDesign}
          disabled={creating}
          className="px-5 py-2 rounded-lg bg-partli-primary text-white text-sm font-medium hover:bg-partli-primary-pressed disabled:opacity-50 transition-colors"
        >
          {creating ? "Starting…" : "Start design"}
        </button>
      </section>
    );
  }

  return (
    <DesignEditor
      design={design}
      renderings={renderings}
      defaultTitle={defaultTitle}
    />
  );
}

function DesignEditor({
  design,
  renderings,
  defaultTitle,
}: {
  design: Design;
  renderings: Rendering[];
  defaultTitle: string;
}) {
  const router = useRouter();
  const published = design.status === "published" || design.status === "approved";
  const locked = published; // fields read-only once published; unpublish to edit

  const [title, setTitle] = useState(design.title ?? defaultTitle);
  const [scope, setScope] = useState(design.scope_summary ?? "");
  const [opsNote, setOpsNote] = useState(design.ops_note ?? "");
  const [authoredBy, setAuthoredBy] = useState(design.authored_by ?? "");
  const [priceStr, setPriceStr] = useState(dollars(design.fixed_price_cents));
  const [items, setItems] = useState<DesignLineItem[]>(design.line_items ?? []);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const subtotalCents = items.reduce(
    (sum, li) => sum + (li.amount_cents || 0) * (li.qty || 1),
    0
  );
  const fixedCents = toCents(priceStr);

  function patchItem(id: string, patch: Partial<DesignLineItem>) {
    setItems((prev) => prev.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await updateDesign(design.id, {
      title: title.trim() || null,
      scope_summary: scope.trim() || null,
      ops_note: opsNote.trim() || null,
      authored_by: authoredBy.trim() || null,
      fixed_price_cents: fixedCents,
      line_items: items,
    });
    if ("error" in res) {
      setError(res.error);
    } else {
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    }
    setSaving(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const signed = await createRenderingUpload(design.id, file.name);
      if ("error" in signed) throw new Error(signed.error);
      const put = await fetch(signed.signed_url, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      const attach = await addRenderingUrl(design.id, signed.stored_url);
      if ("error" in attach) throw new Error(attach.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    }
    setUploading(false);
  }

  async function removeRendering(url: string) {
    setBusy(true);
    await removeRenderingUrl(design.id, url);
    setBusy(false);
    router.refresh();
  }

  async function publish() {
    setBusy(true);
    setError("");
    // Persist edits first so we publish exactly what's on screen.
    const saveRes = await updateDesign(design.id, {
      title: title.trim() || null,
      scope_summary: scope.trim() || null,
      ops_note: opsNote.trim() || null,
      authored_by: authoredBy.trim() || null,
      fixed_price_cents: fixedCents,
      line_items: items,
    });
    if ("error" in saveRes) {
      setError(saveRes.error);
      setBusy(false);
      return;
    }
    const res = await publishDesign(design.id);
    if ("error" in res) setError(res.error);
    else router.refresh();
    setBusy(false);
  }

  async function unpublish() {
    setBusy(true);
    await unpublishDesign(design.id);
    setBusy(false);
    router.refresh();
  }

  const canPublish =
    fixedCents != null && fixedCents > 0 && renderings.length > 0 && scope.trim().length > 0;

  const input =
    "w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-partli-accent disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <section className="rounded-lg border border-partli-accent/30 bg-partli-accent/5 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-partli-accent">
          Design &amp; Quote
        </h2>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            published
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {design.status}
          {design.version > 1 ? ` · v${design.version}` : ""}
        </span>
      </div>

      {published && (
        <p className="text-xs text-slate-500">
          Published{" "}
          {design.published_at
            ? new Date(design.published_at).toLocaleString()
            : ""}
          . Unpublish to make edits.
        </p>
      )}

      {/* Title + scope */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={locked}
            placeholder="e.g. Guest bath refresh"
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Scope summary <span className="text-slate-400">(shown to homeowner)</span>
          </label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={locked}
            rows={3}
            placeholder="Plain-language description of what's included in this renovation."
            className={input}
          />
        </div>
      </div>

      {/* Renderings */}
      <div>
        <label className="block text-xs text-slate-500 mb-2">Renderings</label>
        <div className="grid grid-cols-3 gap-3">
          {renderings.map((r) => (
            <div key={r.url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.signedUrl}
                alt="Design rendering"
                className="w-full aspect-square object-cover rounded-lg border border-slate-200"
              />
              {!locked && (
                <button
                  onClick={() => removeRendering(r.url)}
                  disabled={busy}
                  className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 text-slate-400 text-xs cursor-pointer hover:border-partli-accent hover:text-partli-accent transition-colors">
              {uploading ? "Uploading…" : "+ Add rendering"}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="sr-only"
              />
            </label>
          )}
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs text-slate-500">Line items</label>
          {!locked && (
            <button
              onClick={() => setItems((p) => [...p, newLineItem()])}
              className="text-xs text-partli-accent hover:underline"
            >
              + Add line item
            </button>
          )}
        </div>
        <div className="space-y-2">
          {items.map((li) => (
            <div key={li.id} className="grid grid-cols-12 gap-2 items-start">
              <input
                value={li.label}
                onChange={(e) => patchItem(li.id, { label: e.target.value })}
                disabled={locked}
                placeholder="Item"
                className={`col-span-3 ${input}`}
              />
              <input
                value={li.description ?? ""}
                onChange={(e) =>
                  patchItem(li.id, { description: e.target.value || null })
                }
                disabled={locked}
                placeholder="Description"
                className={`col-span-5 ${input}`}
              />
              <input
                type="number"
                min={1}
                value={li.qty}
                onChange={(e) =>
                  patchItem(li.id, { qty: parseInt(e.target.value) || 1 })
                }
                disabled={locked}
                placeholder="Qty"
                className={`col-span-1 ${input} text-center`}
              />
              <div className="col-span-2 relative">
                <span className="absolute left-2 top-1.5 text-sm text-slate-400">$</span>
                <input
                  value={li.amount_cents ? dollars(li.amount_cents) : ""}
                  onChange={(e) =>
                    patchItem(li.id, { amount_cents: toCents(e.target.value) ?? 0 })
                  }
                  disabled={locked}
                  placeholder="0.00"
                  className={`${input} pl-5 text-right`}
                />
              </div>
              {!locked && (
                <button
                  onClick={() =>
                    setItems((p) => p.filter((x) => x.id !== li.id))
                  }
                  className="col-span-1 text-slate-400 hover:text-red-600 text-sm py-1"
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-slate-400">No line items yet.</p>
          )}
        </div>
        {items.length > 0 && (
          <p className="text-xs text-slate-500 mt-2 text-right">
            Line-item subtotal:{" "}
            <span className="font-mono">${dollars(subtotalCents)}</span>
          </p>
        )}
      </div>

      {/* Fixed price */}
      <div className="rounded-md bg-white border border-slate-200 p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Fixed price <span className="text-slate-400 normal-case font-normal">(the one number the homeowner sees)</span>
        </label>
        <div className="flex items-center gap-3">
          <div className="relative w-40">
            <span className="absolute left-3 top-2 text-slate-400">$</span>
            <input
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              disabled={locked}
              placeholder="0.00"
              className="w-full rounded border border-slate-300 pl-6 pr-3 py-1.5 text-lg font-semibold font-mono text-partli-ink focus:outline-none focus:ring-1 focus:ring-partli-accent disabled:bg-slate-50"
            />
          </div>
          {fixedCents != null && fixedCents !== subtotalCents && items.length > 0 && (
            <span className="text-xs text-amber-600">
              differs from subtotal (${dollars(subtotalCents)})
            </span>
          )}
        </div>
      </div>

      {/* Internal note + author */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Internal note <span className="text-slate-400">(never shown to homeowner)</span>
          </label>
          <textarea
            value={opsNote}
            onChange={(e) => setOpsNote(e.target.value)}
            disabled={locked}
            rows={2}
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Authored by</label>
          <input
            value={authoredBy}
            onChange={(e) => setAuthoredBy(e.target.value)}
            disabled={locked}
            placeholder="e.g. Alex"
            className={input}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        {!locked ? (
          <>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={publish}
              disabled={busy || !canPublish}
              title={
                canPublish
                  ? ""
                  : "Needs a fixed price, at least one rendering, and a scope summary"
              }
              className="px-5 py-2 rounded-lg bg-partli-primary text-white text-sm font-medium hover:bg-partli-primary-pressed disabled:opacity-50 transition-colors"
            >
              {busy ? "Publishing…" : "Publish to homeowner"}
            </button>
            {savedAt && (
              <span className="text-xs text-slate-400">Saved {savedAt}</span>
            )}
          </>
        ) : (
          <button
            onClick={unpublish}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {busy ? "Working…" : "Unpublish to edit"}
          </button>
        )}
      </div>
    </section>
  );
}
