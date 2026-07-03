"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveScan } from "@/lib/ops-actions";

type ScanStatus = "pending" | "approved" | "flagged";

interface Props {
  scanId: string;
  status: ScanStatus;
}

export default function ScanQuickReview({ scanId, status: initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ScanStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    if (busy || status === "approved") return;
    setBusy(true);
    const result = await approveScan(scanId);
    if ("ok" in result) {
      setStatus("approved");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={busy}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === "approved"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "border border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-700"
        }`}
      >
        ✓ Approve
      </button>
      {/* Full review (with required note) is handled on the scan detail page */}
      <a
        href={`/ops/scans/${scanId}`}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === "flagged"
            ? "bg-red-100 text-red-700 border border-red-200"
            : "border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
        }`}
      >
        {status === "flagged" ? "✗ Flagged" : "✗ Flag"}
      </a>
      {status === "pending" && (
        <span className="text-xs text-amber-600 font-medium">Pending review</span>
      )}
    </div>
  );
}
