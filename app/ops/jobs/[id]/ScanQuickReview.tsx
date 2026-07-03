"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ScanStatus = "pending" | "approved" | "flagged";

interface Props {
  scanId: string;
  status: ScanStatus;
}

export default function ScanQuickReview({ scanId, status: initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ScanStatus>(initialStatus);
  const [busy, setBusy]     = useState(false);

  async function review(next: ScanStatus) {
    if (busy || next === status) return;
    setBusy(true);
    const res = await fetch(`/api/scans/${scanId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, ops_note: "" }),
    });
    if (res.ok) {
      setStatus(next);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => review("approved")}
        disabled={busy}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === "approved"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "border border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-700"
        }`}
      >
        ✓ Approve
      </button>
      <button
        onClick={() => review("flagged")}
        disabled={busy}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === "flagged"
            ? "bg-red-100 text-red-700 border border-red-200"
            : "border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
        }`}
      >
        ✗ Flag
      </button>
      {status === "pending" && (
        <span className="text-xs text-amber-600 font-medium">Pending review</span>
      )}
    </div>
  );
}
