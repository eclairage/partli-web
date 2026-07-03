"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"approved" | "flagged">("approved");
  const [note, setNote] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "flagged" && !note.trim()) {
      setError("A note is required when flagging — it will be sent to the homeowner.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch(`/api/scans/${scanId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${prompt("Enter ops password") ?? ""}`,
      },
      body: JSON.stringify({ status, ops_note: note, reviewed_by: reviewedBy }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-4">
        {(["approved", "flagged"] as const).map((s) => (
          <label
            key={s}
            className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors ${
              status === s
                ? s === "approved"
                  ? "border-green-500 bg-green-50 text-green-800"
                  : "border-red-400 bg-red-50 text-red-800"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="status"
              value={s}
              checked={status === s}
              onChange={() => setStatus(s)}
              className="sr-only"
            />
            <span className="font-medium capitalize">{s}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Note {status === "flagged" ? "(required — sent to homeowner via SMS)" : "(optional)"}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={
            status === "flagged"
              ? "e.g. The scan was too dark — please retake with the lights on."
              : "Optional internal note"
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-partli-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
        <input
          value={reviewedBy}
          onChange={(e) => setReviewedBy(e.target.value)}
          placeholder="e.g. Alex"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-partli-accent"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2 rounded-lg bg-partli-primary text-white text-sm font-medium hover:bg-partli-primary-pressed disabled:opacity-50 transition-colors"
      >
        {loading ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
