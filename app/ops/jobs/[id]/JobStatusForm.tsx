"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateJobStatus } from "@/lib/ops-actions";

type JobStatus = "active" | "completed" | "archived";

interface Props {
  jobId: string;
  currentStatus: JobStatus;
  currentNote: string | null;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

const STATUS_STYLE: Record<JobStatus, string> = {
  active:    "bg-green-50 border-green-300 text-green-800",
  completed: "bg-slate-50 border-slate-300 text-slate-700",
  archived:  "bg-slate-50 border-slate-200 text-slate-400",
};

export default function JobStatusForm({ jobId, currentStatus, currentNote }: Props) {
  const router = useRouter();
  const [status, setStatus]   = useState<JobStatus>(currentStatus);
  const [note, setNote]       = useState(currentNote ?? "");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  const isDirty = status !== currentStatus || note !== (currentNote ?? "");

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);

    const result = await updateJobStatus(jobId, { status, ops_note: note || null });

    if ("ok" in result) {
      setSaved(true);
      router.refresh();
    } else {
      setError("Save failed — try again.");
    }
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 p-5 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Ops Actions
      </h2>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatus(opt.value); setSaved(false); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              status === opt.value
                ? STATUS_STYLE[opt.value]
                : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">Ops note</label>
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          placeholder="Internal notes about this job…"
          rows={2}
          className="w-full text-sm rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-partli-accent/40 resize-none placeholder:text-slate-300"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-partli-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </section>
  );
}
