"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convertScanToJob } from "@/lib/ops-actions";

const DEFAULT_PHASES = ["pre-install", "installation", "post-install"];

export default function ConvertToJobForm({
  scanId,
  defaultName,
  defaultAddress,
}: {
  scanId: string;
  defaultName: string;
  defaultAddress: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [phasesRaw, setPhasesRaw] = useState(DEFAULT_PHASES.join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phases = phasesRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (phases.length === 0) {
      setError("Enter at least one phase");
      return;
    }
    setLoading(true);
    const result = await convertScanToJob(scanId, {
      name,
      address: address.trim() || null,
      phases,
    });
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/ops/jobs/${result.job_id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Job name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-partli-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-partli-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">
          Phases <span className="text-slate-400">(comma-separated)</span>
        </label>
        <input
          value={phasesRaw}
          onChange={(e) => setPhasesRaw(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-partli-accent"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="px-4 py-2 bg-partli-primary text-white rounded text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {loading ? "Creating…" : "Create Job →"}
      </button>
    </form>
  );
}
