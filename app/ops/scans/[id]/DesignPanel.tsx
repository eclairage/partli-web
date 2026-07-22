"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Design, DesignItem } from "@/lib/supabase";
import {
  createDesignForScan,
  updateDesign,
  createRenderingUpload,
  addRenderingUrl,
  removeRenderingUrl,
  createItemImageUpload,
  importItemImageFromUrl,
  addItemType,
  publishDesign,
  unpublishDesign,
} from "@/lib/ops-actions";

// Pull an image URL out of a drag from another browser window.
function imageUrlFromDrop(dt: DataTransfer): string | null {
  const uri = (dt.getData("text/uri-list") || dt.getData("text/plain") || "").trim();
  const first = uri.split(/[\r\n]+/).find((l) => /^https?:\/\//i.test(l));
  if (first) return first;
  const html = dt.getData("text/html");
  const m = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m && /^https?:\/\//i.test(m[1]) ? m[1] : null;
}

// Renderings are passed as { url (stored), signedUrl (display) } pairs.
type Rendering = { url: string; signedUrl: string };
// Scan photos the existing item can be picked from.
type ScanPhoto = { url: string; signedUrl: string };

function dollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
function toCents(input: string): number | null {
  const n = parseFloat(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
}
function newDesignItem(item_type = ""): DesignItem {
  return {
    id: uuid(),
    item_type,
    existing_photo_url: null,
    new_name: null,
    new_image_url: null,
    new_vendor_price_cents: null,
    new_url: null,
    new_finish: null,
    new_notes: null,
  };
}

export default function DesignPanel({
  scanId,
  design,
  renderings,
  scanPhotos,
  itemTypes,
  itemImageSignedUrls,
  defaultTitle,
}: {
  scanId: string;
  design: Design | null;
  renderings: Rendering[];
  scanPhotos: ScanPhoto[];
  itemTypes: string[];
  itemImageSignedUrls: Record<string, string>;
  defaultTitle: string;
}) {
  const router = useRouter();

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
          Designate the items being replaced, attach renderings, set one fixed
          price, then publish the design to the homeowner.
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
      scanPhotos={scanPhotos}
      itemTypes={itemTypes}
      itemImageSignedUrls={itemImageSignedUrls}
      defaultTitle={defaultTitle}
    />
  );
}

function DesignEditor({
  design,
  renderings,
  scanPhotos,
  itemTypes,
  itemImageSignedUrls,
  defaultTitle,
}: {
  design: Design;
  renderings: Rendering[];
  scanPhotos: ScanPhoto[];
  itemTypes: string[];
  itemImageSignedUrls: Record<string, string>;
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
  const [items, setItems] = useState<DesignItem[]>(design.items ?? []);
  const [types, setTypes] = useState<string[]>(itemTypes);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploadingRendering, setUploadingRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [addingTypeFor, setAddingTypeFor] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState("");
  // Instant local previews for freshly uploaded new-item images (raw url -> objectURL)
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  // Raw text for each item's vendor-price field, so typing isn't reformatted mid-entry.
  const [vendorPriceStr, setVendorPriceStr] = useState<Record<string, string>>({});

  const fixedCents = toCents(priceStr);
  const internalCostCents = items.reduce(
    (sum, it) => sum + (it.new_vendor_price_cents || 0),
    0
  );

  function patchItem(id: string, patch: Partial<DesignItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function existingPhotoSignedUrl(rawUrl: string | null): string | null {
    if (!rawUrl) return null;
    return scanPhotos.find((p) => p.url === rawUrl)?.signedUrl ?? rawUrl;
  }
  function newImageDisplayUrl(it: DesignItem): string | null {
    if (!it.new_image_url) return null;
    return localPreviews[it.new_image_url] ?? itemImageSignedUrls[it.new_image_url] ?? null;
  }

  function persistPayload() {
    return {
      title: title.trim() || null,
      scope_summary: scope.trim() || null,
      ops_note: opsNote.trim() || null,
      authored_by: authoredBy.trim() || null,
      fixed_price_cents: fixedCents,
      items,
    };
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await updateDesign(design.id, persistPayload());
    if ("error" in res) setError(res.error);
    else {
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRenderingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingRendering(true);
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
    setUploadingRendering(false);
  }

  async function removeRendering(url: string) {
    setBusy(true);
    await removeRenderingUrl(design.id, url);
    setBusy(false);
    router.refresh();
  }

  async function uploadItemFile(itemId: string, file: File) {
    setError("");
    setImportingId(itemId);
    try {
      const signed = await createItemImageUpload(design.id, file.name);
      if ("error" in signed) throw new Error(signed.error);
      const put = await fetch(signed.signed_url, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      // Instant preview + set the stored url on the item (persisted on Save).
      setLocalPreviews((p) => ({ ...p, [signed.stored_url]: URL.createObjectURL(file) }));
      patchItem(itemId, { new_image_url: signed.stored_url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    }
    setImportingId(null);
  }

  async function handleItemImageUpload(
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadItemFile(itemId, file);
  }

  // Drop from another browser window (image URL) or the desktop (a file).
  async function handleItemImageDrop(itemId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    if (locked) return;
    setError("");

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await uploadItemFile(itemId, file);
      return;
    }

    const url = imageUrlFromDrop(e.dataTransfer);
    if (!url) {
      setError("Drop an image, or an image dragged from another browser tab.");
      return;
    }
    setImportingId(itemId);
    const res = await importItemImageFromUrl(design.id, url);
    if ("error" in res) setError(res.error);
    else {
      // Preview with the original URL (already rendering in the source tab);
      // the server copy gets a signed URL on next refresh.
      setLocalPreviews((p) => ({ ...p, [res.stored_url]: url }));
      patchItem(itemId, { new_image_url: res.stored_url });
    }
    setImportingId(null);
  }

  async function confirmAddType(itemId: string) {
    const name = newTypeName.trim();
    if (!name) return;
    const res = await addItemType(name);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    const added = res.item_type.name;
    setTypes((prev) => (prev.includes(added) ? prev : [...prev, added]));
    patchItem(itemId, { item_type: added });
    setAddingTypeFor(null);
    setNewTypeName("");
  }

  async function publish() {
    setBusy(true);
    setError("");
    const saveRes = await updateDesign(design.id, persistPayload());
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
    fixedCents != null &&
    fixedCents > 0 &&
    scope.trim().length > 0 &&
    (renderings.length > 0 || items.length > 0);

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
            published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {design.status}
          {design.version > 1 ? ` · v${design.version}` : ""}
        </span>
      </div>

      {published && (
        <p className="text-xs text-slate-500">
          Published{" "}
          {design.published_at ? new Date(design.published_at).toLocaleString() : ""}. Unpublish
          to make edits.
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

      {/* Items to replace */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Items to replace
          </label>
          {!locked && (
            <button
              onClick={() => setItems((p) => [...p, newDesignItem()])}
              className="text-xs text-partli-accent hover:underline"
            >
              + Add item
            </button>
          )}
        </div>

        <div className="space-y-3">
          {items.map((it) => {
            const existingUrl = existingPhotoSignedUrl(it.existing_photo_url);
            const newUrl = newImageDisplayUrl(it);
            return (
              <div key={it.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                {/* Item type + remove */}
                <div className="flex items-center gap-2">
                  {addingTypeFor === it.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && confirmAddType(it.id)}
                        placeholder="New item type"
                        className={input}
                      />
                      <button
                        onClick={() => confirmAddType(it.id)}
                        className="px-3 py-1.5 rounded bg-partli-primary text-white text-xs font-medium hover:bg-partli-primary-pressed"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingTypeFor(null);
                          setNewTypeName("");
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <select
                      value={it.item_type}
                      disabled={locked}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setAddingTypeFor(it.id);
                          setNewTypeName("");
                        } else {
                          patchItem(it.id, { item_type: e.target.value });
                        }
                      }}
                      className={`${input} flex-1 font-medium`}
                    >
                      <option value="">Select item type…</option>
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {it.item_type && !types.includes(it.item_type) && (
                        <option value={it.item_type}>{it.item_type}</option>
                      )}
                      {!locked && <option value="__new__">＋ Add new type…</option>}
                    </select>
                  )}
                  {!locked && (
                    <button
                      onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                      className="text-slate-400 hover:text-red-600 text-lg leading-none px-1"
                      title="Remove item"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Existing */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      Existing
                    </p>
                    {existingUrl ? (
                      <div className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={existingUrl}
                          alt="Existing item"
                          className="w-full aspect-video object-cover rounded border border-slate-200"
                        />
                        {!locked && (
                          <button
                            onClick={() =>
                              setPickerOpenId(pickerOpenId === it.id ? null : it.id)
                            }
                            className="absolute bottom-1 right-1 bg-white/90 text-slate-700 rounded px-2 py-0.5 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Change
                          </button>
                        )}
                      </div>
                    ) : (
                      !locked && (
                        <button
                          onClick={() =>
                            setPickerOpenId(pickerOpenId === it.id ? null : it.id)
                          }
                          className="w-full aspect-video rounded border-2 border-dashed border-slate-300 text-slate-400 text-xs hover:border-partli-accent hover:text-partli-accent transition-colors"
                        >
                          Choose from scan photos
                        </button>
                      )
                    )}
                    {pickerOpenId === it.id && !locked && (
                      <div className="mt-2 grid grid-cols-4 gap-1.5 rounded border border-slate-200 p-2 bg-slate-50">
                        {scanPhotos.length === 0 && (
                          <p className="col-span-4 text-[11px] text-slate-400 py-2 text-center">
                            No scan photos available.
                          </p>
                        )}
                        {scanPhotos.map((p) => (
                          <button
                            key={p.url}
                            onClick={() => {
                              patchItem(it.id, { existing_photo_url: p.url });
                              setPickerOpenId(null);
                            }}
                            className={`aspect-square rounded overflow-hidden border-2 ${
                              it.existing_photo_url === p.url
                                ? "border-partli-accent"
                                : "border-transparent hover:border-slate-300"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.signedUrl} alt="Scan photo" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* New */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      New
                    </p>
                    {(() => {
                      const dropProps = locked
                        ? {}
                        : {
                            onDragOver: (e: React.DragEvent) => {
                              e.preventDefault();
                              setDragOverId(it.id);
                            },
                            onDragLeave: () => setDragOverId((d) => (d === it.id ? null : d)),
                            onDrop: (e: React.DragEvent) => handleItemImageDrop(it.id, e),
                          };
                      const dragRing =
                        dragOverId === it.id ? "ring-2 ring-partli-accent ring-offset-1" : "";
                      return newUrl ? (
                        <div className={`relative group mb-2 rounded ${dragRing}`} {...dropProps}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={newUrl}
                            alt="New item"
                            className="w-full aspect-video object-cover rounded border border-slate-200"
                          />
                          {importingId === it.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded text-[11px] text-slate-600">
                              Importing…
                            </div>
                          )}
                          {!locked && (
                            <label className="absolute bottom-1 right-1 bg-white/90 text-slate-700 rounded px-2 py-0.5 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              Replace
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleItemImageUpload(it.id, e)}
                                className="sr-only"
                              />
                            </label>
                          )}
                        </div>
                      ) : (
                        !locked && (
                          <label
                            className={`mb-2 flex flex-col items-center justify-center w-full aspect-video rounded border-2 border-dashed text-slate-400 text-xs cursor-pointer transition-colors ${
                              dragOverId === it.id
                                ? "border-partli-accent text-partli-accent bg-partli-accent/5"
                                : "border-slate-300 hover:border-partli-accent hover:text-partli-accent"
                            }`}
                            {...dropProps}
                          >
                            {importingId === it.id ? (
                              "Importing…"
                            ) : (
                              <>
                                <span>+ Upload or drop image</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  drag from another browser tab
                                </span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleItemImageUpload(it.id, e)}
                              className="sr-only"
                            />
                          </label>
                        )
                      );
                    })()}
                    <div className="space-y-2">
                      <input
                        value={it.new_name ?? ""}
                        onChange={(e) => patchItem(it.id, { new_name: e.target.value })}
                        disabled={locked}
                        placeholder="Product name"
                        className={input}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={it.new_finish ?? ""}
                          onChange={(e) => patchItem(it.id, { new_finish: e.target.value })}
                          disabled={locked}
                          placeholder="Finish"
                          className={input}
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1.5 text-sm text-slate-400">$</span>
                          <input
                            value={
                              vendorPriceStr[it.id] ??
                              (it.new_vendor_price_cents != null
                                ? dollars(it.new_vendor_price_cents)
                                : "")
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setVendorPriceStr((p) => ({ ...p, [it.id]: v }));
                              patchItem(it.id, { new_vendor_price_cents: toCents(v) });
                            }}
                            disabled={locked}
                            placeholder="Vendor price"
                            title="Internal only — not shown to homeowner"
                            className={`${input} pl-5 text-right`}
                          />
                        </div>
                      </div>
                      <input
                        value={it.new_url ?? ""}
                        onChange={(e) => patchItem(it.id, { new_url: e.target.value })}
                        disabled={locked}
                        placeholder="Product URL"
                        className={input}
                      />
                      <textarea
                        value={it.new_notes ?? ""}
                        onChange={(e) => patchItem(it.id, { new_notes: e.target.value })}
                        disabled={locked}
                        rows={2}
                        placeholder="Notes"
                        className={input}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-xs text-slate-400">No items yet. Add each fixture/finish being replaced.</p>
          )}
        </div>
        {items.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-2 text-right">
            Internal vendor-cost total:{" "}
            <span className="font-mono">${dollars(internalCostCents)}</span> (not shown to homeowner)
          </p>
        )}
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
              {uploadingRendering ? "Uploading…" : "+ Add rendering"}
              <input
                type="file"
                accept="image/*"
                onChange={handleRenderingUpload}
                disabled={uploadingRendering}
                className="sr-only"
              />
            </label>
          )}
        </div>
      </div>

      {/* Fixed price */}
      <div className="rounded-md bg-white border border-slate-200 p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Fixed price{" "}
          <span className="text-slate-400 normal-case font-normal">
            (the one number the homeowner sees)
          </span>
        </label>
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
      <div className="flex flex-wrap items-center gap-3 pt-1">
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
                  : "Needs a fixed price, a scope summary, and at least one item or rendering"
              }
              className="px-5 py-2 rounded-lg bg-partli-primary text-white text-sm font-medium hover:bg-partli-primary-pressed disabled:opacity-50 transition-colors"
            >
              {busy ? "Publishing…" : "Publish to homeowner"}
            </button>
            {savedAt && <span className="text-xs text-slate-400">Saved {savedAt}</span>}
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

        {items.length > 0 && (
          <div className="flex items-center gap-3 ml-auto">
            <a
              href={`/api/ops/designs/${design.id}/plan.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-partli-accent hover:underline"
            >
              ↓ Design plan PDF
            </a>
            <a
              href={`/api/ops/designs/${design.id}/plan.pdf?internal=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
              title="Includes internal vendor prices"
            >
              (internal copy)
            </a>
          </div>
        )}
      </div>
      {!locked && items.length > 0 && (
        <p className="text-[11px] text-slate-400">
          Save the draft before generating the PDF so it reflects your latest edits.
        </p>
      )}
    </section>
  );
}
